import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupTestDb, teardownTestDb } from '../helpers/test-db';
import { createUser, findUserByEmail, getProfile, setOnboardingStage } from '@/lib/db/repositories/users';
import { verifyPassword } from '@/lib/auth/password';
import * as personal from '@/lib/db/repositories/personal-model';
import * as life from '@/lib/db/repositories/life';
import * as gameRepo from '@/lib/db/repositories/game';
import * as execution from '@/lib/db/repositories/execution';
import { recall, remember } from '@/lib/memory';
import { gameDraft, type GameDraft } from '@/schemas/artefacts';

/**
 * "Sign out, sign back in with the same credentials, find everything where I left it."
 *
 * Signing in does not create data — it identifies an account. Everything the person
 * builds is keyed to their `userId`, and sessions are separate short-lived rows. This
 * file pins that down end to end, because it is the difference between an app people
 * can rely on and one that quietly resets.
 */

const EMAIL = 'returning@example.test';
const PASSWORD = 'a-sufficiently-long-password';

let firstUserId: string;

beforeAll(async () => {
  await setupTestDb();

  const created = await createUser({
    name: 'Returning',
    email: EMAIL,
    password: PASSWORD,
    timezone: 'Europe/London',
  });
  firstUserId = created.id;

  // ── A first session's worth of real work ────────────────────────────────
  await personal.addNonNegotiable(firstUserId, {
    label: 'Bedtime with my children',
    domainKey: 'family',
    hardness: 'firm',
    source: 'user_said',
    confidence: 1,
  });

  const domains = await life.listDomains(firstUserId);
  const career = domains.find((d) => d.key === 'career');
  if (career) {
    await life.recordScores(firstUserId, [
      {
        domainId: career.id,
        currentExperience: 6,
        desiredExperience: 9,
        outerResult: 8,
        innerExperience: 5,
        importance: 9,
        energy: 5,
        satisfaction: 5,
        risk: 6,
        momentum: 6,
        basis: 'Confirmed during discovery.',
        source: 'user_confirmed',
        confidence: 1,
      },
    ]);
  }

  // Parsed through the real schema so this fixture cannot drift out of shape
  // silently — a wrong field name fails here rather than at the insert.
  const draft: GameDraft = gameDraft.parse({
    nameOptions: ['The Handover Quarter', 'Leading Not Delivering', 'The Strategic Shift'],
    name: 'The Handover Quarter',
    purpose: 'Move from being the person delivery routes through to the person who sets its direction.',
    winningDefinition:
      'Leading strategy conversations, with bedtime and sleep untouched throughout the quarter.',
    nonWinningDefinition:
      'A wider remit that gets paid for out of the evenings, or a title with the same work under it.',
    strategicObjective: 'Lead the direction rather than run the delivery.',
    boldResults: [
      {
        title: 'Hand over weekly delivery reporting',
        dayMarker: 30,
        successDefinition: 'Someone else owns and publishes it without review.',
        evidence: ['The report ships without me'],
        leadingIndicators: ['A named owner has run it twice'],
        confidence: 0.7,
      },
      {
        title: 'Run one strategy review',
        dayMarker: 60,
        successDefinition: 'Held, minuted, and a decision came out of it.',
        evidence: ['Minutes circulated'],
        leadingIndicators: ['A date is in the calendar'],
        confidence: 0.65,
      },
      {
        title: 'Publish the positioning note',
        dayMarker: 90,
        successDefinition: 'Circulated to leadership and referenced by someone else.',
        evidence: ['Note sent'],
        leadingIndicators: ['A first draft exists'],
        confidence: 0.6,
      },
    ],
    strategicMoves: [
      {
        title: 'Name a delivery owner',
        detail: 'Pick one person and transfer the reporting to them over two weeks.',
        leverageCategory: 'delegation',
        expectedImpact: 'high',
        effort: 'medium',
      },
      {
        title: 'Protect one uninterrupted strategy block',
        detail: 'One recurring block a week, defended like a meeting with the CEO.',
        leverageCategory: 'focus',
        expectedImpact: 'high',
        effort: 'low',
      },
    ],
    stopList: [
      { text: 'Attending every delivery stand-up', reason: 'It reinforces the role being left behind.' },
      { text: 'Reviewing work already signed off', reason: 'It buys nothing and costs an hour a day.' },
    ],
    protectList: [
      { text: 'Bedtime with my children', reason: 'Named as firm and non-negotiable.' },
    ],
    whyThisPlan:
      'The constraint is not ambition, it is hours. Every bold result here returns capacity before it asks for any, so the shift is funded by leverage rather than by the evenings.',
    intentionalOmissions: [
      'We are not adding a second major objective this quarter.',
      'We are not increasing working hours.',
    ],
    confidence: 0.7,
  });
  const game = await gameRepo.saveGame(firstUserId, draft, { source: 'user_confirmed' });
  await gameRepo.activateGame(firstUserId, game.gameId);

  await execution.recordState(firstUserId, {
    operatingState: 'stretched',
    confidence: 0.8,
    drivers: ['Calendar is full'],
    focus: 6,
    energy: 4,
    alignment: 7,
    capacity: 4,
  });

  await remember(firstUserId, {
    layer: 'stable',
    key: 'must_not_sacrifice',
    value: 'Bedtime with my children',
    source: 'user_said',
    confidence: 1,
  });

  await setOnboardingStage(firstUserId, 'complete', true);
});

