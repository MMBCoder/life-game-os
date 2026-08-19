'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/session';
import { draftWholeGoal, saveWholeGoal, setPriorityDimension } from '@/services/goal';
import { fail, failWith, ok, type ActionResult } from '@/lib/errors';
import { wholeGoalDraft, type WholeGoalDraft } from '@/schemas/artefacts';

export async function draftGoalAction(raw: string): Promise<ActionResult<WholeGoalDraft>> {
  try {
    const user = await requireSession();
    const clean = raw.trim();
    if (clean.length < 5) {
      return failWith('Tell us a little more — even a rough sentence is enough.');
    }
    const draft = await draftWholeGoal(user, clean);
    return ok(draft);
  } catch (error) {
    return fail(error);
  }
}

export async function saveGoalAction(
  draft: unknown,
  rawInput: string,
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    const parsed = wholeGoalDraft.safeParse(draft);
    if (!parsed.success) return failWith('That goal is missing something. Try regenerating it.');

    await saveWholeGoal(user, parsed.data, rawInput, true);
    revalidatePath('/goal');
    revalidatePath('/dashboard');
    revalidatePath('/game');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

const dimensionSchema = z.enum(['result', 'experience', 'impact', 'identity']);

export async function setDimensionAction(
  goalId: string,
  dimension: string,
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    const parsed = dimensionSchema.safeParse(dimension);
    if (!parsed.success) return failWith('Unknown dimension.');

    await setPriorityDimension(user, goalId, parsed.data);
    revalidatePath('/goal');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
