'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth/session';
import { commitGame, proposeGame, refreshGameHealth } from '@/services/game';
import { adaptToChange } from '@/services/adaptation';
import * as gameRepo from '@/lib/db/repositories/game';
import { fail, failWith, ok, type ActionResult } from '@/lib/errors';
import { gameDraft, type GameDraft } from '@/schemas/artefacts';
import type { CouncilConflict, CouncilDecision } from '@/schemas/agent';
import type { AdaptationPlan } from '@/schemas/artefacts';

export interface GameProposalView {
  draft: GameDraft;
  decision: CouncilDecision;
  conflicts: CouncilConflict[];
  sacrifice: {
    scores: Array<{ domainKey: string; delta: number; why: string }>;
    verdict: 'balanced' | 'watch' | 'warning';
    warning: string | null;
  };
  alternatives: Array<{ title: string; detail: string; leverage: string }>;
  councilRunId: string;
}

export async function proposeGameAction(): Promise<ActionResult<GameProposalView>> {
  try {
    const user = await requireSession();
    const proposal = await proposeGame(user);

    return ok({
      draft: proposal.draft,
      decision: proposal.council.decision,
      conflicts: proposal.council.conflicts,
      sacrifice: {
        scores: proposal.sacrifice.scores,
        verdict: proposal.sacrifice.verdict,
        warning: proposal.sacrifice.warning,
      },
      alternatives: proposal.alternatives,
      councilRunId: proposal.councilRunId,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function commitGameAction(
  draft: unknown,
  chosenName?: string,
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    const parsed = gameDraft.safeParse(draft);
    if (!parsed.success) return failWith('That game is incomplete. Try designing it again.');

    await commitGame(user, parsed.data, chosenName);
    revalidatePath('/game');
    revalidatePath('/dashboard');
    revalidatePath('/protocol');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function setProgressAction(
  boldResultId: string,
  progress: number,
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSession();
    await gameRepo.setBoldResultProgress(user.id, boldResultId, progress);
    await refreshGameHealth(user);
    revalidatePath('/game');
    revalidatePath('/dashboard');
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function adaptAction(change: string): Promise<ActionResult<AdaptationPlan>> {
  try {
    const user = await requireSession();
    const clean = change.trim();
    if (clean.length < 10) {
      return failWith('Tell us what changed in a sentence or two.');
    }
    const result = await adaptToChange(user, clean);
    revalidatePath('/game');
    revalidatePath('/dashboard');
    return ok(result.plan);
  } catch (error) {
    return fail(error);
  }
}
