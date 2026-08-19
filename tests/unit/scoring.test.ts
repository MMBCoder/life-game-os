import { describe, expect, it } from 'vitest';
import { assessCapacity, canAbsorb } from '@/lib/scoring/capacity';
import { computeMomentum, bandFor } from '@/lib/scoring/momentum';
import { assessSacrifice } from '@/lib/scoring/sacrifice';
import { computeGameHealth } from '@/lib/scoring/game-health';
import { analyseDivergence } from '@/lib/scoring/divergence';

describe('capacity', () => {
  it('treats energy as a multiplier on usable hours, not on the clock', () => {
    const rested = assessCapacity({
      availableHoursPerWeek: 50,
      committedHoursPerWeek: 35,
      energyLevel: 9,
    });
    const depleted = assessCapacity({
      availableHoursPerWeek: 50,
      committedHoursPerWeek: 35,
      energyLevel: 2,
    });

    // Same calendar, materially less capacity — the distinction the product insists on.
    expect(depleted.load).toBeGreaterThan(rested.load);
    expect(depleted.availableHoursPerWeek).toBe(rested.availableHoursPerWeek);
  });

  it('flags overload before the calendar is literally full', () => {
    const result = assessCapacity({
      availableHoursPerWeek: 40,
      committedHoursPerWeek: 38,
      energyLevel: 5,
    });
    expect(result.verdict).toBe('overloaded');
    expect(result.headroomHours).toBe(0);
  });

  it('reports headroom when genuinely under-committed', () => {
    const result = assessCapacity({
      availableHoursPerWeek: 50,
      committedHoursPerWeek: 20,
      energyLevel: 8,
    });
    expect(result.verdict).toBe('headroom');
    expect(canAbsorb(result, 5)).toBe(true);
  });

  it('never divides by zero on a nonsensical week', () => {
    const result = assessCapacity({
      availableHoursPerWeek: 0,
      committedHoursPerWeek: 10,
      energyLevel: 0,
    });
    expect(Number.isFinite(result.load)).toBe(true);
  });
});

describe('momentum', () => {
  const base = {
    clarity: 5,
    commitment: 5,
    alignment: 5,
    action: 5,
    capacity: 5,
    consistency: 5,
    resistance: 5,
  };

  it('stays within 1..10', () => {
    const low = computeMomentum({
      clarity: 0,
      commitment: 0,
      alignment: 0,
      action: 0,
      capacity: 0,
      consistency: 0,
      resistance: 0,
    });
    const high = computeMomentum({
      clarity: 10,
      commitment: 10,
      alignment: 10,
      action: 10,
      capacity: 10,
      consistency: 10,
      resistance: 10,
    });
    expect(low.level).toBe(1);
    expect(high.level).toBe(10);
  });

  it('weights clarity and commitment above the rest', () => {
    const clearButIdle = computeMomentum({ ...base, clarity: 10, commitment: 10, action: 0 });
    const busyButUnclear = computeMomentum({ ...base, clarity: 0, commitment: 0, action: 10 });
    expect(clearButIdle.level).toBeGreaterThan(busyButUnclear.level);
  });

  it('always explains itself', () => {
    const result = computeMomentum({ ...base, clarity: 9, capacity: 2 });
    expect(result.explanation.length).toBeGreaterThan(10);
    expect(result.explanation).toMatch(/clarity|capacity/i);
  });

  it('maps levels to bands', () => {
    expect(bandFor(1)).toBe('passive');
    expect(bandFor(6)).toBe('committing');
    expect(bandFor(10)).toBe('fully_aligned');
  });
});

