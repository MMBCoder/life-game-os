import {
  GUARDIAN_AGENTS,
  type AgentId,
  type AgentOutput,
  type CouncilConflict,
} from '@/schemas/agent';
import { SEVERITY_RANK, type Severity } from '@/schemas/common';
import type { CouncilContext } from '@/lib/personalization/context-types';

/**
 * Deterministic conflict detection over the agents' structured outputs.
 *
 * This is the load-bearing piece of the whole product. A model asked "is this plan
 * unsafe?" is probabilistic; a rule that reads the user's `firm` non-negotiables and
 * compares them against the proposed changes is not. The council generates options
 * and argues; the guarantee lives here (docs/decisions.md D7).
 *
 * Resolution precedence — ambition is never lowered to resolve a conflict, only the
 * method changes:
 *   1. non-negotiable breach   (hard block)
 *   2. health guardian veto
 *   3. relationship guardian veto
 *   4. capacity infeasibility
 *   5. red team, severity ≥ high
 *   6. strategy preference
 */

const MAX_ACTIVE_PRIORITIES = 3;

export function detectConflicts(
  outputs: AgentOutput[],
  ctx: CouncilContext,
): CouncilConflict[] {
  return [
    ...detectNonNegotiableBreaches(outputs, ctx),
    ...detectGuardianVetoes(outputs),
    ...detectCapacityOverruns(outputs, ctx),
    ...detectPriorityOverload(outputs, ctx),
    ...detectContradictoryChanges(outputs),
    ...detectRedTeamBlocks(outputs),
  ].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

/**
 * The hard block. If a proposal would spend something the person declared firm, it
 * is rejected regardless of upside — no amount of strategic value buys it.
 */
function detectNonNegotiableBreaches(
  outputs: AgentOutput[],
  ctx: CouncilContext,
): CouncilConflict[] {
  const firm = ctx.nonNegotiables.filter((n) => n.hardness === 'firm');
  if (firm.length === 0) return [];

  const conflicts: CouncilConflict[] = [];

  for (const output of outputs) {
    for (const change of output.proposedChanges) {
      const text = JSON.stringify(change.payload).toLowerCase();
      for (const protection of firm) {
        if (!breaches(text, protection.label)) continue;
        conflicts.push({
          kind: 'non_negotiable_breach',
          raisedBy: 'orchestrator',
          against: output.agent,
          claim: `This change would draw on "${protection.label}", which is a firm non-negotiable.`,
          severity: 'critical',
          resolution:
            'Rejected. The ambition stands; the method has to change. Find the same outcome through leverage instead.',
          resolvedInFavourOf: 'orchestrator',
        });
      }
    }
  }

  return dedupe(conflicts);
}

/**
 * Detects a proposal spending a protected thing. Keyword matching is deliberately
 * conservative: a false positive costs a strategy option, a false negative costs the
 * user something they said they would not give up.
 */
function breaches(payloadText: string, protectionLabel: string): boolean {
  const keywords = protectionLabel
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3);
  if (keywords.length === 0) return false;

  const mentionsProtected = keywords.some((k) => payloadText.includes(k));
  if (!mentionsProtected) return false;

  const spendingLanguage =
    /\b(reduce|cut|less|sacrifice|trade|shorten|skip|drop|fewer|borrow|defer|postpone|later|evening|weekend|night)\b/;
  return spendingLanguage.test(payloadText);
}

/** Guardians can veto. Strategy cannot overrule them. */
function detectGuardianVetoes(outputs: AgentOutput[]): CouncilConflict[] {
  const conflicts: CouncilConflict[] = [];

  for (const output of outputs) {
    if (!GUARDIAN_AGENTS.includes(output.agent)) continue;

    for (const objection of output.objections) {
      if (SEVERITY_RANK[objection.severity] < SEVERITY_RANK.high) continue;

      conflicts.push({
        kind: 'guardian_veto',
        raisedBy: output.agent,
        against: objection.against,
        claim: objection.claim,
        severity: objection.severity,
        resolution:
          output.agent === 'health'
            ? 'Blocked pending revision. Recovery is not an acceptable funding source for this plan; reduce load before adding to it.'
            : 'Blocked pending revision. Protected relationship time is not available to the plan; the method has to change.',
        resolvedInFavourOf: output.agent,
      });
    }
  }

  return conflicts;
}

