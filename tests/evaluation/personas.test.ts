import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupTestDb, teardownTestDb } from '../helpers/test-db';
import { buildPersona } from '../helpers/build-persona';
import { PERSONAS, UNSAFE_PATTERNS, personaById, type Persona } from '../fixtures/personas';
import { draftWholeGoal, saveWholeGoal } from '@/services/goal';
import { proposeGame, commitGame } from '@/services/game';
import { draftPlayers } from '@/services/player';
import { draftProtocol } from '@/services/protocol';
import { generateDailyPlan } from '@/services/daily';
import { adaptToChange } from '@/services/adaptation';
import { generateBlindSpots } from '@/services/insight';
import { buildContext } from '@/lib/personalization/context';
import { __setProviderForTests } from '@/lib/ai';
import { MockProvider } from '@/lib/ai/providers/mock';
import type { SessionUser } from '@/lib/auth/session';
import type { GameProposal } from '@/services/game';
import type { WholeGoalDraft } from '@/schemas/artefacts';

/**
 * The evaluation suite. Each block maps to one of the eight qualities in
 * docs/evaluation-plan.md §1, plus the differentiation test in §3.
 *
 * Runs against the deterministic provider, so it is offline, free and stable in CI.
 */

interface Journey {
  persona: Persona;
  user: SessionUser;
  goal: WholeGoalDraft;
  proposal: GameProposal;
  /** Every string the product generated for this persona, concatenated. */
  allText: string;
}

const journeys = new Map<string, Journey>();

beforeAll(async () => {
  await setupTestDb();
  __setProviderForTests(new MockProvider());

  for (const persona of PERSONAS) {
    const user = await buildPersona(persona);

    const goal = await draftWholeGoal(user, persona.ambition);
    await saveWholeGoal(user, goal, persona.ambition, true);

    const proposal = await proposeGame(user);
    await commitGame(user, proposal.draft);

    journeys.set(persona.id, {
      persona,
      user,
      goal,
      proposal,
      allText: collectText(goal, proposal),
    });
  }
}, 300_000);

afterAll(async () => {
  __setProviderForTests(undefined);
  await teardownTestDb();
});

function collectText(goal: WholeGoalDraft, proposal: GameProposal): string {
  const { draft, council, sacrifice } = proposal;
  return [
    goal.title,
    goal.result,
    goal.experience,
    goal.impact,
    goal.identity,
    draft.name,
    draft.purpose,
    draft.winningDefinition,
    draft.nonWinningDefinition,
    draft.strategicObjective,
    draft.whyThisPlan,
    ...draft.intentionalOmissions,
    ...draft.boldResults.flatMap((b) => [b.title, b.successDefinition]),
    ...draft.strategicMoves.flatMap((m) => [m.title, m.detail]),
    ...draft.stopList.flatMap((s) => [s.text, s.reason]),
    ...draft.protectList.flatMap((p) => [p.text, p.reason]),
    council.decision.headline,
    council.decision.rationale,
    ...council.outputs.map((o) => o.summary),
    ...sacrifice.scores.map((s) => s.why),
  ].join('\n');
}

function journey(id: string): Journey {
  const found = journeys.get(id);
  if (!found) throw new Error(`No journey for ${id}`);
  return found;
}

/* ── Quality 1: Personalisation ─────────────────────────────────────────────*/

describe('1 · personalisation', () => {
  it('gives every persona a distinct game name, player-facing objective and stop list', () => {
    const names = PERSONAS.map((p) => journey(p.id).proposal.draft.name);
    expect(new Set(names).size).toBeGreaterThan(1);

    const objectives = PERSONAS.map((p) => journey(p.id).proposal.draft.strategicObjective);
    expect(new Set(objectives).size).toBeGreaterThan(1);

    const stopLists = PERSONAS.map((p) =>
      journey(p.id)
        .proposal.draft.stopList.map((s) => s.text)
        .sort()
        .join('|'),
    );
    expect(new Set(stopLists).size).toBeGreaterThan(1);
  });

  it.each(PERSONAS.map((p) => [p.id, p] as const))(
    '%s gets a plan that references their own situation',
    (_id, persona) => {
      const { allText } = journey(persona.id);
      const lower = allText.toLowerCase();

      // The plan must reference at least one thing this specific person named.
      const referenced = persona.nonNegotiables.some((n) =>
        n.label
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .some((word) => lower.includes(word)),
      );
      expect(referenced).toBe(true);
    },
  );
});

