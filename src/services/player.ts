import 'server-only';
import { buildContext } from '@/lib/personalization/context';
import { generateArtefact } from './generate';
import {
  playerDecision,
  playerOptions,
  type PlayerDecision,
  type PlayerDraft,
} from '@/schemas/artefacts';
import * as gameRepo from '@/lib/db/repositories/game';
import { persistCouncilRun } from '@/lib/db/repositories/council';
import { convene } from '@/agents/orchestrator';
import { remember } from '@/lib/memory';
import type { SessionUser } from '@/lib/auth/session';

/** Three candidate Players. The person chooses — the system proposes. */
export async function draftPlayers(user: SessionUser): Promise<PlayerDraft[]> {
  const ctx = await buildContext({
    purpose: 'player_design',
    user,
    ask: { question: 'Design candidate Players for this person’s current game.' },
  });

  const { data } = await generateArtefact({
    agent: 'player',
    schema: playerOptions,
    schemaName: 'PlayerOptions',
    ctx,
    instruction: [
      'Design three distinct Players — the version of this person their current game needs.',
      'They should be genuinely different in emphasis, not three names for the same thing.',
      'Agreements must be specific enough to be broken. "I protect my health" is not an agreement; "I do not fund work with sleep" is.',
    ].join('\n'),
  });

  return data.options;
}

export async function choosePlayer(
  user: SessionUser,
  draft: PlayerDraft,
): Promise<{ id: string }> {
  const game = await gameRepo.getActiveGame(user.id);
  const result = await gameRepo.savePlayer(user.id, draft, {
    gameId: game?.id ?? null,
    source: 'user_confirmed',
  });

  await remember(user.id, {
    layer: 'stable',
    key: 'player_identity',
    value: `${draft.name}: ${draft.intention}`,
    context: draft.mantra,
    source: 'user_confirmed',
    confidence: 1,
  });

  return result;
}

/**
 * Ask My Player.
 *
 * A real decision gets the full council: strategy, capacity, both guardians and the
 * red team, then synthesis. The verdict is stored so patterns in the person's
 * decisions become visible over time.
 */
export async function askPlayer(
  user: SessionUser,
  question: string,
  detail?: string,
): Promise<{
  decision: Awaited<ReturnType<typeof gameRepo.recordDecision>>;
  verdict: PlayerDecision;
  councilRunId: string;
}> {
  const ctx = await buildContext({
    purpose: 'decision',
    user,
    ask: { question, detail: detail ?? null },
  });

  // The council argues first; the Player verdict is then written with the council's
  // conclusions available to it.
  const council = await convene(ctx);
  const { councilRunId } = await persistCouncilRun(user.id, council);

  const ctxWithCouncil = {
    ...ctx,
    peerOutputs: council.outputs.map((o) => ({
      agent: o.agent,
      summary: o.summary,
      confidence: o.confidence,
      recommendations: o.recommendations.map((r) => `${r.title}: ${r.detail}`),
      risks: o.risks.map((r) => `${r.title}: ${r.detail}`),
      objections: o.objections.map((ob) => ({
        against: ob.against,
        claim: ob.claim,
        severity: ob.severity,
      })),
    })),
  };

  const { data: verdict } = await generateArtefact({
    agent: 'player',
    schema: playerDecision,
    schemaName: 'PlayerDecision',
    ctx: ctxWithCouncil,
    instruction: [
      `The person is deciding: "${question}"`,
      detail ? `Context they gave: ${detail}` : '',
      'Answer as their Player would: evaluate against the current game, whole goal, identity, values, non-negotiables, health, capacity, opportunity cost and strategic leverage.',
      'The council has already deliberated — its outputs are in context.peerOutputs. Do not contradict a guardian veto.',
      'Give a clear verdict and a better move. "It depends" is not an answer.',
    ]
      .filter(Boolean)
      .join('\n'),
  });

  const game = await gameRepo.getActiveGame(user.id);
  const decision = await gameRepo.recordDecision(user.id, {
    gameId: game?.id ?? null,
    question,
    context: detail ?? null,
    verdict: verdict.verdict,
    headline: verdict.headline,
    reasoning: verdict.reasoning,
    conflictsWith: verdict.conflictsWith,
    supports: verdict.supports,
    betterMove: verdict.betterMove,
    opportunityCost: verdict.opportunityCost,
    councilRunId,
    confidence: verdict.confidence,
  });

  await remember(user.id, {
    layer: 'episodic',
    key: `decision:${decision.id}`,
    value: `${question} → ${verdict.verdict}`,
    context: verdict.headline,
    source: 'ai_generated',
    confidence: verdict.confidence,
  });

  return { decision, verdict, councilRunId };
}