/** Feasibility as arithmetic. "It does not fit" is a fact, not an opinion. */
function detectCapacityOverruns(
  outputs: AgentOutput[],
  ctx: CouncilContext,
): CouncilConflict[] {
  if (ctx.capacity.verdict !== 'overloaded' && ctx.capacity.verdict !== 'tight') return [];

  const additive = outputs.filter(
    (o) =>
      o.agent !== 'capacity' &&
      o.recommendations.some((r) => ADDITIVE_LANGUAGE.test(`${r.title} ${r.detail}`)) &&
      !o.recommendations.some((r) => REMOVAL_LANGUAGE.test(`${r.title} ${r.detail}`)),
  );

  return additive.map((o) => ({
    kind: 'capacity_overrun' as const,
    raisedBy: 'capacity' as AgentId,
    against: o.agent,
    claim: `Capacity is at ${Math.round(ctx.capacity.load * 100)}% (${ctx.capacity.verdict}). This proposal adds workload without a corresponding removal.`,
    severity: (ctx.capacity.verdict === 'overloaded' ? 'high' : 'medium') as Severity,
    resolution:
      'Revised. The proposal stands only once something has been ended or handed over — the first thirty days create room rather than filling it.',
    resolvedInFavourOf: 'capacity' as AgentId,
  }));
}

const ADDITIVE_LANGUAGE =
  /\b(add|take on|start|new initiative|additional|extra|increase|expand|more hours|another)\b/i;
const REMOVAL_LANGUAGE =
  /\b(stop|end|remove|delegate|hand over|decline|eliminate|drop|reduce|cut)\b/i;

/** Law 6: a plan that will not fit in a person's head will not be run. */
function detectPriorityOverload(
  outputs: AgentOutput[],
  ctx: CouncilContext,
): CouncilConflict[] {
  const proposedPriorities = outputs
    .flatMap((o) => o.recommendations)
    .filter((r) => r.priority === 'high').length;
  const existing = ctx.game?.boldResults.length ?? 0;
  const total = proposedPriorities + existing;

  if (total <= MAX_ACTIVE_PRIORITIES) return [];

  return [
    {
      kind: 'priority_overload',
      raisedBy: 'orchestrator',
      against: null,
      claim: `This plan currently contains ${total} high priorities. That is too many to hold and too many to run.`,
      severity: total > MAX_ACTIVE_PRIORITIES + 3 ? 'high' : 'medium',
      resolution: `Reduced to ${MAX_ACTIVE_PRIORITIES}. The rest move to the backlog rather than being deleted — they are deferred, not abandoned.`,
      resolvedInFavourOf: 'orchestrator',
    },
  ];
}

/** Two agents proposing opposite operations on the same target. */
function detectContradictoryChanges(outputs: AgentOutput[]): CouncilConflict[] {
  const byTarget = new Map<string, Array<{ agent: AgentId; operation: string }>>();

  for (const output of outputs) {
    for (const change of output.proposedChanges) {
      const list = byTarget.get(change.target) ?? [];
      list.push({ agent: output.agent, operation: change.operation });
      byTarget.set(change.target, list);
    }
  }

  const conflicts: CouncilConflict[] = [];
  for (const [target, changes] of byTarget) {
    const creates = changes.filter((c) => c.operation === 'create');
    const removes = changes.filter((c) => c.operation === 'remove');
    if (creates.length === 0 || removes.length === 0) continue;

    conflicts.push({
      kind: 'contradictory_change',
      raisedBy: removes[0]?.agent ?? 'orchestrator',
      against: creates[0]?.agent ?? null,
      claim: `Two agents proposed opposite changes to ${target.replace(/_/g, ' ')}.`,
      severity: 'medium',
      resolution:
        'Resolved in favour of removal. Where the council is split, the smaller plan wins — capacity is the scarcer resource.',
      resolvedInFavourOf: removes[0]?.agent ?? 'orchestrator',
    });
  }

  return conflicts;
}

function detectRedTeamBlocks(outputs: AgentOutput[]): CouncilConflict[] {
  const redTeam = outputs.find((o) => o.agent === 'redTeam');
  if (!redTeam) return [];

  return redTeam.risks
    .filter((r) => SEVERITY_RANK[r.severity] >= SEVERITY_RANK.high && r.likelihood === 'high')
    .map((r) => ({
      kind: 'red_team_block' as const,
      raisedBy: 'redTeam' as AgentId,
      against: null,
      claim: `${r.title}: ${r.detail}`,
      severity: r.severity,
      resolution: `Mitigation required before this plan is adopted: ${r.mitigation}`,
      resolvedInFavourOf: 'redTeam' as AgentId,
    }));
}

/** True when at least one conflict is severe enough to force revision. */
export function isBlocking(conflicts: CouncilConflict[]): boolean {
  return conflicts.some(
    (c) =>
      c.kind === 'non_negotiable_breach' ||
      (c.kind === 'guardian_veto' && SEVERITY_RANK[c.severity] >= SEVERITY_RANK.high) ||
      (c.kind === 'capacity_overrun' && c.severity === 'high') ||
      (c.kind === 'red_team_block' && SEVERITY_RANK[c.severity] >= SEVERITY_RANK.high),
  );
}

function dedupe(conflicts: CouncilConflict[]): CouncilConflict[] {
  const seen = new Set<string>();
  return conflicts.filter((c) => {
    const key = `${c.kind}|${c.raisedBy}|${c.against}|${c.claim}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
