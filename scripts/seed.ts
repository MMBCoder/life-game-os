/**
 * Seeds a realistic demo account and walks it through the full product journey, so
 * `npm run dev` opens onto a working system rather than an empty one.
 *
 *   npm run db:seed
 *
 * The persona is synthetic. No real person's information is used.
 */
import { runMigrations } from '../src/lib/db/migrate';
import { createUser, findUserByEmail, setOnboardingStage } from '../src/lib/db/repositories/users';
import * as personal from '../src/lib/db/repositories/personal-model';
import * as life from '../src/lib/db/repositories/life';
import { rememberMany } from '../src/lib/memory';
import { draftWholeGoal, saveWholeGoal } from '../src/services/goal';
import { proposeGame, commitGame } from '../src/services/game';
import { draftPlayers, choosePlayer } from '../src/services/player';
import { draftProtocol, saveProtocol } from '../src/services/protocol';
import { generateDailyPlan, assessState, refreshMomentum } from '../src/services/daily';
import { runWeeklyReview } from '../src/services/reflection';
import { generateInsightPlan, generateBlindSpots } from '../src/services/insight';
import { askPlayer } from '../src/services/player';
import type { SessionUser } from '../src/lib/auth/session';

const DEMO = {
  name: 'Maya',
  email: 'demo@lifegameos.local',
  password: 'demo-account-password',
  timezone: 'Europe/London',
  ambition:
    'I want to be leading strategy rather than running delivery, and I want to still be there for bedtime.',
};

async function main() {
  console.log('Applying migrations…');
  await runMigrations();

  const existing = await findUserByEmail(DEMO.email);
  if (existing) {
    console.log(`\n✓ Demo account already exists.\n  Email: ${DEMO.email}\n  Password: ${DEMO.password}`);
    console.log('  Run `npm run db:reset` first if you want to rebuild it.');
    process.exit(0);
  }

  console.log('Creating demo account…');
  const created = await createUser({
    name: DEMO.name,
    email: DEMO.email,
    password: DEMO.password,
    timezone: DEMO.timezone,
    isDemo: true,
  });

  const user: SessionUser = {
    id: created.id,
    email: DEMO.email,
    name: DEMO.name,
    timezone: DEMO.timezone,
    isDemo: true,
  };

  console.log('Building the personal model…');
  await buildPersonalModel(user);

  console.log('Drafting the whole goal…');
  const goal = await draftWholeGoal(user, DEMO.ambition);
  await saveWholeGoal(user, goal, DEMO.ambition, true);

  console.log('Designing the player…');
  const players = await draftPlayers(user);
  if (players[0]) await choosePlayer(user, players[0]);

  console.log('Convening the council to design the game…');
  const proposal = await proposeGame(user);
  await commitGame(user, proposal.draft);

  console.log('Building the protocol…');
  const protocol = await draftProtocol(user);
  await saveProtocol(user, protocol);

  console.log('Planning today…');
  await assessState(user);
  await generateDailyPlan(user);

  console.log('Recording a first weekly review…');
  await runWeeklyReview(user, {
    moved: ['Handed over the weekly ops report', 'Booked the strategy conversation'],
    didntMove: ['The positioning document'],
    surprises: 'How easy the handover conversation actually was.',
    feeling: 'Lighter, and slightly suspicious of it.',
    costMoreThanExpected: 'Context switching between delivery and strategy work.',
    gaveEnergy: 'The strategy conversation.',
    shouldChange: 'Protect one uninterrupted block rather than trying to find gaps.',
  });

  await refreshMomentum(user);

  console.log('Generating insight plan and blind spots…');
  await generateInsightPlan(user);
  await generateBlindSpots(user);

  console.log('Recording a Player decision…');
  await askPlayer(
    user,
    'Should I take on the new cross-team programme?',
    'It is high visibility but it would run for two quarters and I would be the only senior person on it.',
  );

  console.log(`
✓ Demo account ready.

  Email:    ${DEMO.email}
  Password: ${DEMO.password}

  Sign in and open /dashboard to see the full journey:
  personal model → life map → whole goal → player → game →
  sacrifice radar → protocol → daily play → reflection → council.
`);
  process.exit(0);
}

/**
 * The demo persona: senior enough to have real leverage available, constrained
 * enough that the trade-offs are genuine. Career ambition, firm family protection,
 * health under pressure, and no spare hours — the situation the product exists for.
 */
