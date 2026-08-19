/**
 * Intentional Momentum, 1–10.
 *
 * NOT a mental-health score and never presented as one. It answers a single
 * question: how intentionally and actively is this person operating toward the game
 * they chose? The computation is exposed to the user in full — a score whose
 * derivation is hidden is a score that cannot be argued with, and this one must be.
 */

export interface MomentumComponents {
  /** Is there one clear goal, expressed in all four dimensions? */
  clarity: number;
  /** Has the person confirmed the plan rather than merely received it? */
  commitment: number;
  /** Does the plan match the domains they said matter? */
  alignment: number;
  /** Are the daily moves actually being completed? */
  action: number;
  /** Is there room for the plan in the week? */
  capacity: number;
  /** Is execution steady rather than bursty? */
  consistency: number;
  /** How much is being deferred, skipped, or renegotiated? (inverted) */
  resistance: number;
}

export interface MomentumResult {
  level: number;
  components: MomentumComponents;
  explanation: string;
  band: MomentumBand;
}

export type MomentumBand =
  | 'passive'
  | 'exploring'
  | 'committing'
  | 'engaging'
  | 'leading'
  | 'fully_aligned';

export const MOMENTUM_BAND_LABEL: Record<MomentumBand, string> = {
  passive: 'Passive',
  exploring: 'Exploring',
  committing: 'Committing',
  engaging: 'Engaging',
  leading: 'Leading',
  fully_aligned: 'Fully aligned',
};

/**
 * Weights. Clarity and commitment lead because a plan nobody has agreed to cannot
 * be executed intentionally regardless of how much activity surrounds it.
 */
const WEIGHTS: Record<keyof MomentumComponents, number> = {
  clarity: 0.2,
  commitment: 0.18,
  alignment: 0.16,
  action: 0.16,
  capacity: 0.12,
  consistency: 0.12,
  resistance: 0.06,
};

export function computeMomentum(components: MomentumComponents): MomentumResult {
  const weighted = (Object.keys(WEIGHTS) as Array<keyof MomentumComponents>).reduce(
    (sum, key) => sum + clamp(components[key]) * WEIGHTS[key],
    0,
  );

  const level = Math.max(1, Math.min(10, Math.round(weighted)));

  return {
    level,
    components,
    explanation: explain(components),
    band: bandFor(level),
  };
}

export function bandFor(level: number): MomentumBand {
  if (level <= 2) return 'passive';
  if (level <= 4) return 'exploring';
  if (level <= 6) return 'committing';
  if (level <= 8) return 'engaging';
  if (level === 9) return 'leading';
  return 'fully_aligned';
}

/**
 * Names the two strongest and two weakest inputs. Showing the reasoning is what
 * makes the score correctable rather than something done to the user.
 */
function explain(c: MomentumComponents): string {
  const entries = (Object.keys(WEIGHTS) as Array<keyof MomentumComponents>)
    .map((key) => ({ key, value: clamp(c[key]) }))
    .sort((a, b) => b.value - a.value);

  const strong = entries.slice(0, 2).filter((e) => e.value >= 6);
  const weak = entries.slice(-2).filter((e) => e.value <= 5);

  const parts: string[] = [];
  if (strong.length > 0) {
    parts.push(`Your ${strong.map((e) => LABELS[e.key]).join(' and ')} ${strong.length > 1 ? 'are' : 'is'} high`);
  }
  if (weak.length > 0) {
    parts.push(
      `${parts.length > 0 ? 'but' : 'Your'} ${weak.map((e) => LABELS[e.key]).join(' and ')} ${
        weak.length > 1 ? 'are reducing' : 'is reducing'
      } the score`,
    );
  }
  return parts.length > 0 ? `${parts.join(', ')}.` : 'Not enough signal yet to explain this score well.';
}

const LABELS: Record<keyof MomentumComponents, string> = {
  clarity: 'clarity',
  commitment: 'commitment',
  alignment: 'alignment',
  action: 'action',
  capacity: 'capacity',
  consistency: 'consistency',
  resistance: 'resistance',
};

function clamp(n: number): number {
  return Math.max(0, Math.min(10, n));
}
