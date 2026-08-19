import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupTestDb, teardownTestDb } from '../helpers/test-db';
import { schema } from '@/lib/db';
import { createUser, deleteUser, findUserByEmail } from '@/lib/db/repositories/users';
import * as personal from '@/lib/db/repositories/personal-model';
import * as life from '@/lib/db/repositories/life';
import * as gameRepo from '@/lib/db/repositories/game';
import { hashPassword, verifyPassword, validatePassword } from '@/lib/auth/password';
import { recall, remember } from '@/lib/memory';
import { AppError } from '@/lib/errors';
import type { Database } from '@/lib/db/client';
import type { GameDraft } from '@/schemas/artefacts';

let db: Database;
let userId: string;

beforeAll(async () => {
  db = await setupTestDb();
  const created = await createUser({
    name: 'Integration',
    email: 'integration@example.test',
    password: 'a-sufficiently-long-password',
  });
  userId = created.id;
});

afterAll(teardownTestDb);

describe('account creation', () => {
  it('seeds the ten default domains so the Life Map is never blank', async () => {
    const domains = await life.listDomains(userId);
    expect(domains).toHaveLength(10);
    expect(domains.map((d) => d.key)).toContain('career');
    expect(domains.map((d) => d.key)).toContain('family');
  });

  it('creates a profile in the not-started state', async () => {
    const rows = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId));
    expect(rows[0]?.onboardingStage).toBe('not_started');
  });

  it('rejects a duplicate email', async () => {
    await expect(
      createUser({
        name: 'Duplicate',
        email: 'integration@example.test',
        password: 'another-long-password',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('normalises email casing on lookup', async () => {
    const found = await findUserByEmail('  INTEGRATION@Example.Test ');
    expect(found?.id).toBe(userId);
  });
});

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const record = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', record)).toBe(true);
    expect(await verifyPassword('wrong password entirely', record)).toBe(false);
  });

  it('produces a different hash for the same password (per-user salt)', async () => {
    const a = await hashPassword('identical-password');
    const b = await hashPassword('identical-password');
    expect(a.hash).not.toBe(b.hash);
    expect(a.salt).not.toBe(b.salt);
  });

  it('returns false rather than throwing on a corrupt stored record', async () => {
    expect(await verifyPassword('anything', { hash: 'not-hex', salt: 'nope' })).toBe(false);
  });

  it('enforces a length floor', () => {
    expect(validatePassword('short')).toMatch(/at least/i);
    expect(validatePassword('a-perfectly-fine-password')).toBeNull();
  });
});

describe('provenance rules', () => {
  it('refuses to let an agent overwrite what the person said about themselves', async () => {
    await personal.upsertIdentityModel(userId, {
      currentIdentity: 'what I actually said',
      source: 'user_said',
      confidence: 1,
    });

    await personal.upsertIdentityModel(userId, {
      currentIdentity: 'what the model guessed',
      source: 'ai_inferred',
      confidence: 0.6,
    });

    const model = await personal.getIdentityModel(userId);
    expect(model?.currentIdentity).toBe('what I actually said');
  });

  it('allows a user correction to replace an inference', async () => {
    const scratch = await createUser({
      name: 'Scratch',
      email: 'scratch-provenance@example.test',
      password: 'a-sufficiently-long-password',
    });

    await personal.upsertIdentityModel(scratch.id, {
      currentIdentity: 'guessed',
      source: 'ai_inferred',
      confidence: 0.5,
    });
    await personal.upsertIdentityModel(scratch.id, {
      currentIdentity: 'corrected by me',
      source: 'user_confirmed',
      confidence: 1,
    });

    const model = await personal.getIdentityModel(scratch.id);
    expect(model?.currentIdentity).toBe('corrected by me');
  });

  it('marks user-stated claims as confirmed on insert', async () => {
    await personal.addNonNegotiable(userId, {
      label: 'Sleep',
      hardness: 'firm',
      source: 'user_said',
      confidence: 1,
    });
    const items = await personal.listNonNegotiables(userId);
    const sleep = items.find((i) => i.label === 'Sleep');
    expect(sleep?.status).toBe('confirmed');
    expect(sleep?.lastConfirmedAt).not.toBeNull();
  });

  it('promotes an inference to confirmed when the person accepts it', async () => {
    await personal.addValue(userId, {
      label: 'Autonomy',
      source: 'ai_inferred',
      confidence: 0.6,
    });
    const before = (await personal.listValues(userId)).find((v) => v.label === 'Autonomy');
    expect(before?.source).toBe('ai_inferred');

    await personal.confirmClaim(userId, 'values', before!.id);

    const after = (await personal.listValues(userId)).find((v) => v.label === 'Autonomy');
    expect(after?.source).toBe('user_confirmed');
    expect(after?.confidence).toBe(1);
  });
});

