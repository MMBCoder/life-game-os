/**
 * Reads the current Intention Level (-7 … +7) from signals the system already has.
 *
 * Deterministic and pure, like every other score in this directory. No model decides
 * where a person sits on the ladder — the same inputs always produce the same level,
 * and the derivation is shown to the user in full so it can be argued with.
 *
 * The shape of it: two opposing quantities.
 *
 *   LIFT   how much of what you are doing is chosen — alignment, momentum, follow-through
 *   DRAG   how much of your energy is going into absorbing cost — depletion,
 *          sacrifice, and any protection the plan is currently breaching
 *
 * Level is the difference. That is deliberate: someone can be working extremely hard
 * and still be at -4, because effort spent against yourself is drag, not lift. Effort
 * alone was never the thing worth measuring.
 */

import { intentionAt, type IntentionLevel } from '@/lib/intention/scale';

export type SacrificeVerdict = 'balanced' | 'watch' | 'warning';

export interface IntentionInputs {
  /** 0-10. Does the plan match the domains they said matter? */
  alignment: number;
  /** 0-10. Intentional Momentum. */
  momentum: number;
  /** 0-1. Share of today's moves completed. */
  followThrough: number;
  /** 0-10. */
  energy: number;
  /** 0-10. */
  capacity: number;
  sacrificeVerdict: SacrificeVerdict | null;
  /** Conflicts currently blocking, e.g. a firm non-negotiable being spent. */
  blockingConflicts: number;
  /** Without a designed game there is nothing to be intentional *toward*. */
  hasGame: boolean;
  /** A plan received is not a plan chosen. */
  confirmed: boolean;
}

export interface IntentionReading {
  level: number;
  detail: IntentionLevel;
  lift: number;
  drag: number;
  /** What is holding the level up, strongest first. */
  raising: string[];
  /** What is pulling it down, strongest first. */
  lowering: string[];
  /** Plain-language account of the arithmetic. */
  explanation: string;
}

const LIFT_WEIGHTS = { alignment: 0.35, momentum: 0.4, followThrough: 0.25 };
const DRAG_WEIGHTS = { depletion: 0.45, sacrifice: 0.35, breach: 0.2 };

/** A ±10 spread compressed onto a ±7 ladder. */
const SCALE = 0.7;

const SACRIFICE_COST: Record<SacrificeVerdict, number> = {
  balanced: 0,
  watch: 5,
  warning: 9,
};

/** No assessment yet is not the same as no cost; assume a little until measured. */
const SACRIFICE_UNKNOWN = 2;

export function computeIntention(inputs: IntentionInputs): IntentionReading {
  const alignment = clamp10(inputs.alignment);
  const momentum = clamp10(inputs.momentum);
  const followThrough = clamp10(inputs.followThrough * 10);
  const energy = clamp10(inputs.energy);
  const capacity = clamp10(inputs.capacity);

  const lift =
    alignment * LIFT_WEIGHTS.alignment +
    momentum * LIFT_WEIGHTS.momentum +
    followThrough * LIFT_WEIGHTS.followThrough;

  // Whichever of energy or capacity is scarcer sets how depleted the day is: having
  // the hours is no use without the energy, and the reverse is equally true.
  const depletion = 10 - Math.min(energy, capacity);
  const sacrifice =
    inputs.sacrificeVerdict === null
      ? SACRIFICE_UNKNOWN
      : SACRIFICE_COST[inputs.sacrificeVerdict];
  const breach = inputs.blockingConflicts > 0 ? 10 : 0;

  const drag =
    depletion * DRAG_WEIGHTS.depletion +
    sacrifice * DRAG_WEIGHTS.sacrifice +
    breach * DRAG_WEIGHTS.breach;

  let level = Math.round((lift - drag) * SCALE);

  // ── Ceilings, not penalties ──────────────────────────────────────────────
  // Some states are categorical rather than gradual, and the arithmetic alone reads
  // them wrongly. Someone perfectly aligned, at full momentum, completing every move
  // — but running on empty and spending a protection — scores a *higher* lift than
  // drag and lands at 0, "Settling". That is exactly backwards: Settling means
  // accepting less than you want, and this person is doing the opposite at their own
  // expense. Effort is not evidence of intention when it is aimed at yourself.
  if (!inputs.hasGame) level = Math.min(level, 1);
  else if (!inputs.confirmed) level = Math.min(level, 4);

  // A plan drawing on something the person swore to protect *is* Sacrificing, by
  // definition — giving away what you want for a cause — however well the rest of
  // the week is going.
  if (inputs.blockingConflicts > 0) level = Math.min(level, -2);

  // The Sacrifice Radar saying the route costs more than it returns rules out the
  // bands above zero, which all describe moving toward something.
  if (inputs.sacrificeVerdict === 'warning') level = Math.min(level, 0);

  level = Math.max(-7, Math.min(7, level));

  const raising = rank([
    [alignment >= 6, 'The plan matches what you said matters'],
    [momentum >= 6, 'You are operating intentionally toward this game'],
    [followThrough >= 6, 'You are finishing the moves you commit to'],
    [energy >= 7, 'You have energy to spend'],
    [capacity >= 7, 'There is room in the week'],
  ]);

  const lowering = rank([
    [breach > 0, 'The plan is currently spending something you protected'],
    [sacrifice >= 9, 'The cost across your life is too high for this strategy'],
    [depletion >= 6, 'Energy or capacity is the binding constraint right now'],
    [sacrifice >= 5 && sacrifice < 9, 'The plan is starting to cost more than it returns'],
    [momentum > 0 && momentum <= 4, 'Little of the week is going toward the game'],
    [followThrough <= 3, 'Committed moves are not being completed'],
    [!inputs.hasGame, 'There is no game yet to be intentional toward'],
    [inputs.hasGame && !inputs.confirmed, 'The plan has not been confirmed, only received'],
  ]);

  return {
    level,
    detail: intentionAt(level),
    lift: round1(lift),
    drag: round1(drag),
    raising,
    lowering,
    explanation: explain(lift, drag, level),
  };
}

/**
 * The single change most likely to move the level up, given what is currently
 * costing the most. Ordered by leverage, not by ease.
 */
export function liftLever(reading: IntentionReading, inputs: IntentionInputs): string {
  if (!inputs.hasGame) return 'Design the game. Nothing above Striving is available without one.';
  if (inputs.blockingConflicts > 0)
    return 'Resolve the protection the plan is breaching. Everything else is downstream of that.';
  if (inputs.sacrificeVerdict === 'warning')
    return 'Change the strategy, not the ambition — the current route costs more than it returns.';
  if (Math.min(inputs.energy, inputs.capacity) <= 4)
    return 'Run the Minimum protocol today. Recovering capacity is the move, not pushing through it.';
  if (!inputs.confirmed) return 'Confirm the plan. A plan you have only received cannot be led.';
  if (inputs.followThrough < 0.5) return 'Complete one move today. Follow-through is the cheapest lift available.';
  if (reading.level >= 5) return 'Hold this. The work now is protecting the conditions that got you here.';
  return 'Pick the one strategic move and finish it before anything is added.';
}

function explain(lift: number, drag: number, level: number): string {
  const direction = level > 0 ? 'toward the game' : level < 0 ? 'into absorbing its cost' : 'in neither direction';
  return (
    `Chosen effort scores ${round1(lift)}/10 and absorbed cost scores ${round1(drag)}/10, ` +
    `so most of your energy is currently going ${direction}.`
  );
}

function rank(candidates: Array<[boolean, string]>): string[] {
  return candidates.filter(([active]) => active).map(([, label]) => label);
}

function clamp10(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
