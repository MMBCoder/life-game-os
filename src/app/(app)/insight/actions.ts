'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth/session';
import { generateBlindSpots, generateInsightPlan } from '@/services/insight';
import * as personal from '@/lib/db/repositories/personal-model';
import { fail, ok, type ActionResult } from '@/lib/errors';

export async function generatePlanAction(): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    await generateInsightPlan(user);
    await generateBlindSpots(user);
    revalidatePath('/insight');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

type ClaimTable = 'values' | 'strengths' | 'constraints' | 'non_negotiables' | 'blind_spots' | 'insights';

export async function confirmClaimAction(
  table: ClaimTable,
  id: string,
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    await personal.confirmClaim(user.id, table, id);
    revalidatePath('/insight');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function rejectClaimAction(
  table: ClaimTable,
  id: string,
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    await personal.rejectClaim(user.id, table, id);
    revalidatePath('/insight');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
