import { describe, expect, it } from 'vitest';
import {
  INTENTION_LADDER,
  INTENTION_MAX,
  INTENTION_MIN,
  intentionAt,
} from '@/lib/intention/scale';
import { computeIntention, liftLever, type IntentionInputs } from '@/lib/scoring/intention';
import { resolveNextStep, type NextStepInputs } from '@/lib/guidance/next-step';

/** A person doing well: aligned, moving, resourced, protecting what matters. */
const THRIVING: IntentionInputs = {
  alignment: 9,
  momentum: 9,
  followThrough: 1,
  energy: 8,
  capacity: 8,
  sacrificeVerdict: 'balanced',
  blockingConflicts: 0,
  hasGame: true,
  confirmed: true,
};

describe('the intention ladder', () => {
  it('defines every rung from -7 to +7 exactly once', () => {
    const levels = INTENTION_LADDER.map((r) => r.level);
    const expected = Array.from({ length: 15 }, (_, i) => INTENTION_MAX - i);

    expect(levels).toEqual(expected);
    expect(new Set(levels).size).toBe(15);
  });

  it('pairs every rung with both an experience and an energetic output', () => {
    for (const rung of INTENTION_LADDER) {
      expect(rung.stance.length).toBeGreaterThan(0);
      expect(rung.energy.length).toBeGreaterThan(0);
      expect(rung.experience.length).toBeGreaterThan(20);
      expect(rung.putting.length).toBeGreaterThan(20);
    }
  });

  it('clamps out-of-range lookups instead of throwing at the caller', () => {
    expect(intentionAt(99).level).toBe(INTENTION_MAX);
    expect(intentionAt(-99).level).toBe(INTENTION_MIN);
    expect(intentionAt(2.4).level).toBe(2);
  });
});

describe('computeIntention', () => {
  it('places a thriving, aligned person in the upper bands', () => {
    const reading = computeIntention(THRIVING);

    expect(reading.level).toBeGreaterThanOrEqual(5);
    expect(reading.detail.tone).toBe('protect');
  });

  it('never returns a level outside the ladder, whatever the inputs', () => {
    const extremes: IntentionInputs[] = [
      { ...THRIVING, alignment: 100, momentum: 100, followThrough: 9 },
      {
        ...THRIVING,
        alignment: -50,
        momentum: -50,
        followThrough: -3,
        energy: -10,
        capacity: -10,
        sacrificeVerdict: 'warning',
        blockingConflicts: 99,
      },
      { ...THRIVING, alignment: Number.NaN, momentum: Number.NaN, energy: Number.NaN },
    ];

    for (const input of extremes) {
      const { level } = computeIntention(input);
      expect(level).toBeGreaterThanOrEqual(INTENTION_MIN);
      expect(level).toBeLessThanOrEqual(INTENTION_MAX);
    }
  });

  it('treats hard effort spent against yourself as drag, not lift', () => {
    // High momentum and follow-through, but depleted and breaching a protection:
    // working extremely hard is not the same as operating intentionally.
    const forcing = computeIntention({
      ...THRIVING,
      energy: 2,
      capacity: 2,
      sacrificeVerdict: 'warning',
      blockingConflicts: 1,
    });

    // The arithmetic alone would score this positively — lift genuinely exceeds drag.
    // The categorical ceilings are what stop effort buying a good reading.
    expect(forcing.lift).toBeGreaterThan(8);
    expect(forcing.level).toBeLessThanOrEqual(-2);
    expect(forcing.detail.band).toBe('sacrificing');
    expect(forcing.lowering).toContain('The plan is currently spending something you protected');
  });

  it('caps the level without a game, because there is nothing to be intentional toward', () => {
    const noGame = computeIntention({ ...THRIVING, hasGame: false, confirmed: false });
    expect(noGame.level).toBeLessThanOrEqual(1);
  });

  it('caps the level on a plan that was received but never confirmed', () => {
    const unconfirmed = computeIntention({ ...THRIVING, confirmed: false });
    expect(unconfirmed.level).toBeLessThanOrEqual(4);
  });

  it('is deterministic — the same inputs always read the same level', () => {
    const a = computeIntention(THRIVING);
    const b = computeIntention({ ...THRIVING });
    expect(a.level).toBe(b.level);
    expect(a.explanation).toBe(b.explanation);
  });

  it('always explains itself, so the reading can be argued with', () => {
    const reading = computeIntention(THRIVING);
    expect(reading.explanation).toMatch(/\d/);
    expect(reading.raising.length).toBeGreaterThan(0);
  });

  it('never describes the person, only the stance, at the very bottom of the ladder', () => {
    const worst = computeIntention({
      ...THRIVING,
      alignment: 0,
      momentum: 0,
      followThrough: 0,
      energy: 0,
      capacity: 0,
      sacrificeVerdict: 'warning',
      blockingConflicts: 3,
    });

    expect(worst.level).toBe(INTENTION_MIN);
    // Safety: the lowest rung must not pathologise. No clinical vocabulary anywhere.
    const text = `${worst.detail.experience} ${worst.detail.putting}`.toLowerCase();
    for (const banned of ['depress', 'disorder', 'diagnos', 'illness', 'burnout syndrome']) {
      expect(text).not.toContain(banned);
    }
  });
});