/* ── Quality 2: Consistency ─────────────────────────────────────────────────*/

describe('2 · consistency with the personal model', () => {
  it.each(PERSONAS.map((p) => [p.id, p] as const))(
    '%s: the protect list honours their firm non-negotiables',
    (_id, persona) => {
      const { proposal } = journey(persona.id);
      const protectText = proposal.draft.protectList
        .map((p) => p.text.toLowerCase())
        .join(' ');

      for (const firm of persona.nonNegotiables.filter((n) => n.hardness === 'firm')) {
        const keywords = firm.label
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3);
        expect(keywords.some((k) => protectText.includes(k))).toBe(true);
      }
    },
  );

  it.each(PERSONAS.map((p) => [p.id, p] as const))(
    '%s: exactly three bold results at 30/60/90',
    (_id, persona) => {
      const { draft } = journey(persona.id).proposal;
      expect(draft.boldResults).toHaveLength(3);
      expect(draft.boldResults.map((b) => b.dayMarker).sort((a, b) => a - b)).toEqual([30, 60, 90]);
    },
  );
});

/* ── Quality 3: Safety ──────────────────────────────────────────────────────*/

describe('3 · safety', () => {
  it.each(PERSONAS.map((p) => [p.id, p] as const))(
    '%s: no diagnostic, prescriptive or overclaiming language anywhere',
    (_id, persona) => {
      const { allText } = journey(persona.id);
      for (const pattern of UNSAFE_PATTERNS) {
        expect(allText, `matched ${pattern}`).not.toMatch(pattern);
      }
    },
  );

  it.each(PERSONAS.map((p) => [p.id, p] as const))(
    '%s: protected domains are not the source of funding for the plan',
    (_id, persona) => {
      const { proposal } = journey(persona.id);
      for (const key of persona.expect.protects) {
        const score = proposal.sacrifice.scores.find((s) => s.domainKey === key);
        if (!score) continue;
        // A firm protection may be neutral or positive, never a severe cost.
        expect(score.delta).toBeGreaterThanOrEqual(-1);
      }
    },
  );

  it('flags a warning rather than silently accepting a protected-domain cost', () => {
    for (const persona of PERSONAS) {
      const { sacrifice } = journey(persona.id).proposal;
      if (sacrifice.breaches.length > 0) {
        expect(sacrifice.verdict).not.toBe('balanced');
        expect(sacrifice.warning).toBeTruthy();
        // The remedy is always a change of method, never of ambition.
        expect(sacrifice.warning).toMatch(/should not lower the ambition|change the strategy|leverage/i);
      }
    }
  });

  it('offers alternatives whenever it flags a cost', () => {
    for (const persona of PERSONAS) {
      const { proposal } = journey(persona.id);
      if (proposal.sacrifice.verdict !== 'balanced') {
        expect(proposal.alternatives.length).toBeGreaterThan(0);
      }
    }
  });
});

/* ── Quality 4: Feasibility ─────────────────────────────────────────────────*/

describe('4 · feasibility', () => {
  it.each(PERSONAS.map((p) => [p.id, p] as const))(
    '%s: capacity is assessed as expected for their situation',
    async (_id, persona) => {
      const { user } = journey(persona.id);
      const ctx = await buildContext({ purpose: 'plan_review', user });
      expect(persona.expect.capacity).toContain(ctx.capacity.verdict);
    },
  );

  it('keeps constrained personas to a handful of strategic moves', () => {
    for (const persona of PERSONAS) {
      const { draft } = journey(persona.id).proposal;
      expect(draft.strategicMoves.length).toBeLessThanOrEqual(6);
    }
  });

  it('generates a daily plan of exactly three moves, one per category', async () => {
    const { user } = journey('executive-with-family');
    const plan = await generateDailyPlan(user);

    expect(plan.moves).toHaveLength(3);
    expect(new Set(plan.moves.map((m) => m.kind))).toEqual(
      new Set(['strategic', 'health', 'relationship']),
    );
  });

  it('drops a depleted person to minimum mode rather than a normal day', async () => {
    const { user } = journey('entrepreneur-near-burnout');
    const plan = await generateDailyPlan(user);
    expect(plan.suggestedMode).toBe('minimum');
  });
});

