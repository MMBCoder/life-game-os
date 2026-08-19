/**
 * Sacrifice Radar.
 *
 * The model proposes per-domain deltas; the *verdict* is computed here. Protection
 * has to be reliable rather than probabilistic, so whether a plan is acceptable is
 * decided by rules over the user's own non-negotiables, not by asking a model
 * whether it thinks the plan is safe (docs/decisions.md D7).
 */

export type SacrificeVerdict = 'balanced' | 'watch' | 'warning';

export interface DomainDelta {
  domainKey: string;
  /** −3 (severe cost) … +3 (strong gain). */
  delta: number;
  why: string;
}

export interface ProtectedDomain {
  domainKey: string;
  label: string;
  hardness: 'firm' | 'strong' | 'preference';
}

export interface SacrificeResult {
  scores: DomainDelta[];
  verdict: SacrificeVerdict;
  /** Present whenever the verdict is not `balanced`. */
  warning: string | null;
  /** Domains taking a cost the user said they would not pay. */
  breaches: Array<{ domainKey: string; label: string; delta: number; hardness: string }>;
  netGain: number;
  netCost: number;
}

/** A `firm` non-negotiable tolerates no cost at all. `strong` tolerates a nudge. */
const TOLERANCE: Record<ProtectedDomain['hardness'], number> = {
  firm: 0,
  strong: -1,
  preference: -2,
};

export function assessSacrifice(
  scores: DomainDelta[],
  protectedDomains: ProtectedDomain[],
): SacrificeResult {
  const breaches = protectedDomains
    .map((p) => {
      const score = scores.find((s) => s.domainKey === p.domainKey);
      if (!score) return null;
      if (score.delta >= TOLERANCE[p.hardness]) return null;
      return { domainKey: p.domainKey, label: p.label, delta: score.delta, hardness: p.hardness };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  const netGain = scores.filter((s) => s.delta > 0).reduce((sum, s) => sum + s.delta, 0);
  const netCost = Math.abs(scores.filter((s) => s.delta < 0).reduce((sum, s) => sum + s.delta, 0));

  const severeCosts = scores.filter((s) => s.delta <= -2).length;

  const verdict: SacrificeVerdict =
    breaches.some((b) => b.hardness === 'firm') || severeCosts >= 2
      ? 'warning'
      : breaches.length > 0 || netCost > netGain || severeCosts >= 1
        ? 'watch'
        : 'balanced';

  return {
    scores,
    verdict,
    warning: warningFor(verdict, breaches, netCost, netGain),
    breaches,
    netGain,
    netCost,
  };
}

function warningFor(
  verdict: SacrificeVerdict,
  breaches: SacrificeResult['breaches'],
  netCost: number,
  netGain: number,
): string | null {
  if (verdict === 'balanced') return null;

  if (breaches.length > 0) {
    const names = breaches.map((b) => b.label.toLowerCase()).join(' and ');
    return `This plan advances your goal by drawing on ${names} — which you named as something you will not sacrifice. We should not lower the ambition. We should change the strategy.`;
  }

  if (netCost > netGain) {
    return `This plan costs more across your life than it gains in the domain it targets. That is a strategy problem, not a discipline problem — the ambition can stay, the method has to change.`;
  }

  return `This plan creates real progress and a real cost. Worth looking at whether the same result can be reached through leverage instead.`;
}
