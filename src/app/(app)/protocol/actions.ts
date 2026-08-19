'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth/session';
import { draftProtocol, saveProtocol } from '@/services/protocol';
import { fail, failWith, ok, type ActionResult } from '@/lib/errors';
import { protocolDraft, type ProtocolDraft } from '@/schemas/artefacts';

export async function draftProtocolAction(): Promise<ActionResult<ProtocolDraft>> {
  try {
    const user = await requireSession();
    return ok(await draftProtocol(user));
  } catch (error) {
    return fail(error);
  }
}

export async function saveProtocolAction(draft: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    const parsed = protocolDraft.safeParse(draft);
    if (!parsed.success) return failWith('That protocol is incomplete. Try generating it again.');

    await saveProtocol(user, parsed.data);
    revalidatePath('/protocol');
    revalidatePath('/dashboard');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
