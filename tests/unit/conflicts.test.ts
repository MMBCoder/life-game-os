import { describe, expect, it } from 'vitest';
import { detectConflicts, isBlocking } from '@/lib/scoring/conflicts';
import type { AgentOutput } from '@/schemas/agent';
import type { CouncilContext } from '@/lib/personalization/context-types';

/**
 * Conflict detection is the mechanism that makes the product's core promise
 * architectural rather than aspirational, so it is tested more heavily than
 * anything else here.
 */

function ctx(overrides: Partial<CouncilContext> = {}): CouncilContext {
  return {
    purpose: 'plan_review',
    user: { name: 'Test', timezone: 'UTC', today: '2026-01-15' },
    profile: { role: null, lifeStage: null, onboardingStage: 'complete' },
    identity: null,
    values: [],
    strengths: [],
    constraints: [],
    nonNegotiables: [],
    patterns: [],
    domains: [],
    goal: null,
    player: null,
    game: null,
    protocol: null,
    capacity: {
      availableHoursPerWeek: 50,
      committedHoursPerWeek: 30,
      load: 0.6,
      energyLevel: 7,
      verdict: 'balanced',
    },
    state: null,
    recentReflections: [],
    recentDecisions: [],
    memory: { stable: [], dynamic: [], episodic: [] },
    ask: { question: null, detail: null, payload: {} },
    peerOutputs: [],
    ...overrides,
  };
}

function agent(overrides: Partial<AgentOutput>): AgentOutput {
  return {
    agent: 'strategy',
    status: 'suggested',
    confidence: 0.8,
    summary: 'A summary.',
    reasoning: [],
    insights: [],
    recommendations: [],
    risks: [],
    questions: [],
    proposedChanges: [],
    objections: [],
    evidence: [],
    ...overrides,
  };
}

describe('non-negotiable breach', () => {
  it('blocks a change that would spend a firm protection', () => {
    const conflicts = detectConflicts(
      [
        agent({
          proposedChanges: [
            {
              target: 'actions',
              operation: 'create',
              payload: { title: 'Reduce family evenings to two per week' },
              rationale: 'more focus time',
            },
          ],
        }),
      ],
      ctx({
        nonNegotiables: [{ label: 'Family evenings', domainKey: 'family', hardness: 'firm' }],
      }),
    );

    const breach = conflicts.find((c) => c.kind === 'non_negotiable_breach');
    expect(breach).toBeDefined();
    expect(breach?.severity).toBe('critical');
    expect(isBlocking(conflicts)).toBe(true);
  });

  it('does not fire when a protection is merely mentioned, not spent', () => {
    const conflicts = detectConflicts(
      [
        agent({
          proposedChanges: [
            {
              target: 'protect_list',
              operation: 'create',
              payload: { text: 'Protect family evenings' },
              rationale: 'guard it explicitly',
            },
          ],
        }),
      ],
      ctx({
        nonNegotiables: [{ label: 'Family evenings', domainKey: 'family', hardness: 'firm' }],
      }),
    );

    expect(conflicts.filter((c) => c.kind === 'non_negotiable_breach')).toHaveLength(0);
  });

  it('ignores non-firm protections at this level', () => {
    const conflicts = detectConflicts(
      [
        agent({
          proposedChanges: [
            {
              target: 'actions',
              operation: 'create',
              payload: { title: 'Reduce family evenings' },
              rationale: 'focus',
            },
          ],
        }),
      ],
      ctx({
        nonNegotiables: [{ label: 'Family evenings', domainKey: 'family', hardness: 'preference' }],
      }),
    );
    expect(conflicts.filter((c) => c.kind === 'non_negotiable_breach')).toHaveLength(0);
  });
});

describe('guardian veto', () => {
  it('records a high-severity health objection as a blocking veto', () => {
    const conflicts = detectConflicts(
      [
        agent({
          agent: 'health',
          objections: [
            {
              against: 'strategy',
              claim: 'Recovery is already being borrowed against.',
              severity: 'critical',
              basis: 'health',
            },
          ],
        }),
      ],
      ctx(),
    );

    const veto = conflicts.find((c) => c.kind === 'guardian_veto');
    expect(veto?.raisedBy).toBe('health');
    expect(veto?.resolvedInFavourOf).toBe('health');
    expect(isBlocking(conflicts)).toBe(true);
  });

  it('does not treat a low-severity guardian note as a veto', () => {
    const conflicts = detectConflicts(
      [
        agent({
          agent: 'relationships',
          objections: [
            { against: 'strategy', claim: 'Worth watching.', severity: 'low', basis: 'relationships' },
          ],
        }),
      ],
      ctx(),
    );
    expect(conflicts.filter((c) => c.kind === 'guardian_veto')).toHaveLength(0);
  });

  it('gives no veto rights to non-guardian agents', () => {
    const conflicts = detectConflicts(
      [
        agent({
          agent: 'goal',
          objections: [
            { against: 'strategy', claim: 'I disagree strongly.', severity: 'critical', basis: 'strategy' },
          ],
        }),
      ],
      ctx(),
    );
    expect(conflicts.filter((c) => c.kind === 'guardian_veto')).toHaveLength(0);
  });
});