afterAll(teardownTestDb);

describe('signing back in with the same credentials', () => {
  it('resolves to the same account, not a new one', async () => {
    const found = await findUserByEmail(EMAIL);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(firstUserId);
  });

  it('accepts the original password against the stored hash', async () => {
    const found = await findUserByEmail(EMAIL);
    if (!found) throw new Error('expected the account to exist');

    await expect(
      verifyPassword(PASSWORD, { hash: found.passwordHash, salt: found.passwordSalt }),
    ).resolves.toBe(true);
    await expect(
      verifyPassword('the-wrong-password-entirely', {
        hash: found.passwordHash,
        salt: found.passwordSalt,
      }),
    ).resolves.toBe(false);
  });

  it('is matched case-insensitively, so a capitalised email is the same account', async () => {
    const found = await findUserByEmail('Returning@Example.Test');
    expect(found?.id).toBe(firstUserId);
  });

  it('does not send a returning user back through onboarding', async () => {
    const profile = await getProfile(firstUserId);
    expect(profile?.onboardingStage).toBe('complete');
  });
});

describe('what the returning user finds', () => {
  it('still has the protections they set', async () => {
    const nonNegotiables = await personal.listNonNegotiables(firstUserId);

    expect(nonNegotiables).toHaveLength(1);
    expect(nonNegotiables[0]?.label).toBe('Bedtime with my children');
    expect(nonNegotiables[0]?.hardness).toBe('firm');
  });

  it('still has their committed game, with all three bold results', async () => {
    const full = await gameRepo.getFullGame(firstUserId);

    expect(full).not.toBeNull();
    expect(full?.game.name).toBe('The Handover Quarter');
    expect(full?.game.status).toBe('active');
    expect(full?.boldResults).toHaveLength(3);
  });

  it('still has their life map, including the outer/inner split they scored', async () => {
    const map = await life.getLifeMap(firstUserId);
    const career = map.find((d) => d.key === 'career');

    expect(career?.scores?.outerResult).toBe(8);
    expect(career?.scores?.innerExperience).toBe(5);
    expect(career?.source).toBe('user_confirmed');
  });

  it('resumes from the last recorded state rather than a blank one', async () => {
    const state = await execution.latestState(firstUserId);

    expect(state?.operatingState).toBe('stretched');
    expect(state?.capacity).toBe(4);
  });

  it('still remembers what they said must not be sacrificed', async () => {
    const memories = await recall(firstUserId, 'stable');
    expect(memories.map((m) => m.value)).toContain('Bedtime with my children');
  });
});

describe('a different person signing up', () => {
  it('gets their own empty account and cannot see the first one’s work', async () => {
    const other = await createUser({
      name: 'Someone Else',
      email: 'other-returning@example.test',
      password: 'another-sufficiently-long-password',
    });

    expect(other.id).not.toBe(firstUserId);
    expect(await gameRepo.getFullGame(other.id)).toBeNull();
    expect(await personal.listNonNegotiables(other.id)).toHaveLength(0);
    expect(await execution.latestState(other.id)).toBeNull();

    // And the first account is untouched by the second existing.
    expect((await gameRepo.getFullGame(firstUserId))?.game.name).toBe('The Handover Quarter');
  });
});