async function buildPersonalModel(user: SessionUser) {
  await personal.upsertIdentityModel(user.id, {
    currentIdentity: 'the person delivery routes through',
    emergingIdentity: 'someone trusted with the direction, not just the output',
    desiredIdentity: 'a strategic leader whose absence is not a risk',
    identityTensions: [
      'Wants more scope and has no more hours',
      'Being indispensable feels like safety and is the actual bottleneck',
    ],
    motivators: ['Building something durable', 'Being trusted with real decisions'],
    fears: ['Becoming a parent her children only see tired'],
    naturalTendencies: ['Absorbs unowned work', 'Solves rather than delegates'],
    source: 'user_said',
    confidence: 1,
  });

  const values: Array<[string, number]> = [
    ['Family', 10],
    ['Leadership', 9],
    ['Integrity', 9],
    ['Craft', 7],
  ];
  for (const [label, importance] of values) {
    await personal.addValue(user.id, { label, importance, source: 'user_said', confidence: 1 });
  }

  await personal.addStrength(user.id, {
    label: 'Reads a room and a situation quickly',
    kind: 'strength',
    source: 'user_said',
    confidence: 1,
  });
  await personal.addStrength(user.id, {
    label: 'Reliable to the point of becoming the bottleneck',
    kind: 'overdone',
    source: 'ai_inferred',
    confidence: 0.7,
  });

  await personal.addConstraint(user.id, {
    label: 'Two children under eight at home',
    category: 'responsibility',
    severity: 'high',
    source: 'user_said',
    confidence: 1,
  });
  await personal.addConstraint(user.id, {
    label: 'Calendar is fully booked most weeks',
    category: 'time',
    severity: 'high',
    source: 'user_said',
    confidence: 1,
  });
  await personal.addConstraint(user.id, {
    label: 'Energy drops sharply after 4pm',
    category: 'energy',
    severity: 'medium',
    source: 'ai_inferred',
    confidence: 0.65,
  });

  await personal.addNonNegotiable(user.id, {
    label: 'Bedtime with my children',
    domainKey: 'family',
    hardness: 'firm',
    source: 'user_said',
    confidence: 1,
  });
  await personal.addNonNegotiable(user.id, {
    label: 'Sleep',
    domainKey: 'health',
    hardness: 'firm',
    source: 'user_said',
    confidence: 1,
  });
  await personal.addNonNegotiable(user.id, {
    label: 'Weekends',
    domainKey: 'family',
    hardness: 'strong',
    source: 'user_said',
    confidence: 1,
  });

  await personal.addPattern(user.id, {
    label: 'Says yes in the moment',
    pattern:
      'Requests are accepted at the point they are made, before capacity has been checked.',
    trigger: 'Being asked directly by someone senior',
    impact: 'Commitments accumulate faster than they are retired',
    source: 'ai_inferred',
    confidence: 0.68,
  });

  // A life map with the divergence the product is built to surface: career strong
  // on the outside, thin on the inside, with health and self paying for it.
  const domains = await life.listDomains(user.id);
  const idByKey = new Map(domains.map((d) => [d.key, d.id]));

  const scores: Record<
    string,
    [number, number, number, number, number, number, number, number, number]
  > = {
    // current, desired, outer, inner, importance, energy, satisfaction, risk, momentum
    career: [6, 9, 8.5, 5, 9, 5, 5, 6, 6],
    family: [6.5, 9.5, 6, 7, 10, 5, 6.5, 8, 5],
    health: [4, 8, 4.5, 4, 8, 3.5, 4, 7.5, 4],
    self: [3.5, 8, 4, 3, 7, 3, 3.5, 7, 3.5],
    relationships: [5, 8, 5, 5, 7, 4.5, 5, 5, 4.5],
    finance: [7, 8, 7.5, 7, 6, 6, 7, 3, 6],
    growth: [5, 8.5, 5, 6, 7.5, 6, 6, 4, 5],
    purpose: [6, 9, 6, 5.5, 8, 5.5, 5.5, 5, 5],
    joy: [4, 8, 4, 4, 6.5, 4, 4, 6, 4],
    impact: [6, 9, 6.5, 6, 7.5, 6, 6, 4, 5.5],
  };

  await life.recordScores(
    user.id,
    Object.entries(scores)
      .map(([key, v]) => {
        const domainId = idByKey.get(key);
        if (!domainId) return null;
        return {
          domainId,
          currentExperience: v[0],
          desiredExperience: v[1],
          outerResult: v[2],
          innerExperience: v[3],
          importance: v[4],
          energy: v[5],
          satisfaction: v[6],
          risk: v[7],
          momentum: v[8],
          basis: 'Confirmed during discovery.',
          source: 'user_confirmed' as const,
          confidence: 1,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null),
  );

  await rememberMany(user.id, [
    {
      layer: 'stable',
      key: 'what_matters',
      value: 'Family, Leadership, Integrity',
      source: 'user_said',
      confidence: 1,
    },
    {
      layer: 'stable',
      key: 'must_not_sacrifice',
      value: 'Bedtime with my children, Sleep, Weekends',
      source: 'user_said',
      confidence: 1,
    },
    {
      layer: 'dynamic',
      key: 'twelve_month_ambition',
      value: DEMO.ambition,
      source: 'user_said',
      confidence: 1,
    },
    {
      layer: 'episodic',
      key: 'seed:context',
      value: 'Took on the delivery lead role eighteen months ago and it never stopped growing.',
      source: 'user_said',
      confidence: 1,
    },
  ]);

  await personal.addObservation(user.id, {
    text: DEMO.ambition,
    channel: 'onboarding',
  });
  await personal.addObservation(user.id, {
    text: 'Most weeks end with work carried into the evening after the children are asleep.',
    channel: 'conversation',
  });

  await setOnboardingStage(user.id, 'complete', true);
}

main().catch((error: unknown) => {
  console.error('✗ Seed failed:', error instanceof Error ? error.stack : error);
  process.exit(1);
});