describe('sacrifice', () => {
  const protectedDomains = [
    { domainKey: 'family', label: 'Family time', hardness: 'firm' as const },
    { domainKey: 'health', label: 'Sleep', hardness: 'strong' as const },
  ];

  it('treats any cost to a firm non-negotiable as a breach', () => {
    const result = assessSacrifice(
      [
        { domainKey: 'career', delta: 3, why: 'focus lands here' },
        { domainKey: 'family', delta: -1, why: 'some evenings' },
      ],
      protectedDomains,
    );

    expect(result.breaches).toHaveLength(1);
    expect(result.verdict).toBe('warning');
    expect(result.warning).toMatch(/family time/i);
  });

  it('tolerates a nudge against a strong — but not firm — protection', () => {
    const result = assessSacrifice(
      [
        { domainKey: 'career', delta: 3, why: 'focus' },
        { domainKey: 'health', delta: -1, why: 'slightly later nights' },
      ],
      protectedDomains,
    );
    expect(result.breaches).toHaveLength(0);
  });

  it('never resolves a warning by suggesting less ambition', () => {
    const result = assessSacrifice(
      [
        { domainKey: 'career', delta: 3, why: 'focus' },
        { domainKey: 'family', delta: -2, why: 'evenings' },
      ],
      protectedDomains,
    );
    expect(result.warning).toMatch(/should not lower the ambition/i);
  });

  it('reports balanced when nothing protected is touched', () => {
    const result = assessSacrifice(
      [
        { domainKey: 'career', delta: 2, why: 'focus' },
        { domainKey: 'family', delta: 0, why: 'unchanged' },
      ],
      protectedDomains,
    );
    expect(result.verdict).toBe('balanced');
    expect(result.warning).toBeNull();
  });
});

describe('game health', () => {
  const strong = {
    goalClarity: 9,
    strategicCoherence: 9,
    capacityLoad: 0.5,
    alignment: 9,
    healthProtection: 9,
    familyProtection: 9,
    executionConsistency: 0.9,
    evidenceOfProgress: 0.8,
    adaptability: 8,
  };

  it('rewards a coherent, protected, feasible plan', () => {
    const result = computeGameHealth(strong);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.band).toBe('strong');
  });

  it('penalises capacity overload even when everything else is good', () => {
    const overloaded = computeGameHealth({ ...strong, capacityLoad: 1 });
    expect(overloaded.score).toBeLessThan(computeGameHealth(strong).score);
    expect(overloaded.watch).toContain('Capacity');
  });

  it('penalises a plan with no protection', () => {
    const unprotected = computeGameHealth({
      ...strong,
      healthProtection: 1,
      familyProtection: 1,
    });
    expect(unprotected.watch).toContain('Health protection');
    expect(unprotected.score).toBeLessThan(75);
  });
});

describe('divergence', () => {
  it('identifies outer success masking inner cost', () => {
    const [top] = analyseDivergence([
      {
        key: 'career',
        label: 'Career',
        scores: {
          currentExperience: 6,
          desiredExperience: 8,
          outerResult: 9,
          innerExperience: 4,
          importance: 9,
          energy: 4,
          satisfaction: 4,
          risk: 7,
          momentum: 6,
        },
      },
    ]);

    expect(top?.kind).toBe('unsustainable_success');
    expect(top?.statement).toMatch(/unsustainable cost/i);
  });

  it('identifies a neglected priority', () => {
    const [top] = analyseDivergence([
      {
        key: 'health',
        label: 'Health',
        scores: {
          currentExperience: 3,
          desiredExperience: 9,
          outerResult: 3,
          innerExperience: 3,
          importance: 9,
          energy: 3,
          satisfaction: 3,
          risk: 8,
          momentum: 3,
        },
      },
    ]);
    expect(top?.kind).toBe('neglected_priority');
  });

  it('omits aligned domains entirely', () => {
    const result = analyseDivergence([
      {
        key: 'joy',
        label: 'Joy',
        scores: {
          currentExperience: 7,
          desiredExperience: 8,
          outerResult: 7,
          innerExperience: 7,
          importance: 6,
          energy: 7,
          satisfaction: 7,
          risk: 3,
          momentum: 6,
        },
      },
    ]);
    expect(result).toHaveLength(0);
  });
});
