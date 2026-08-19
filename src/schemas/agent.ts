import { z } from 'zod';
import { confidence, evidenceRef, itemStatus, leverageCategory, severity } from './common';

/** The thirteen council members. */
export const agentId = z.enum([
  'orchestrator',
  'identity',
  'reality',
  'goal',
  'player',
  'strategy',
  'health',
  'relationships',
  'capacity',
  'redTeam',
  'execution',
  'reflection',
  'adaptation',
]);
export type AgentId = z.infer<typeof agentId>;

export const AGENT_LABEL: Record<AgentId, string> = {
  orchestrator: 'Life Architect',
  identity: 'Identity',
  reality: 'Reality Mapper',
  goal: 'Goal Architect',
  player: 'Player Designer',
  strategy: 'Strategy',
  health: 'Health Guardian',
  relationships: 'Relationship Guardian',
  capacity: 'Capacity',
  redTeam: 'Red Team',
  execution: 'Execution',
  reflection: 'Reflection',
  adaptation: 'Adaptation',
};

/** Agents whose objections can veto a proposal outright. See docs/agent-architecture.md §6. */
export const GUARDIAN_AGENTS: readonly AgentId[] = ['health', 'relationships'];

/** What the council was convened to do. Drives agent routing. */
export const councilPurpose = z.enum([
  'onboarding_snapshot',
  'life_map_estimate',
  'whole_goal',
  'player_design',
  'game_design',
  'plan_review',
  'decision',
  'protocol_design',
  'daily_plan',
  'daily_reflection',
  'weekly_review',
  'monthly_review',
  'adaptation',
  'insight_plan',
]);
export type CouncilPurpose = z.infer<typeof councilPurpose>;

export const insight = z.object({
  title: z.string().min(3).max(160),
  detail: z.string().min(10).max(900),
  confidence,
  evidence: z.array(evidenceRef).default([]),
});
export type Insight = z.infer<typeof insight>;

export const recommendation = z.object({
  title: z.string().min(3).max(160),
  detail: z.string().min(10).max(900),
  rationale: z.string().min(10).max(700),
  priority: z.enum(['low', 'medium', 'high']),
  leverage: leverageCategory.optional(),
});
export type Recommendation = z.infer<typeof recommendation>;

export const risk = z.object({
  title: z.string().min(3).max(160),
  detail: z.string().min(10).max(700),
  severity,
  likelihood: z.enum(['low', 'medium', 'high']),
  mitigation: z.string().min(5).max(500),
});
export type Risk = z.infer<typeof risk>;

/**
 * A question an agent wants asked. `valueScore` is what enforces the minimal-input
 * law: the orchestrator surfaces only the single highest-scoring question across
 * every agent in the run, never a battery.
 */
export const agentQuestion = z.object({
  question: z.string().min(8).max(280),
  why: z.string().min(8).max(400),
  // Spelled out in words as well as in the JSON Schema bounds: models otherwise
  // assume a 1-10 scale here and every response then fails validation.
  valueScore: z
    .number()
    .min(0)
    .max(1)
    .describe(
      'How much answering this would improve the plan, as a decimal fraction between 0 and 1 (for example 0.85). Never a 1-10 rating.',
    ),
  suggestions: z.array(z.string().max(160)).max(8).default([]),
});
export type AgentQuestion = z.infer<typeof agentQuestion>;

/** A concrete mutation an agent wants applied, subject to conflict detection. */
export const proposedChange = z.object({
  target: z.enum([
    'identity',
    'values',
    'life_scores',
    'goal',
    'whole_goal',
    'player',
    'game',
    'bold_results',
    'strategic_moves',
    'stop_list',
    'protect_list',
    'protocol',
    'rituals',
    'routines',
    'actions',
    'constraints',
    'non_negotiables',
  ]),
  operation: z.enum(['create', 'update', 'remove', 'reorder']),
  payload: z.record(z.string(), z.unknown()),
  rationale: z.string().min(8).max(600),
});
export type ProposedChange = z.infer<typeof proposedChange>;

/**
 * An agent attacking a named peer. Without this the council would only produce
 * parallel opinions; this is what makes negotiation real.
 */
export const objection = z.object({
  against: agentId,
  claim: z.string().min(8).max(500),
  severity,
  basis: z.enum([
    'capacity',
    'health',
    'relationships',
    'non_negotiable',
    'identity',
    'strategy',
    'feasibility',
    'evidence',
  ]),
});
export type Objection = z.infer<typeof objection>;

/** The envelope every agent must return. Validated before anything is persisted. */
export const agentOutput = z.object({
  agent: agentId,
  status: itemStatus,
  confidence,
  summary: z.string().min(10).max(400),
  /**
   * Concise, user-facing reasoning points. Never raw chain-of-thought — the
   * prompts instruct the model accordingly and this is never used for anything
   * other than display.
   */
  reasoning: z.array(z.string().max(400)).max(8).default([]),
  insights: z.array(insight).max(8).default([]),
  recommendations: z.array(recommendation).max(8).default([]),
  risks: z.array(risk).max(6).default([]),
  questions: z
    .array(agentQuestion)
    .max(4)
    .default([])
    .describe(
      'At most 4 questions, and only ones whose answer would change the plan. The council surfaces just the single highest-scoring question, so extras are discarded.',
    ),
  proposedChanges: z.array(proposedChange).max(12).default([]),
  objections: z.array(objection).max(6).default([]),
  evidence: z.array(evidenceRef).max(12).default([]),
});
export type AgentOutput = z.infer<typeof agentOutput>;

/** A conflict found deterministically across agent outputs. */
export const councilConflict = z.object({
  kind: z.enum([
    'non_negotiable_breach',
    'guardian_veto',
    'capacity_overrun',
    'priority_overload',
    'contradictory_change',
    'red_team_block',
  ]),
  raisedBy: agentId,
  against: agentId.nullable(),
  claim: z.string().min(5),
  severity,
  resolution: z.string().min(5),
  resolvedInFavourOf: agentId.nullable(),
});
export type CouncilConflict = z.infer<typeof councilConflict>;

export const councilVerdict = z.enum(['approve', 'approve_with_changes', 'reject', 'defer']);
export type CouncilVerdict = z.infer<typeof councilVerdict>;

/** The orchestrator's synthesis — what the user actually sees. */
export const councilDecision = z.object({
  verdict: councilVerdict,
  headline: z.string().min(5).max(200),
  rationale: z.string().min(20).max(1600),
  tradeOffs: z.array(z.string().max(300)).max(8).default([]),
  omissions: z.array(z.string().max(300)).max(8).default([]),
  confidence,
  nextQuestion: agentQuestion.nullable().default(null),
});
export type CouncilDecision = z.infer<typeof councilDecision>;

/** Everything one council run produced, as returned to the UI. */
export interface CouncilResult {
  runId: string;
  purpose: CouncilPurpose;
  decision: CouncilDecision;
  outputs: AgentOutput[];
  conflicts: CouncilConflict[];
  failedAgents: AgentId[];
  latencyMs: number;
  provider: string;
}