describe('life scores', () => {
  it('appends rather than updating, preserving trajectory', async () => {
    const domains = await life.listDomains(userId);
    const career = domains.find((d) => d.key === 'career')!;

    const scores = {
      currentExperience: 5,
      desiredExperience: 8,
      outerResult: 7,
      innerExperience: 4,
      importance: 9,
      energy: 5,
      satisfaction: 4,
      risk: 6,
      momentum: 5,
    };

    await life.recordScores(userId, [
      { domainId: career.id, ...scores, source: 'ai_inferred', confidence: 0.6 },
    ]);
    await life.recordScores(userId, [
      { domainId: career.id, ...scores, outerResult: 9, source: 'user_confirmed', confidence: 1 },
    ]);

    const history = await life.scoreHistory(userId, career.id);
    expect(history.length).toBeGreaterThanOrEqual(2);

    const map = await life.getLifeMap(userId);
    expect(map.find((d) => d.key === 'career')?.scores?.outerResult).toBe(9);
  });

  it('nudges a score without asking for a number', async () => {
    const domains = await life.listDomains(userId);
    const career = domains.find((d) => d.key === 'career')!;

    const before = (await life.getLifeMap(userId)).find((d) => d.key === 'career')!.scores!;
    await life.adjustScore(userId, career.id, 'innerExperience', 'higher');
    const after = (await life.getLifeMap(userId)).find((d) => d.key === 'career')!.scores!;

    expect(after.innerExperience).toBeGreaterThan(before.innerExperience);
  });

  it('deactivates a domain rather than orphaning its scores', async () => {
    const { id } = await life.addCustomDomain(userId, 'Craft');
    expect((await life.listDomains(userId)).some((d) => d.id === id)).toBe(true);

    await life.deactivateDomain(userId, id);
    expect((await life.listDomains(userId)).some((d) => d.id === id)).toBe(false);
  });
});

