'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth/session';
import {
  generateReset,
  runDailyReflection,
  runMonthlyReview,
  runWeeklyReview,
  type WeeklyAnswers,
} from '@/services/reflection';
import { refreshMomentum } from '@/services/daily';
import { fail, failWith, ok, type ActionResult } from '@/lib/errors';
import type { MonthlyReview, ResetOptions, WeeklyIntelligence } from '@/schemas/artefacts';

export async function weeklyReviewAction(
  answers: WeeklyAnswers,
): Promise<ActionResult<WeeklyIntelligence>> {
  try {
    const user = await requireSession();
    if (answers.moved.length === 0 && answers.didntMove.length === 0) {
      return failWith('Name at least one thing that moved or did not — even "nothing" is useful.');
    }

    const intelligence = await runWeeklyReview(user, answers);
    await refreshMomentum(user);
    revalidatePath('/reflection');
    revalidatePath('/dashboard');
    return ok(intelligence);
  } catch (error) {
    return fail(error);
  }
}

export async function dailyReflectionAction(input: {
  moved: string[];
  didntMove: string[];
  feeling?: string;
}): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    await runDailyReflection(user, input);
    revalidatePath('/reflection');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function monthlyReviewAction(): Promise<ActionResult<MonthlyReview>> {
  try {
    const user = await requireSession();
    const review = await runMonthlyReview(user);
    revalidatePath('/reflection');
    revalidatePath('/game');
    return ok(review);
  } catch (error) {
    return fail(error);
  }
}

export async function resetAction(cause: string): Promise<ActionResult<ResetOptions>> {
  try {
    const user = await requireSession();
    if (cause.trim().length < 3) return failWith('Pick what got in the way.');
    return ok(await generateReset(user, cause.trim()));
  } catch (error) {
    return fail(error);
  }
}