describe('liftLever', () => {
  it('names designing the game before anything else when there is none', () => {
    const inputs = { ...THRIVING, hasGame: false };
    expect(liftLever(computeIntention(inputs), inputs)).toMatch(/design the game/i);
  });

  it('prioritises a breached protection over every other lever', () => {
    const inputs = { ...THRIVING, blockingConflicts: 1, energy: 1, followThrough: 0 };
    expect(liftLever(computeIntention(inputs), inputs)).toMatch(/protection/i);
  });

  it('recommends recovering capacity rather than pushing through it', () => {
    const inputs = { ...THRIVING, energy: 3 };
    expect(liftLever(computeIntention(inputs), inputs)).toMatch(/minimum protocol/i);
  });
});

const READY: NextStepInputs = {
  onboardingComplete: true,
  hasGame: true,
  gameConfirmed: true,
  blockingConflicts: 0,
  sacrificeVerdict: 'balanced',
  hasProtocol: true,
  plannedToday: true,
  movesTotal: 3,
  movesDone: 3,
  daysSinceWeeklyReview: 2,
};

describe('resolveNextStep', () => {
  it('sends an unonboarded person to discovery first', () => {
    expect(resolveNextStep({ ...READY, onboardingComplete: false }).kind).toBe('discover');
  });

  it('interrupts for a breached protection ahead of ordinary progress', () => {
    const step = resolveNextStep({
      ...READY,
      blockingConflicts: 1,
      hasGame: false,
      plannedToday: false,
      hasProtocol: false,
    });

    expect(step.kind).toBe('resolve_breach');
    expect(step.urgent).toBe(true);
  });

  it('ranks a strategy warning above planning the day', () => {
    const step = resolveNextStep({ ...READY, sacrificeVerdict: 'warning', plannedToday: false });
    expect(step.kind).toBe('review_sacrifice');
  });

  it('walks a new account through the build order', () => {
    expect(resolveNextStep({ ...READY, hasGame: false }).kind).toBe('design_game');
    expect(resolveNextStep({ ...READY, hasProtocol: false }).kind).toBe('build_protocol');
    expect(resolveNextStep({ ...READY, plannedToday: false, movesTotal: 0 }).kind).toBe(
      'plan_today',
    );
  });

  it('asks for the remaining moves once the day is planned', () => {
    const step = resolveNextStep({ ...READY, movesDone: 1 });
    expect(step.kind).toBe('run_moves');
    expect(step.label).toContain('2');
  });

  it('asks for the weekly review when one is overdue or has never run', () => {
    expect(resolveNextStep({ ...READY, daysSinceWeeklyReview: null }).kind).toBe('weekly_review');
    expect(resolveNextStep({ ...READY, daysSinceWeeklyReview: 9 }).kind).toBe('weekly_review');
  });

  it('says so plainly when nothing needs the person', () => {
    const step = resolveNextStep(READY);
    expect(step.kind).toBe('current');
    expect(step.urgent).toBe(false);
  });

  it('always gives a reason, never a bare instruction', () => {
    const variants: NextStepInputs[] = [
      { ...READY, onboardingComplete: false },
      { ...READY, hasGame: false },
      { ...READY, blockingConflicts: 2 },
      { ...READY, movesDone: 0 },
      READY,
    ];

    for (const input of variants) {
      const step = resolveNextStep(input);
      expect(step.why.length).toBeGreaterThan(30);
      expect(step.label.length).toBeGreaterThan(0);
    }
  });
});