describe('game invariants', () => {
  function draft(count: number): GameDraft {
    const bold = [30, 60, 90].slice(0, count).map((day) => ({
      title: `Result at ${day}`,
      dayMarker: day as 30 | 60 | 90,
      successDefinition: 'A clear definition of success at this marker.',
      evidence: ['Something written down'],
      leadingIndicators: ['Hours on the leverage move'],
      dependencies: [],
      risks: [],
      confidence: 0.7,
      owner: 'me',
    }));

    return {
      nameOptions: ['A', 'B', 'C'],
      name: 'Test Game',
      purpose: 'A purpose long enough to satisfy the schema constraints for this field.',
      winningDefinition: 'Winning means something specific and long enough to validate.',
      nonWinningDefinition: 'Winning does not require working evenings or weekends at all.',
      strategicObjective: 'Change how the work creates results rather than how much there is.',
      boldResults: bold as GameDraft['boldResults'],
      strategicMoves: [
        {
          title: 'Hand over one recurring responsibility',
          detail: 'Transfer it completely rather than tapering it over time.',
          leverageCategory: 'delegation',
          expectedImpact: 'high',
          effort: 'medium',
        },
        {
          title: 'Make existing work visible',
          detail: 'One standing update that reaches the people who decide.',
          leverageCategory: 'visibility',
          expectedImpact: 'high',
          effort: 'low',
        },
      ],
      stopList: [
        { text: 'Stop saying yes in the moment', reason: 'This is where overload starts.' },
        { text: 'Stop absorbing unowned work', reason: 'It becomes permanently yours.' },
      ],
      protectList: [{ text: 'Sleep', reason: 'Nothing here works if recovery funds it.' }],
      risks: [],
      squad: [],
      whyThisPlan:
        'This plan was built around the constraints you named, prioritising leverage over additional hours because your capacity is already committed.',
      intentionalOmissions: ['We are not adding a second objective.', 'We are not increasing hours.'],
      confidence: 0.75,
    };
  }

  it('persists a complete game with exactly three bold results', async () => {
    const { gameId } = await gameRepo.saveGame(userId, draft(3), { source: 'user_confirmed' });
    const full = await gameRepo.getFullGame(userId);

    expect(full?.game.id).toBe(gameId);
    expect(full?.boldResults).toHaveLength(3);
    expect(full?.boldResults.map((b) => b.dayMarker).sort((a, b) => a - b)).toEqual([30, 60, 90]);
    expect(full?.stopList.length).toBeGreaterThan(0);
    expect(full?.protectList.length).toBeGreaterThan(0);
    expect(full?.game.whyThisPlan.length).toBeGreaterThan(0);
    expect(full?.game.intentionalOmissions.length).toBeGreaterThan(0);
  });

  it('archives the previous game rather than deleting it', async () => {
    await gameRepo.saveGame(userId, { ...draft(3), name: 'Second Game' }, { source: 'user_confirmed' });

    const all = await db.select().from(schema.games).where(eq(schema.games.userId, userId));
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all.filter((g) => g.status === 'completed').length).toBeGreaterThanOrEqual(1);

    const active = await gameRepo.getActiveGame(userId);
    expect(active?.name).toBe('Second Game');
  });

  it('refuses a fourth bold result', async () => {
    const tooMany = draft(3);
    tooMany.boldResults = [
      ...tooMany.boldResults,
      { ...tooMany.boldResults[0]!, title: 'A fourth' },
    ] as GameDraft['boldResults'];

    await expect(
      gameRepo.saveGame(userId, tooMany, { source: 'user_confirmed' }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('memory', () => {
  it('supersedes a keyed fact rather than accumulating contradictions', async () => {
    await remember(userId, {
      layer: 'dynamic',
      key: 'current_focus',
      value: 'first value',
      source: 'ai_inferred',
      confidence: 0.6,
    });
    await remember(userId, {
      layer: 'dynamic',
      key: 'current_focus',
      value: 'second value',
      source: 'ai_inferred',
      confidence: 0.7,
    });

    const recalled = await recall(userId, 'dynamic', 20);
    const matches = recalled.filter((m) => m.key === 'current_focus');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.value).toBe('second value');
  });

  it('will not let an inference overwrite a user-stated memory', async () => {
    await remember(userId, {
      layer: 'stable',
      key: 'core_value',
      value: 'what I said',
      source: 'user_said',
      confidence: 1,
    });
    await remember(userId, {
      layer: 'stable',
      key: 'core_value',
      value: 'what was guessed',
      source: 'ai_inferred',
      confidence: 0.9,
    });

    const recalled = await recall(userId, 'stable', 20);
    expect(recalled.find((m) => m.key === 'core_value')?.value).toBe('what I said');
  });

  it('accumulates episodic memories rather than superseding them', async () => {
    await remember(userId, {
      layer: 'episodic',
      key: 'event:1',
      value: 'first event',
      source: 'user_said',
      confidence: 1,
    });
    await remember(userId, {
      layer: 'episodic',
      key: 'event:2',
      value: 'second event',
      source: 'user_said',
      confidence: 1,
    });

    const recalled = await recall(userId, 'episodic', 20);
    expect(recalled.length).toBeGreaterThanOrEqual(2);
  });
});

describe('deletion', () => {
  it('cascades to every user-owned table', async () => {
    const doomed = await createUser({
      name: 'Doomed',
      email: 'doomed@example.test',
      password: 'a-sufficiently-long-password',
    });

    await personal.addValue(doomed.id, {
      label: 'Something',
      source: 'user_said',
      confidence: 1,
    });
    await remember(doomed.id, {
      layer: 'stable',
      key: 'k',
      value: 'v',
      source: 'user_said',
      confidence: 1,
    });

    await deleteUser(doomed.id);

    const [values, memories, domains, profiles] = await Promise.all([
      db.select().from(schema.values).where(eq(schema.values.userId, doomed.id)),
      db.select().from(schema.memoryItems).where(eq(schema.memoryItems.userId, doomed.id)),
      db.select().from(schema.lifeDomains).where(eq(schema.lifeDomains.userId, doomed.id)),
      db.select().from(schema.profiles).where(eq(schema.profiles.userId, doomed.id)),
    ]);

    expect(values).toHaveLength(0);
    expect(memories).toHaveLength(0);
    expect(domains).toHaveLength(0);
    expect(profiles).toHaveLength(0);
  });
});

describe('tenant scoping', () => {
  it('never returns another user’s rows', async () => {
    const other = await createUser({
      name: 'Other',
      email: 'other-tenant@example.test',
      password: 'a-sufficiently-long-password',
    });

    await personal.addValue(other.id, {
      label: 'Their private value',
      source: 'user_said',
      confidence: 1,
    });

    const mine = await personal.listValues(userId);
    expect(mine.some((v) => v.label === 'Their private value')).toBe(false);

    const theirMap = await life.getLifeMap(other.id);
    const myMap = await life.getLifeMap(userId);
    expect(theirMap.every((d) => myMap.every((m) => m.id !== d.id))).toBe(true);
  });
});
