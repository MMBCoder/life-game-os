import 'server-only';
import { buildContext } from '@/lib/personalization/context';
import { generateArtefact } from './generate';
import {
  monthlyReview,
  resetOptions,
  weeklyIntelligence,
  type MonthlyReview,
  type ResetOptions,
  type WeeklyIntelligence,
} from '@/schemas/artefacts';
import * as execution from '@/lib/db/repositories/execution';
import { persistCouncilRun } from '@/lib/db/repositories/council';
import { convene } from '@/agents/orchestrator';
import { remember } from '@/lib/memory';
import { monthRange, todayIn, weekRange } from '@/lib/date';
import type { SessionUser } from '@/lib/auth/session';

export interface WeeklyAnswers {
  moved: string[];
  didntMove: string[];
  surprises?: string;
  feeling?: string;
  costMoreThanExpected?: string;
  gaveEnergy?: string;
  shouldChange?: string;
}

/**
 * Weekly review. Very few questions, mostly quick selection — the analysis is the
 * system's job, not the person's (spec §37).
 */
export async function runWeeklyReview(
  user: SessionUser,
  answers: WeeklyAnswers,
): Promise<WeeklyIntelligence> {
  const today = todayIn(user.timezone);
  const week = weekRange(today);

  const reflection = await execution.saveReflection(user.id, {
    kind: 'weekly',
    periodStart: week.start,
    periodEnd: week.end,
    moved: answers.moved,
    didntMove: answers.didntMove,
    surprises: answers.surprises ?? null,
    feeling: answers.feeling ?? null,
    costMoreThanExpected: answers.costMoreThanExpected ?? null,
    gaveEnergy: answers.gaveEnergy ?? null,
    shouldChange: answers.shouldChange ?? null,
  });

  const ctx = await buildContext({
    purpose: 'weekly_review',
    user,
    ask: {
      question: 'Analyse this week.',
      detail: `Moved: ${answers.moved.join(', ') || 'nothing named'}. Did not move: ${answers.didntMove.join(', ') || 'nothing named'}.`,
      payload: { ...answers },
    },
  });

  const { data } = await generateArtefact({
    agent: 'reflection',
    schema: weeklyIntelligence,
    schemaName: 'WeeklyIntelligence',
    ctx,
    instruction: [
      'Analyse this week and produce the weekly intelligence.',
      'Distinguish a single event from a pattern. Any pattern is a hypothesis with confidence, never a conclusion.',
      'The recommended adjustment must be one thing, specific enough to do on Monday.',
      'Give exactly three moves for next week.',
    ].join('\n'),
  });

  await execution.attachIntelligence(user.id, reflection.id, data as unknown as Record<string, unknown>);

  await remember(user.id, {
    layer: 'episodic',
    key: `week:${week.end}`,
    value: data.progress,
    context: data.insight,
    source: 'ai_generated',
    confidence: data.confidence,
  });

  return data;
}

export async function runDailyReflection(
  user: SessionUser,
  input: { moved: string[]; didntMove: string[]; feeling?: string },
): Promise<void> {
  const today = todayIn(user.timezone);
  await execution.saveReflection(user.id, {
    kind: 'daily',
    periodStart: today,
    periodEnd: today,
    moved: input.moved,
    didntMove: input.didntMove,
    feeling: input.feeling ?? null,
  });

  // A daily reflection is a light run: two agents, no synthesis, no red team.
  const ctx = await buildContext({
    purpose: 'daily_reflection',
    user,
    ask: { question: 'Reflect on today.', payload: { ...input } },
  });
  const council = await convene(ctx);
  await persistCouncilRun(user.id, council);
}

/**
 * Monthly review. Its real job is the question at the end: is this still the right
 * game? Without it, people pursue goals set for a situation that has since changed.
 */
export async function runMonthlyReview(user: SessionUser): Promise<MonthlyReview> {
  const today = todayIn(user.timezone);
  const month = monthRange(today);

  const ctx = await buildContext({
    purpose: 'monthly_review',
    user,
    ask: { question: 'Is this still the right game?' },
  });

  const council = await convene(ctx);
  await persistCouncilRun(user.id, council);

  const { data } = await generateArtefact({
    agent: 'adaptation',
    schema: monthlyReview,
    schemaName: 'MonthlyReview',
    ctx: {
      ...ctx,
      peerOutputs: council.outputs.map((o) => ({
        agent: o.agent,
        summary: o.summary,
        confidence: o.confidence,
        recommendations: o.recommendations.map((r) => r.title),
        risks: o.risks.map((r) => r.title),
        objections: o.objections.map((ob) => ({
          against: ob.against,
          claim: ob.claim,
          severity: ob.severity,
        })),
      })),
    },
    instruction: [
      'Compare where this person started with where they are now, and answer the question the product exists to force: is this still the right game?',
      'Choose continue, adjust, simplify, or change_game, and justify it from the evidence rather than from encouragement.',
      'Use domain keys from context.domains.',
    ].join('\n'),
  });

  const reflection = await execution.saveReflection(user.id, {
    kind: 'monthly',
    periodStart: month.start,
    periodEnd: month.end,
  });
  await execution.attachIntelligence(
    user.id,
    reflection.id,
    data as unknown as Record<string, unknown>,
  );

  return data;
}

/**
 * Reset Your Game. Runs when momentum drops.
 *
 * The framing is deliberate: never "you failed". A drop is information about the
 * plan, and the plan is what changes.
 */
export async function generateReset(
  user: SessionUser,
  whatHappened: string,
): Promise<ResetOptions> {
  const ctx = await buildContext({
    purpose: 'adaptation',
    user,
    ask: {
      question: 'Help this person reset.',
      detail: whatHappened,
    },
  });

  const { data } = await generateArtefact({
    agent: 'adaptation',
    schema: resetOptions,
    schemaName: 'ResetOptions',
    ctx,
    instruction: [
      `Something got in the way: "${whatHappened}"`,
      'Acknowledge it without judgement — this is information about the plan, not a failure of the person.',
      'Give exactly three reset options at genuinely different effort levels, so there is one they can do today regardless of how the week is going.',
    ].join('\n'),
  });

  await remember(user.id, {
    layer: 'episodic',
    key: `reset:${todayIn(user.timezone)}`,
    value: whatHappened,
    source: 'user_said',
    confidence: 1,
  });

  return data;
}

// RESET_CAUSES lives in src/lib/copy.ts so the reset UI can import it without
// pulling this module's server-only dependencies into the client bundle.
