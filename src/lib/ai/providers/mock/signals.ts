import type { CouncilContext, DomainScores } from '@/lib/personalization/context-types';
import type { LeverageCategory } from '@/schemas/common';

/**
 * The mock provider's understanding of a person.
 *
 * This exists so the offline provider produces genuinely differentiated output
 * rather than a stub. Without it the evaluation suite's central assertion — that two
 * users with the same stated goal receive materially different games — would be
 * vacuous (docs/decisions.md D5).
 */
export interface Signals {
  seed: number;
  name: string;
  /** Domains ranked by stated importance. */
  topDomains: DomainSignal[];
  /** Outer result strong, inner experience weak: the product's signature divergence. */
  divergentDomains: DomainSignal[];
  /** Important but currently poor: where the person feels the gap. */
  gapDomains: DomainSignal[];
  /** Low energy and low satisfaction: where they are paying a price. */
  drainedDomains: DomainSignal[];
  protections: Array<{ label: string; domainKey: string | null; firm: boolean }>;
  hardConstraints: Array<{ label: string; category: string; severity: string }>;
  capacity: CouncilContext['capacity'];
  energy: number;
  goalTitle: string | null;
  goalDomainKey: string | null;
  identityFrom: string | null;
  identityTo: string | null;
  hasFamilyProtection: boolean;
  hasHealthProtection: boolean;
  /** Drives which strategy family applies. The main source of differentiation. */
  archetype: Archetype;
  /** Leverage categories that fit this person's actual situation. */
  leverage: LeverageCategory[];
}

export interface DomainSignal {
  key: string;
  label: string;
  scores: DomainScores;
  /** outerResult − innerExperience. Positive means it looks better than it feels. */
  divergence: number;
  /** desiredExperience − currentExperience. */
  gap: number;
}

/**
 * Archetypes are not personality types shown to the user. They are an internal
 * routing key that decides which strategy family the mock draws from, which is what
 * makes two users with the same goal get different plans.
 */
export type Archetype =
  | 'constrained_ambitious'
  | 'depleted'
  | 'high_capacity_accelerator'
  | 'identity_shifter'
  | 'hollow_winner'
  | 'provider_optimiser';

/** Stable, order-independent hash. Same person ⇒ same output, run after run. */
export function seedFrom(parts: Array<string | number | null | undefined>): number {
  const input = parts.filter((p) => p !== null && p !== undefined).join('|');
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function pick<T>(items: readonly T[], seed: number, offset = 0): T {
  if (items.length === 0) throw new Error('pick() called with an empty list');
  const index = (seed + offset * 2654435761) % items.length;
  return items[index] as T;
}

/** Deterministic sample without repetition. */
export function sample<T>(items: readonly T[], count: number, seed: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  let s = seed;
  while (out.length < count && pool.length > 0) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const [taken] = pool.splice(s % pool.length, 1);
    if (taken !== undefined) out.push(taken);
  }
  return out;
}

export function deriveSignals(ctx: CouncilContext): Signals {
  const scored: DomainSignal[] = ctx.domains
    .filter((d): d is typeof d & { scores: DomainScores } => d.scores !== null)
    .map((d) => ({
      key: d.key,
      label: d.label,
      scores: d.scores,
      divergence: d.scores.outerResult - d.scores.innerExperience,
      gap: d.scores.desiredExperience - d.scores.currentExperience,
    }));

  const topDomains = [...scored].sort((a, b) => b.scores.importance - a.scores.importance);
  const divergentDomains = scored
    .filter((d) => d.divergence >= 2 && d.scores.outerResult >= 6)
    .sort((a, b) => b.divergence - a.divergence);
  const gapDomains = scored
    .filter((d) => d.gap >= 2.5 && d.scores.importance >= 6)
    .sort((a, b) => b.gap * b.scores.importance - a.gap * a.scores.importance);
  const drainedDomains = scored
    .filter((d) => d.scores.energy <= 4 || d.scores.satisfaction <= 4)
    .sort((a, b) => a.scores.energy + a.scores.satisfaction - (b.scores.energy + b.scores.satisfaction));

  const protections = ctx.nonNegotiables.map((n) => ({
    label: n.label,
    domainKey: n.domainKey,
    firm: n.hardness === 'firm',
  }));

  const protectionText = protections.map((p) => `${p.label} ${p.domainKey ?? ''}`).join(' ').toLowerCase();
  const hasFamilyProtection = /family|children|kids|partner|spouse|dinner|weekend/.test(protectionText);
  const hasHealthProtection = /health|sleep|recovery|exercise|training|rest/.test(protectionText);

  const energy = averageEnergy(scored, ctx);
  const archetype = classify(ctx, {
    scored,
    divergentDomains,
    drainedDomains,
    hasFamilyProtection,
    energy,
  });

  return {
    seed: seedFrom([
      ctx.user.name,
      ctx.goal?.title,
      ctx.identity?.desired,
      ...ctx.nonNegotiables.map((n) => n.label),
      ...topDomains.slice(0, 3).map((d) => d.key),
      archetype,
    ]),
    name: ctx.user.name,
    topDomains,
    divergentDomains,
    gapDomains,
    drainedDomains,
    protections,
    hardConstraints: ctx.constraints.filter(
      (c) => c.severity === 'high' || c.severity === 'critical',
    ),
    capacity: ctx.capacity,
    energy,
    goalTitle: ctx.goal?.title ?? null,
    goalDomainKey: ctx.goal?.domainKey ?? null,
    identityFrom: ctx.identity?.current ?? null,
    identityTo: ctx.identity?.desired ?? null,
    hasFamilyProtection,
    hasHealthProtection,
    archetype,
    leverage: leverageFor(archetype, ctx),
  };
}

