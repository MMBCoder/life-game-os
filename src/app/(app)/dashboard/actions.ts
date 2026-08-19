'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth/session';
import { generateDailyPlan, assessState, refreshMomentum, acceptMomentum, overrideState } from '@/services/daily';
import * as execution from '@/lib/db/repositories/execution';
import { fail, ok, type ActionResult } from '@/lib/errors';
import { todayIn } from '@/lib/date';
import type { OperatingState, PlanMode } from '@/schemas/common';

export async function generateTodayAction(): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    // State first: the day plan should be sized to how the person actually is.
    await assessState(user);
    await generateDailyPlan(user);
    await refreshMomentum(user);
    revalidatePath('/dashboard');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function setActionStatusAction(
  actionId: string,
  status: 'planned' | 'done' | 'skipped',
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    await execution.setActionStatus(user.id, actionId, status);
    revalidatePath('/dashboard');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function setModeAction(mode: PlanMode): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    await execution.setDayMode(user.id, todayIn(user.timezone), mode);
    revalidatePath('/dashboard');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function overrideStateAction(
  state: OperatingState,
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    await overrideState(user, state);
    revalidatePath('/dashboard');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function acceptMomentumAction(level: number): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    await acceptMomentum(user, level);
    revalidatePath('/dashboard');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
