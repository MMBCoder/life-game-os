import 'server-only';
import { getProvider, maxAgentsPerRun } from '@/lib/ai';
import { AppError, logFailure } from '@/lib/errors';
import { detectConflicts, isBlocking } from '@/lib/scoring/conflicts';
import type { CouncilContext } from '@/lib/personalization/context-types';
import { BASE_SYSTEM } from '@/prompts/system/base';
import { SAFETY_SYSTEM } from '@/prompts/system/safety';
import { AGENT_CHARTERS } from '@/prompts/agents';
import { serialiseContext } from '@/lib/personalization/context-types';
import {
  councilDecision,
  type AgentId,
  type AgentOutput,
  type CouncilConflict,
  type CouncilDecision,
  type CouncilPurpose,
} from '@/schemas/agent';
import { route } from './routing';
import { runAgent, type AgentRunRecord } from './runner';

export interface CouncilRunResult {
  purpose: CouncilPurpose;
  decision: CouncilDecision;
  outputs: AgentOutput[];
  conflicts: CouncilConflict[];
  records: AgentRunRecord[];
  failedAgents: AgentId[];
  latencyMs: number;
  provider: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
  /** The single highest-value question across the whole council, or null. */
  nextQuestion: CouncilDecision['nextQuestion'];
}

/**
 * Convenes the council.
 *
 *   1. PARALLEL ANALYSIS   routed agents run concurrently on identical context
 *   2. OBJECTION EXCHANGE  first-pass output is handed to the second pass
 *   3. CONFLICT DETECTION  deterministic, in src/lib/scoring/conflicts
 *   4. RED TEAM            attacks the surviving proposal
 *   5. SYNTHESIS           orchestrator resolves under fixed precedence
 *
 * See docs/agent-architecture.md §6.
 */
export async function convene(ctx: CouncilContext): Promise<CouncilRunResult> {
  const started = Date.now();
  const plan = route(ctx.purpose, maxAgentsPerRun());
  const provider = getProvider();

  // ── 1. Parallel analysis ────────────────────────────────────────────────
  const firstRecords = await Promise.all(plan.firstPass.map((agent) => runAgent(agent, ctx)));
  const firstOutputs = firstRecords
    .map((r) => r.output)
    .filter((o): o is AgentOutput => o !== null);

  // ── 2. Objection exchange: the second pass sees what the first produced ──
  const ctxWithPeers: CouncilContext = {
    ...ctx,
    peerOutputs: firstOutputs.map(toPeerSummary),
  };

  const redTeamAgents = plan.secondPass.filter((a) => a === 'redTeam');
  const redTeamRecords = await Promise.all(
    redTeamAgents.map((agent) => runAgent(agent, ctxWithPeers)),
  );
  const redTeamOutputs = redTeamRecords
    .map((r) => r.output)
    .filter((o): o is AgentOutput => o !== null);

  const allOutputs = [...firstOutputs, ...redTeamOutputs];

  // ── 3. Conflict detection: deterministic, not model-judged ──────────────
  const conflicts = detectConflicts(allOutputs, ctx);

  // ── 4 & 5. Synthesis ────────────────────────────────────────────────────
  const needsOrchestrator = plan.secondPass.includes('orchestrator');
  const ctxForSynthesis: CouncilContext = {
    ...ctx,
    peerOutputs: allOutputs.map(toPeerSummary),
  };

  let decision: CouncilDecision;
  let orchestratorRecord: AgentRunRecord | null = null;

  if (needsOrchestrator) {
    const synthesised = await synthesise(ctxForSynthesis, conflicts);
    decision = synthesised.decision;
    orchestratorRecord = synthesised.record;
  } else {
    // Light runs skip synthesis entirely — a daily reflection does not need a
    // formal verdict, and paying for one would be exactly the waste routing exists
    // to prevent.
    decision = summarise(allOutputs, conflicts);
  }

  const records = [
    ...firstRecords,
    ...redTeamRecords,
    ...(orchestratorRecord ? [orchestratorRecord] : []),
  ];

  const nextQuestion = highestValueQuestion(allOutputs);

  return {
    purpose: ctx.purpose,
    decision: { ...decision, nextQuestion: decision.nextQuestion ?? nextQuestion },
    outputs: allOutputs,
    conflicts,
    records,
    failedAgents: records.filter((r) => r.status === 'failed').map((r) => r.agent),
    latencyMs: Date.now() - started,
    provider: provider.name,
    totalInputTokens: records.reduce((sum, r) => sum + r.inputTokens, 0),
    totalOutputTokens: records.reduce((sum, r) => sum + r.outputTokens, 0),
    estimatedCostUsd: records.reduce((sum, r) => sum + r.estimatedCostUsd, 0),
    nextQuestion,
  };
}

/**
 * The orchestrator's own call. It receives the conflicts as findings rather than
 * discovering them, so the precedence order is enforced by code and only the wording
 * and the trade-off framing are the model's.
 */
