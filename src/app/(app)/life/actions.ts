'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth/session';
import * as life from '@/lib/db/repositories/life';
import { estimateLifeMap } from '@/services/lifemap';
import { fail, ok, type ActionResult } from '@/lib/errors';
import type { DomainScores } from '@/lib/personalization/context-types';

export async function adjustScoreAction(
  domainId: string,
  field: keyof DomainScores,
  direction: 'lower' | 'right' | 'higher',
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    await life.adjustScore(user.id, domainId, field, direction);
    revalidatePath('/life');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function estimateAction(): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    await estimateLifeMap(user);
    revalidatePath('/life');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function addDomainAction(label: string): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    const clean = label.trim();
    if (clean.length < 2) return fail(new Error('too short'));
    await life.addCustomDomain(user.id, clean);
    revalidatePath('/life');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function removeDomainAction(domainId: string): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    // Deactivates rather than deletes, so historical scores are not orphaned.
    await life.deactivateDomain(user.id, domainId);
    revalidatePath('/life');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