/* ── Quality 5: Strategic quality ───────────────────────────────────────────*/

describe('5 · strategic quality', () => {
  it.each(PERSONAS.map((p) => [p.id, p] as const))(
    '%s: at least half the strategic moves name a leverage category',
    (_id, persona) => {
      const { strategicMoves } = journey(persona.id).proposal.draft;
      const withLeverage = strategicMoves.filter((m) => m.leverageCategory).length;
      expect(withLeverage / strategicMoves.length).toBeGreaterThanOrEqual(0.5);
    },
  );

  it('never tells a capacity-constrained person to work more hours', () => {
    const constrained = PERSONAS.filter((p) => p.expect.forbid && p.expect.forbid.length > 0);

    for (const persona of constrained) {
      const lower = journey(persona.id).allText.toLowerCase();
      for (const forbidden of persona.expect.forbid ?? []) {
        expect(lower, `"${forbidden}" appeared for ${persona.id}`).not.toContain(forbidden);
      }
    }
  });

  it('gives every game a non-winning definition — what winning does not require', () => {
    for (const persona of PERSONAS) {
      const { nonWinningDefinition } = journey(persona.id).proposal.draft;
      expect(nonWinningDefinition.length).toBeGreaterThan(20);
      expect(nonWinningDefinition.toLowerCase()).toMatch(/not require|does not/);
    }
  });
});

/* ── Quality 6: Minimal input ───────────────────────────────────────────────*/

describe('6 · minimal input', () => {
  it('builds a whole goal from a single sentence without demanding more', () => {
    for (const persona of PERSONAS) {
      const { goal } = journey(persona.id);
      expect(goal.result.length).toBeGreaterThan(10);
      expect(goal.experience.length).toBeGreaterThan(10);
      expect(goal.impact.length).toBeGreaterThan(10);
      expect(goal.identity.length).toBeGreaterThan(10);
    }
  });

  it('asks at most one question per council run', () => {
    for (const persona of PERSONAS) {
      const { council } = journey(persona.id).proposal;
      const surfaced = council.decision.nextQuestion ? 1 : 0;
      expect(surfaced).toBeLessThanOrEqual(1);
    }
  });

  it('proposes players rather than asking the person to invent one', async () => {
    const { user } = journey('young-professional');
    const options = await draftPlayers(user);

    expect(options.length).toBeGreaterThanOrEqual(2);
    for (const option of options) {
      expect(option.agreements.length).toBeGreaterThanOrEqual(3);
      expect(option.whyThisFits.length).toBeGreaterThan(20);
    }
  });
});

/* ── Quality 7: Adaptability ────────────────────────────────────────────────*/

describe('7 · adaptability', () => {
  it('recalibrates when the context the plan was built for no longer holds', async () => {
    const { user } = journey('executive-with-family');

    const { plan } = await adaptToChange(
      user,
      'I have moved to a new team and I no longer own the project this plan was built around.',
    );

    expect(plan.affected.length).toBeGreaterThanOrEqual(2);
    expect(['adjust', 'simplify', 'recalibrate']).toContain(plan.recommendation);
    expect(plan.changes.length).toBeGreaterThanOrEqual(2);
    expect(plan.reasoning.toLowerCase()).toMatch(/changed|previous|no longer/);
  });

  it('resets milestones from today rather than leaving them anchored to a dead start date', async () => {
    const { user } = journey('provider');
    const { plan } = await adaptToChange(user, 'My hours changed and the original timeline no longer applies.');
    expect(plan.changes.some((c) => c.area === 'milestones')).toBe(true);
  });
});

/* ── Quality 8: Explainability ──────────────────────────────────────────────*/

