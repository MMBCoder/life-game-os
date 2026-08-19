'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth/session';
import { askPlayer, choosePlayer, draftPlayers } from '@/services/player';
import * as gameRepo from '@/lib/db/repositories/game';
import { fail, failWith, ok, type ActionResult } from '@/lib/errors';
import { playerDraft, type PlayerDecision, type PlayerDraft } from '@/schemas/artefacts';

export async function draftPlayersAction(): Promise<ActionResult<PlayerDraft[]>> {
  try {
    const user = await requireSession();
    return ok(await draftPlayers(user));
  } catch (error) {
    return fail(error);
  }
}

export async function choosePlayerAction(draft: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    const parsed = playerDraft.safeParse(draft);
    if (!parsed.success) return failWith('That player is incomplete. Try regenerating.');

    await choosePlayer(user, parsed.data);
    revalidatePath('/player');
    revalidatePath('/dashboard');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function askPlayerAction(
  question: string,
  detail?: string,
): Promise<ActionResult<{ verdict: PlayerDecision; decisionId: string }>> {
  try {
    const user = await requireSession();
    const clean = question.trim();
    if (clean.length < 8) {
      return failWith('Give us the decision in a sentence — what are you weighing up?');
    }

    const result = await askPlayer(user, clean, detail?.trim() || undefined);
    revalidatePath('/player');
    revalidatePath('/council');
    return ok({ verdict: result.verdict, decisionId: result.decision.id });
  } catch (error) {
    return fail(error);
  }
}

export async function recordOutcomeAction(
  decisionId: string,
  outcome: string,
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    await gameRepo.recordDecisionOutcome(user.id, decisionId, outcome.trim());
    revalidatePath('/player');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