function averageEnergy(scored: DomainSignal[], ctx: CouncilContext): number {
  if (ctx.state) return ctx.state.energy;
  if (scored.length === 0) return 5;
  return scored.reduce((sum, d) => sum + d.scores.energy, 0) / scored.length;
}

function classify(
  ctx: CouncilContext,
  facts: {
    scored: DomainSignal[];
    divergentDomains: DomainSignal[];
    drainedDomains: DomainSignal[];
    hasFamilyProtection: boolean;
    energy: number;
  },
): Archetype {
  const goalText = `${ctx.goal?.title ?? ''} ${ctx.goal?.rawInput ?? ''}`.toLowerCase();
  const identityTension = (ctx.identity?.tensions ?? []).length > 0;
  const overloaded = ctx.capacity.verdict === 'overloaded' || ctx.capacity.verdict === 'tight';

  // Order matters: the most constraining reading of a person wins, because the
  // product's job is to protect first and accelerate second.
  if (facts.energy <= 3.5 || facts.drainedDomains.length >= 4) return 'depleted';

  if (/financial|money|wealth|freedom|income|debt|invest/.test(goalText) && facts.hasFamilyProtection) {
    return 'provider_optimiser';
  }

  if (
    facts.divergentDomains.length >= 2 &&
    facts.divergentDomains.some((d) => ['career', 'finance'].includes(d.key))
  ) {
    return 'hollow_winner';
  }

  if (identityTension && /change|transition|pivot|move into|become|switch/.test(goalText)) {
    return 'identity_shifter';
  }

  if (overloaded || facts.hasFamilyProtection) return 'constrained_ambitious';

  return 'high_capacity_accelerator';
}

/**
 * Leverage categories that actually fit. A person with no headroom cannot be told to
 * add visibility work; they need delegation and positioning. This mapping is why
 * the two "senior leader" personas diverge (docs/evaluation-plan.md §3).
 */
function leverageFor(archetype: Archetype, ctx: CouncilContext): LeverageCategory[] {
  const base: Record<Archetype, LeverageCategory[]> = {
    constrained_ambitious: [
      'delegation',
      'positioning',
      'communication',
      'elimination',
      'systems',
      'negotiation',
    ],
    depleted: ['elimination', 'systems', 'environment', 'negotiation', 'focus'],
    high_capacity_accelerator: [
      'visibility',
      'sponsorship',
      'relationships',
      'expertise',
      'sequencing',
      'focus',
    ],
    identity_shifter: ['expertise', 'relationships', 'positioning', 'sequencing', 'visibility'],
    hollow_winner: ['elimination', 'focus', 'negotiation', 'environment', 'positioning'],
    provider_optimiser: ['automation', 'systems', 'sequencing', 'negotiation', 'elimination'],
  };

  const list = [...base[archetype]];
  // A hard time constraint makes automation and elimination unavoidable.
  if (ctx.constraints.some((c) => c.category === 'time' && c.severity !== 'low')) {
    if (!list.includes('automation')) list.unshift('automation');
    if (!list.includes('elimination')) list.unshift('elimination');
  }
  return list;
}

export const ARCHETYPE_FRAMING: Record<Archetype, string> = {
  constrained_ambitious:
    'ambition is real and capacity is genuinely limited, so progress has to come from leverage rather than hours',
  depleted:
    'the immediate constraint is energy, so the plan has to rebuild capacity before it adds load',
  high_capacity_accelerator:
    'there is real headroom, so the plan can pursue exposure and pace deliberately',
  identity_shifter:
    'the shift is as much about who you are becoming as what you produce, so credibility and sequencing lead',
  hollow_winner:
    'the external results are already strong; what needs attention is the experience of producing them',
  provider_optimiser:
    'the goal is financial progress that does not quietly bill itself to the people it is for',
};