async function synthesise(
  ctx: CouncilContext,
  conflicts: CouncilConflict[],
): Promise<{ decision: CouncilDecision; record: AgentRunRecord }> {
  const provider = getProvider();
  const started = Date.now();
  const charter = AGENT_CHARTERS.orchestrator;

  const system = [BASE_SYSTEM, SAFETY_SYSTEM, `## Your role\n${charter.charter}`].join('\n\n');

  const conflictBlock =
    conflicts.length > 0
      ? conflicts
          .map(
            (c) =>
              `- [${c.severity}] ${c.raisedBy}${c.against ? ` vs ${c.against}` : ''}: ${c.claim}\n  Resolution already applied: ${c.resolution}`,
          )
          .join('\n')
      : '- No conflicts were detected.';

  const prompt = [
    `Purpose: ${ctx.purpose.replace(/_/g, ' ')}.`,
    '',
    'Conflicts detected deterministically across the council (these are findings, not suggestions — the resolutions have already been applied):',
    conflictBlock,
    '',
    serialiseContext(ctx),
    '',
    'Synthesise the council into a single decision. Name the disagreement rather than smoothing it over.',
  ].join('\n');

  try {
    const result = await provider.structured({
      system,
      prompt,
      tier: charter.tier,
      schema: councilDecision,
      schemaName: 'CouncilDecision',
    });

    return {
      decision: result.data,
      record: {
        agent: 'orchestrator',
        status: 'succeeded',
        output: null,
        model: result.model,
        provider: provider.name,
        latencyMs: Date.now() - started,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        estimatedCostUsd: result.usage.estimatedCostUsd,
        validationAttempts: result.attempts,
        error: null,
      },
    };
  } catch (error) {
    logFailure('council.synthesise', error, { purpose: ctx.purpose });

    // Degrade rather than fail: a deterministic summary is worse than a synthesised
    // one but still safe and still useful, and the user's plan is untouched.
    return {
      decision: summarise([], conflicts),
      record: {
        agent: 'orchestrator',
        status: 'failed',
        output: null,
        model: 'unknown',
        provider: provider.name,
        latencyMs: Date.now() - started,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        validationAttempts: 1,
        error: error instanceof AppError ? error.kind : 'unknown',
      },
    };
  }
}

/** Deterministic fallback synthesis. Used for light runs and when the model fails. */
function summarise(outputs: AgentOutput[], conflicts: CouncilConflict[]): CouncilDecision {
  const blocking = isBlocking(conflicts);
  const topConflict = conflicts[0];

  const headline = blocking
    ? topConflict?.kind === 'non_negotiable_breach'
      ? 'This plan would spend something you said you would not.'
      : 'Create leverage before adding work.'
    : outputs[0]?.summary.slice(0, 180) ?? 'The council reviewed your plan.';

  const rationale = blocking
    ? `${conflicts
        .slice(0, 3)
        .map((c) => c.claim)
        .join(' ')} The ambition is not the problem — the method is. ${
        topConflict?.resolution ?? ''
      }`.trim()
    : outputs.length > 0
      ? outputs
          .slice(0, 3)
          .map((o) => o.summary)
          .join(' ')
      : 'No agent produced a usable analysis for this run. Your existing plan is unchanged.';

  return {
    verdict: blocking ? 'approve_with_changes' : outputs.length > 0 ? 'approve' : 'defer',
    headline: headline.slice(0, 200),
    rationale: rationale.slice(0, 1600) || 'No analysis available.',
    tradeOffs: conflicts.slice(0, 3).map((c) => c.resolution.slice(0, 300)),
    omissions: [
      'We did not add a second major objective.',
      'We did not increase working hours.',
    ],
    confidence: outputs.length > 0 ? averageConfidence(outputs) * 0.9 : 0.3,
    nextQuestion: null,
  };
}

/**
 * Law 1: only the single highest-value question is ever surfaced, no matter how many
 * the council collectively wants to ask.
 */
function highestValueQuestion(outputs: AgentOutput[]): CouncilDecision['nextQuestion'] {
  const questions = outputs.flatMap((o) => o.questions);
  if (questions.length === 0) return null;

  return questions.reduce((best, q) => (q.valueScore > best.valueScore ? q : best));
}

function toPeerSummary(output: AgentOutput): CouncilContext['peerOutputs'][number] {
  return {
    agent: output.agent,
    summary: output.summary,
    confidence: output.confidence,
    recommendations: output.recommendations.map((r) => `${r.title}: ${r.detail}`),
    risks: output.risks.map((r) => `${r.title}: ${r.detail}`),
    objections: output.objections.map((o) => ({
      against: o.against,
      claim: o.claim,
      severity: o.severity,
    })),
  };
}

function averageConfidence(outputs: AgentOutput[]): number {
  if (outputs.length === 0) return 0.3;
  const total = outputs.reduce((sum, o) => sum + o.confidence, 0);
  return Math.round((total / outputs.length) * 100) / 100;
}
