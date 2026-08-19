'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireSession, destroySession } from '@/lib/auth/session';
import { deleteUser, updateTimezone } from '@/lib/db/repositories/users';
import { fail, failWith, ok, type ActionResult } from '@/lib/errors';

export async function updateTimezoneAction(timezone: string): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    // Validate against the platform's own zone table rather than a hand-written list.
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone });
    } catch {
      return failWith('That timezone was not recognised.');
    }
    await updateTimezone(user.id, timezone);
    revalidatePath('/settings');
    revalidatePath('/dashboard');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

/**
 * Hard delete. Cascades through every user-owned table — this is not a soft flag,
 * and it cannot be undone. The confirmation phrase is enforced server-side so a
 * mis-click in the UI cannot trigger it.
 */
export async function deleteAccountAction(confirmation: string): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    if (confirmation.trim().toLowerCase() !== 'delete everything') {
      return failWith('Type “delete everything” exactly to confirm.');
    }
    await deleteUser(user.id);
    await destroySession();
  } catch (error) {
    return fail(error);
  }
  redirect('/');
}
