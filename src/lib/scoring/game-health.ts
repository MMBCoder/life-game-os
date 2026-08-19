/**
 * Game Health, 0–100.
 *
 * This evaluates the *quality of the current plan*. It is not a measure of the
 * person's worth and the UI must never present it as one.
 */

export interface GameHealthInput {
  /** Is there one clear goal with all four Whole Goal dimensions? */
  goalClarity: number;
  /** Do the moves follow from the objective, and is leverage present? */
  strategicCoherence: number;
  /** Capacity load, 0–1. Lower is better; > 0.95 is overloaded. */
  capacityLoad: number;
  /** Does the plan match the domains the person said matter? */
  alignment: number;
  /** Is health explicitly protected in the plan? */
  healthProtection: number;
  /** Are relationships explicitly protected? */
  familyProtection: number;
  /** Ratio of planned moves actually completed, 0–1. */
  executionConsistency: number;
  /** Ratio of bold results showing measurable progress, 0–1. */
  evidenceOfProgress: number;
  /** Has the plan been revised in response to reality? */
  adaptability: number;
}

export interface GameHealthResult {
  score: number;
  band: 'fragile' | 'developing' | 'solid' | 'strong';
  strong: string[];
  watch: string[];
  contributions: Array<{ factor: string; score: number; weight: number }>;
}

const FACTORS: Array<{
  key: keyof GameHealthInput;
  label: string;
  weight: number;
  /** Capacity load is the one input where a high raw value is bad. */
  invert?: boolean;
  normalise?: (v: number) => number;
}> = [
  { key: 'goalClarity', label: 'Clarity', weight: 0.15 },
  { key: 'strategicCoherence', label: 'Strategic focus', weight: 0.15 },
  { key: 'capacityLoad', label: 'Capacity', weight: 0.15, invert: true, normalise: (v) => v * 10 },
  { key: 'alignment', label: 'Alignment', weight: 0.12 },
  { key: 'healthProtection', label: 'Health protection', weight: 0.12 },
  { key: 'familyProtection', label: 'Relationship protection', weight: 0.1 },
  { key: 'executionConsistency', label: 'Execution', weight: 0.09, normalise: (v) => v * 10 },
  { key: 'evidenceOfProgress', label: 'Evidence of progress', weight: 0.07, normalise: (v) => v * 10 },
  { key: 'adaptability', label: 'Adaptability', weight: 0.05 },
];

export function computeGameHealth(input: GameHealthInput): GameHealthResult {
  const contributions = FACTORS.map((factor) => {
    const raw = factor.normalise ? factor.normalise(input[factor.key]) : input[factor.key];
    const bounded = Math.max(0, Math.min(10, raw));
    const score = factor.invert ? 10 - bounded : bounded;
    return { factor: factor.label, score: Math.round(score * 10) / 10, weight: factor.weight };
  });

  const score = Math.round(
    contributions.reduce((sum, c) => sum + c.score * c.weight, 0) * 10,
  );

  return {
    score,
    band: score >= 80 ? 'strong' : score >= 65 ? 'solid' : score >= 45 ? 'developing' : 'fragile',
    strong: contributions.filter((c) => c.score >= 7.5).map((c) => c.factor),
    watch: contributions.filter((c) => c.score <= 5).map((c) => c.factor),
    contributions,
  };
}

export const GAME_HEALTH_BAND_LABEL: Record<GameHealthResult['band'], string> = {
  fragile: 'Fragile',
  developing: 'Developing',
  solid: 'Solid',
  strong: 'Strong',
};
