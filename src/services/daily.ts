import 'server-only';
import { buildContext } from '@/lib/personalization/context';
import { generateArtefact } from './generate';
import { dailyPlan, stateAssessment, type DailyPlan } from '@/schemas/artefacts';
import * as execution from '@/lib/db/repositories/execution';
import * as gameRepo from '@/lib/db/repositories/game';
import { computeMomentum, type MomentumComponents } from '@/lib/scoring/momentum';
import { todayIn, weekRange } from '@/lib/date';
import type { OperatingState } from '@/schemas/common';
import type { SessionUser } from '@/lib/auth/session';

/**
 * Today's three moves: one strategic, one for the self, one for a relationship.
 *
 * The composition is fixed by construction rather than left to intention, because a
 * day made of three strategic moves is how protected domains quietly lose.
 */
export async function generateDailyPlan(user: SessionUser): Promise<DailyPlan> {
  const today = todayIn(user.timezone);
  const ctx = await buildContext({
    purpose: 'daily_plan',
    user,
    ask: { question: 'What are today’s three moves?' },
  });

  const { data } = await generateArtefact({
    agent: 'execution',
    schema: dailyPlan,
    schemaName: 'DailyPlan',
    ctx,
    instruction: [
      'Produce exactly three moves for today: one strategic, one health or self, one relationship.',
      'Size them to the person’s current capacity and energy, not to an ideal day.',
      'The council note is one concise, personal observation — the most useful thing they could hear this morning, not a summary of the plan.',
      'The one decision should be genuinely consequential and answerable today.',
    ].join('\n'),
  });

  const game = await gameRepo.getActiveGame(user.id);
  await execution.saveDailyPlan(user.id, today, data, game?.id ?? null);
  return data;
}

/** Assesses the current Operating State. Always overridable by the person. */
export async function assessState(user: SessionUser): Promise<void> {
  const ctx = await buildContext({
    purpose: 'daily_plan',
    user,
    ask: { question: 'What is this person’s current operating state?' },
  });

  const { data } = await generateArtefact({
    agent: 'reality',
    schema: stateAssessment,
    schemaName: 'StateAssessment',
    ctx,
    instruction: [
      'Assess the current operating state. This is a dynamic state, never a personality label and never clinical.',
      'Give the drivers behind it plainly — the person can and should be able to disagree with your read.',
    ].join('\n'),
  });

  await execution.recordState(user.id, {
    operatingState: data.state,
    confidence: data.confidence,
    drivers: data.drivers,
    focus: data.focus,
    energy: data.energy,
    alignment: data.alignment,
    capacity: data.capacity,
  });
}

export async function overrideState(
  user: SessionUser,
  state: OperatingState,
): Promise<void> {
  const latest = await execution.latestState(user.id);
  await execution.recordState(user.id, {
    operatingState: state,
    confidence: 1,
    drivers: ['You told us directly'],
    focus: latest?.focus ?? 5,
    energy: latest?.energy ?? 5,
    alignment: latest?.alignment ?? 5,
    capacity: latest?.capacity ?? 5,
    userOverride: true,
  });
}

/**
 * Intentional Momentum. Every input is measured from real state, and the component
 * breakdown is stored so the score can always be shown rather than asserted.
 */
export async function refreshMomentum(user: SessionUser) {
  const today = todayIn(user.timezone);
  const week = weekRange(today);
  const ctx = await buildContext({ purpose: 'daily_plan', user });

  const [full, completion, state, reflections] = await Promise.all([
    gameRepo.getFullGame(user.id),
    execution.completionRate(user.id, week.start, week.end),
    execution.latestState(user.id),
    execution.listReflections(user.id, undefined, 4),
  ]);

  const goal = await gameRepo.getPrimaryGoal(user.id);
  const confirmedGame = full?.game.status === 'active';

  const components: MomentumComponents = {
    clarity: goal ? (full ? 9 : 6) : 2,
    commitment: confirmedGame ? 9 : full ? 5 : 2,
    alignment: state?.alignment ?? (goal ? 6 : 3),
    action: completion.total > 0 ? completion.rate * 10 : 2,
    capacity: Math.max(0, 10 - ctx.capacity.load * 10),
    // Four reflections is treated as a steady rhythm; fewer scales down from there.
    consistency: Math.min(10, reflections.length * 2.5),
    resistance: computeResistance(reflections),
  };

  const result = computeMomentum(components);
  await execution.recordMomentum(user.id, {
    level: result.level,
    computed: result.level,
    components,
    explanation: result.explanation,
  });

  return result;
}

/**
 * Resistance is inverted: a high score means little is being deferred. Derived from
 * how much the person reports as not moving, which is the most honest signal
 * available without surveillance.
 */
function computeResistance(
  reflections: Array<{ moved: string[]; didntMove: string[] }>,
): number {
  if (reflections.length === 0) return 5;
  const moved = reflections.reduce((sum, r) => sum + r.moved.length, 0);
  const stalled = reflections.reduce((sum, r) => sum + r.didntMove.length, 0);
  if (moved + stalled === 0) return 5;
  return Math.max(0, Math.min(10, (moved / (moved + stalled)) * 10));
}

export async function acceptMomentum(user: SessionUser, level: number): Promise<void> {
  const latest = await execution.latestMomentum(user.id);
  if (!latest) return;
  await execution.recordMomentum(user.id, {
    level,
    computed: latest.computed,
    components: latest.components,
    explanation:
      level === latest.computed
        ? latest.explanation
        : `${latest.explanation} You adjusted this to ${level}.`,
    accepted: true,
  });
}
