/**
 * Capacity. Deliberately not an LLM judgement — feasibility must be arithmetic so
 * that "this does not fit" is a fact the Strategy Agent cannot argue away.
 *
 * Time and energy are tracked separately throughout. Two free hours with no mental
 * capacity is not two hours of capacity (spec §28).
 */

export type CapacityVerdict = 'headroom' | 'balanced' | 'tight' | 'overloaded';

export interface CapacityInput {
  availableHoursPerWeek: number;
  committedHoursPerWeek: number;
  /** 0–10 self- or AI-assessed. Scales effective capacity, not the clock. */
  energyLevel: number;
}

export interface CapacityResult {
  availableHoursPerWeek: number;
  committedHoursPerWeek: number;
  /** Committed ÷ energy-adjusted available. > 1 means over-committed. */
  load: number;
  energyLevel: number;
  verdict: CapacityVerdict;
  /** Hours that can be committed without crossing into `tight`. */
  headroomHours: number;
}

const TIGHT_THRESHOLD = 0.8;
const OVERLOADED_THRESHOLD = 0.95;
const HEADROOM_THRESHOLD = 0.6;

export function assessCapacity(input: CapacityInput): CapacityResult {
  const available = Math.max(1, input.availableHoursPerWeek);
  const committed = Math.max(0, input.committedHoursPerWeek);
  const energy = clamp(input.energyLevel, 0, 10);

  // Low energy shrinks usable hours rather than the clock. At 5/10 a person has the
  // same calendar and materially less capacity, and the plan must reflect that.
  const energyFactor = 0.5 + (energy / 10) * 0.5;
  const effectiveAvailable = available * energyFactor;

  const load = committed / effectiveAvailable;

  const verdict: CapacityVerdict =
    load >= OVERLOADED_THRESHOLD
      ? 'overloaded'
      : load >= TIGHT_THRESHOLD
        ? 'tight'
        : load <= HEADROOM_THRESHOLD
          ? 'headroom'
          : 'balanced';

  return {
    availableHoursPerWeek: round(available),
    committedHoursPerWeek: round(committed),
    load: round(load, 3),
    energyLevel: round(energy),
    verdict,
    headroomHours: round(Math.max(0, effectiveAvailable * TIGHT_THRESHOLD - committed)),
  };
}

/** Does adding this much work keep the person out of overload? */
export function canAbsorb(capacity: CapacityResult, additionalHours: number): boolean {
  return additionalHours <= capacity.headroomHours;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
