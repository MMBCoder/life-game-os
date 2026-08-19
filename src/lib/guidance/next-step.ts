/**
 * The one thing to do next.
 *
 * The dashboard used to present six sections of equal weight and let the person work
 * out where to begin, which is exactly the decision load this product exists to
 * remove (Law 1: minimal input; Law 6: simplify aggressively). This resolves the
 * whole state of the account down to a single next action.
 *
 * Order is by consequence, not by convenience: a plan that is currently breaching a
 * protection outranks an unplanned day, because acting on a breaching plan does
 * damage that finishing today's moves cannot undo.
 */

export type NextStepKind =
  | 'discover'
  | 'design_game'
  | 'resolve_breach'
  | 'review_sacrifice'
  | 'build_protocol'
  | 'plan_today'
  | 'run_moves'
  | 'weekly_review'
  | 'current';

export interface NextStep {
  kind: NextStepKind;
  /** Imperative, and short enough to be a button. */
  label: string;
  /** Why this and not something else. Always shown — never a bare instruction. */
  why: string;
  href: string | null;
  /** True when this is a protective interrupt rather than forward progress. */
  urgent: boolean;
}

export interface NextStepInputs {
  onboardingComplete: boolean;
  hasGame: boolean;
  gameConfirmed: boolean;
  blockingConflicts: number;
  sacrificeVerdict: 'balanced' | 'watch' | 'warning' | null;
  hasProtocol: boolean;
  plannedToday: boolean;
  movesTotal: number;
  movesDone: number;
  daysSinceWeeklyReview: number | null;
}

export function resolveNextStep(input: NextStepInputs): NextStep {
  if (!input.onboardingComplete) {
    return {
      kind: 'discover',
      label: 'Start discovery',
      why: 'Three questions. We draft a personal snapshot from them, and you correct anything we read wrong.',
      href: '/discover',
      urgent: false,
    };
  }

  if (input.blockingConflicts > 0) {
    return {
      kind: 'resolve_breach',
      label: 'Review what the plan is spending',
      why: 'Your plan is currently drawing on something you said must not be sacrificed. The council has alternatives that keep the ambition intact.',
      href: '/game',
      urgent: true,
    };
  }

  if (!input.hasGame) {
    return {
      kind: 'design_game',
      label: 'Design your game',
      why: 'Tell us what you want to change and the council designs a 90-day game around it, protecting what you refuse to trade.',
      href: '/game',
      urgent: false,
    };
  }

  if (input.sacrificeVerdict === 'warning') {
    return {
      kind: 'review_sacrifice',
      label: 'Review the strategy warning',
      why: 'The Sacrifice Radar says this route costs more across your life than it returns. We change the strategy, never the ambition.',
      href: '/game',
      urgent: true,
    };
  }

  if (!input.hasProtocol) {
    return {
      kind: 'build_protocol',
      label: 'Build your protocol',
      why: 'Three modes — Minimum, Standard, Expansion — so a hard week reduces the plan instead of ending it.',
      href: '/protocol',
      urgent: false,
    };
  }

  if (!input.plannedToday || input.movesTotal === 0) {
    return {
      kind: 'plan_today',
      label: 'Plan today',
      why: 'Three moves, sized to the capacity you actually have: one strategic, one for you, one for someone who matters.',
      href: null,
      urgent: false,
    };
  }

  if (input.movesDone < input.movesTotal) {
    const left = input.movesTotal - input.movesDone;
    return {
      kind: 'run_moves',
      label: left === 1 ? 'Finish the last move' : `Run today’s ${left} remaining moves`,
      why: 'Today is planned. The only thing left is to play it.',
      href: null,
      urgent: false,
    };
  }

  if (input.daysSinceWeeklyReview === null || input.daysSinceWeeklyReview >= 7) {
    return {
      kind: 'weekly_review',
      label: 'Run your weekly review',
      why: 'The game adapts from what actually happened. Without the review it keeps optimising for a week you did not have.',
      href: '/reflection',
      urgent: false,
    };
  }

  return {
    kind: 'current',
    label: 'You are current',
    why: 'Today is planned and played, and the review is recent. Nothing needs you right now — that is the point.',
    href: null,
    urgent: false,
  };
}