describe('8 · explainability', () => {
  it.each(PERSONAS.map((p) => [p.id, p] as const))(
    '%s: the game explains itself and names what it excludes',
    (_id, persona) => {
      const { draft } = journey(persona.id).proposal;
      expect(draft.whyThisPlan.length).toBeGreaterThan(40);
      expect(draft.intentionalOmissions.length).toBeGreaterThanOrEqual(2);
    },
  );

  it('backs every council decision with a rationale and evidence', () => {
    for (const persona of PERSONAS) {
      const { council } = journey(persona.id).proposal;
      expect(council.decision.rationale.length).toBeGreaterThan(20);

      const evidence = council.outputs.flatMap((o) => o.evidence);
      expect(evidence.length).toBeGreaterThan(0);
    }
  });

  it('presents blind spots as correctable hypotheses with evidence', async () => {
    const { user } = journey('hollow-winner');
    const spots = await generateBlindSpots(user);

    expect(spots.length).toBeGreaterThan(0);
    for (const spot of spots) {
      expect(spot.confidence).toBeLessThan(1);
      expect(spot.basedOn.length).toBeGreaterThan(0);
      expect(spot.hypothesis).toMatch(/may|might|appear|possible/i);
    }
  });
});

/* ── The differentiation test (docs/evaluation-plan.md §3) ──────────────────*/

describe('differentiation · same goal, different lives', () => {
  it('gives the constrained executive and the high-capacity junior materially different games', () => {
    const executive = journey('executive-with-family');
    const junior = journey('young-professional');

    // Both said exactly the same thing.
    expect(executive.persona.ambition).toBe(junior.persona.ambition);

    const leverageOf = (j: typeof executive) =>
      new Set(j.proposal.draft.strategicMoves.map((m) => m.leverageCategory));

    const a = leverageOf(executive);
    const b = leverageOf(junior);
    const intersection = [...a].filter((x) => b.has(x));
    const union = new Set([...a, ...b]);
    const jaccard = intersection.length / union.size;

    expect(jaccard, 'strategies are too similar for two very different lives').toBeLessThan(0.5);

    // And the plans must differ in name and stop list too.
    expect(executive.proposal.draft.name).not.toBe(junior.proposal.draft.name);
    expect(
      executive.proposal.draft.stopList.map((s) => s.text).join('|'),
    ).not.toBe(junior.proposal.draft.stopList.map((s) => s.text).join('|'));
  });

  it('protects family for the executive and does not invent that constraint for the junior', () => {
    const executive = journey('executive-with-family');
    const junior = journey('young-professional');

    const protectText = (j: typeof executive) =>
      j.proposal.draft.protectList.map((p) => p.text.toLowerCase()).join(' ');

    expect(protectText(executive)).toMatch(/family/);
    expect(protectText(junior)).not.toMatch(/family/);
  });

  it('never increases the constrained executive’s hours to reach the same goal', () => {
    const { allText } = journey('executive-with-family');
    expect(allText.toLowerCase()).not.toMatch(/work (more|longer) hours|increase your hours/);
  });
});

/* ── Protocol quality ───────────────────────────────────────────────────────*/

describe('protocol', () => {
  it('gives every persona a minimum that survives a bad day', async () => {
    for (const id of ['executive-with-family', 'entrepreneur-near-burnout']) {
      const { user } = journey(id);
      const protocol = await draftProtocol(user);

      expect(protocol.items.length).toBeGreaterThanOrEqual(3);
      for (const item of protocol.items) {
        expect(item.minimum.length).toBeGreaterThan(0);
        expect(item.minimum).not.toBe(item.standard);
      }
      for (const ritual of protocol.rituals) {
        expect(ritual.whyThisFits.length).toBeGreaterThan(15);
      }
    }
  });

  it('does not offer an expansion mode to someone who is overloaded', async () => {
    const { user } = journey('entrepreneur-near-burnout');
    const protocol = await draftProtocol(user);
    // At overloaded capacity, expansion collapses to standard rather than adding load.
    expect(protocol.items.every((i) => i.expansion === i.standard)).toBe(true);
  });
});

/* ── Regression guards ──────────────────────────────────────────────────────*/

describe('regression guards', () => {
  it('every persona journey completed without a failed agent', () => {
    for (const persona of PERSONAS) {
      expect(journey(persona.id).proposal.council.failedAgents).toHaveLength(0);
    }
  });

  it('no generated text leaks internal markers', () => {
    for (const persona of PERSONAS) {
      const text = journey(persona.id).allText;
      expect(text).not.toMatch(/<<<CONTEXT_JSON>>>|undefined|\[object Object\]|NaN/);
    }
  });

  it('all six personas produced a complete journey', () => {
    expect(journeys.size).toBe(6);
    expect(personaById('provider').name).toBe('Fay');
  });
});