describe('capacity overrun', () => {
  const overloaded = ctx({
    capacity: {
      availableHoursPerWeek: 40,
      committedHoursPerWeek: 39,
      load: 0.98,
      energyLevel: 4,
      verdict: 'overloaded',
    },
  });

  it('flags an additive recommendation when there is no room', () => {
    const conflicts = detectConflicts(
      [
        agent({
          recommendations: [
            {
              title: 'Take on a new initiative',
              detail: 'Add a second visible project this quarter.',
              rationale: 'visibility',
              priority: 'high',
            },
          ],
        }),
      ],
      overloaded,
    );

    const overrun = conflicts.find((c) => c.kind === 'capacity_overrun');
    expect(overrun).toBeDefined();
    expect(overrun?.severity).toBe('high');
  });

  it('accepts an additive recommendation that also removes something', () => {
    const conflicts = detectConflicts(
      [
        agent({
          recommendations: [
            {
              title: 'Take on a new initiative and stop the reporting workstream',
              detail: 'Add the project, end the recurring report.',
              rationale: 'net neutral',
              priority: 'high',
            },
          ],
        }),
      ],
      overloaded,
    );
    expect(conflicts.filter((c) => c.kind === 'capacity_overrun')).toHaveLength(0);
  });

  it('stays quiet when there is headroom', () => {
    const conflicts = detectConflicts(
      [
        agent({
          recommendations: [
            {
              title: 'Take on a new initiative',
              detail: 'Add a project.',
              rationale: 'growth',
              priority: 'high',
            },
          ],
        }),
      ],
      ctx(),
    );
    expect(conflicts.filter((c) => c.kind === 'capacity_overrun')).toHaveLength(0);
  });
});

describe('priority overload', () => {
  it('reduces a plan that has grown past three priorities', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      title: `Priority ${i}`,
      detail: 'Detail here.',
      rationale: 'Because.',
      priority: 'high' as const,
    }));

    const conflicts = detectConflicts([agent({ recommendations: many })], ctx());
    const overload = conflicts.find((c) => c.kind === 'priority_overload');

    expect(overload).toBeDefined();
    expect(overload?.claim).toMatch(/too many/i);
    expect(overload?.resolution).toMatch(/backlog/i);
  });

  it('allows exactly three', () => {
    const three = Array.from({ length: 3 }, (_, i) => ({
      title: `Priority ${i}`,
      detail: 'Detail here.',
      rationale: 'Because.',
      priority: 'high' as const,
    }));
    const conflicts = detectConflicts([agent({ recommendations: three })], ctx());
    expect(conflicts.filter((c) => c.kind === 'priority_overload')).toHaveLength(0);
  });
});

describe('contradictory changes', () => {
  it('resolves a create/remove split in favour of the smaller plan', () => {
    const conflicts = detectConflicts(
      [
        agent({
          agent: 'strategy',
          proposedChanges: [
            { target: 'actions', operation: 'create', payload: {}, rationale: 'add it' },
          ],
        }),
        agent({
          agent: 'capacity',
          proposedChanges: [
            { target: 'actions', operation: 'remove', payload: {}, rationale: 'no room' },
          ],
        }),
      ],
      ctx(),
    );

    const contradiction = conflicts.find((c) => c.kind === 'contradictory_change');
    expect(contradiction?.resolvedInFavourOf).toBe('capacity');
  });
});

describe('red team blocks', () => {
  it('escalates a high-severity, high-likelihood risk with its mitigation', () => {
    const conflicts = detectConflicts(
      [
        agent({
          agent: 'redTeam',
          risks: [
            {
              title: 'Plan runs alongside the old load',
              detail: 'Nothing is stopped first.',
              severity: 'high',
              likelihood: 'high',
              mitigation: 'Complete the stop list in week one.',
            },
          ],
        }),
      ],
      ctx(),
    );

    const block = conflicts.find((c) => c.kind === 'red_team_block');
    expect(block?.resolution).toMatch(/stop list/i);
    expect(isBlocking(conflicts)).toBe(true);
  });

  it('does not block on a low-likelihood risk', () => {
    const conflicts = detectConflicts(
      [
        agent({
          agent: 'redTeam',
          risks: [
            {
              title: 'Unlikely problem',
              detail: 'Edge case.',
              severity: 'high',
              likelihood: 'low',
              mitigation: 'Monitor.',
            },
          ],
        }),
      ],
      ctx(),
    );
    expect(conflicts.filter((c) => c.kind === 'red_team_block')).toHaveLength(0);
  });
});

describe('ordering', () => {
  it('surfaces the most severe conflict first', () => {
    const conflicts = detectConflicts(
      [
        agent({
          recommendations: Array.from({ length: 5 }, (_, i) => ({
            title: `P${i}`,
            detail: 'x'.repeat(12),
            rationale: 'y'.repeat(12),
            priority: 'high' as const,
          })),
        }),
        agent({
          agent: 'health',
          objections: [
            { against: 'strategy', claim: 'Unacceptable recovery risk.', severity: 'critical', basis: 'health' },
          ],
        }),
      ],
      ctx(),
    );

    expect(conflicts[0]?.severity).toBe('critical');
  });

  it('returns nothing for a clean plan', () => {
    const conflicts = detectConflicts([agent({})], ctx());
    expect(conflicts).toHaveLength(0);
    expect(isBlocking(conflicts)).toBe(false);
  });
});
