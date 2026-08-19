'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/session';
import { runOnboarding, recordSnapshotFeedback } from '@/services/onboarding';
import { fail, failWith, ok, type ActionResult } from '@/lib/errors';
import type { PersonalSnapshot } from '@/schemas/artefacts';

const answersSchema = z.object({
  matters: z.array(z.string().trim().min(1).max(80)).min(1).max(5),
  twelveMonths: z.string().trim().min(10).max(2000),
  notSacrificed: z.array(z.string().trim().min(1).max(120)).min(1).max(6),
});

export async function submitDiscoveryAction(
  input: unknown,
): Promise<ActionResult<PersonalSnapshot>> {
  try {
    const user = await requireSession();
    const parsed = answersSchema.safeParse(input);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === 'twelveMonths') {
        return failWith('A sentence or two is enough — just tell us what would be different.');
      }
      return failWith('Pick at least one option for each question.');
    }

    const snapshot = await runOnboarding(user, parsed.data);
    revalidatePath('/dashboard');
    return ok(snapshot);
  } catch (error) {
    return fail(error);
  }
}

export async function confirmSnapshotAction(
  verdict: 'close' | 'partly' | 'off',
  correction?: string,
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    await recordSnapshotFeedback(user, verdict, correction?.trim() || undefined);
    revalidatePath('/dashboard');
    revalidatePath('/life');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
