import 'server-only';
import { buildContext } from '@/lib/personalization/context';
import { generateArtefact } from './generate';
import { adaptationPlan, type AdaptationPlan } from '@/schemas/artefacts';
import * as gameRepo from '@/lib/db/repositories/game';
import * as personal from '@/lib/db/repositories/personal-model';
import { persistCouncilRun } from '@/lib/db/repositories/council';
import { convene } from '@/agents/orchestrator';
import { remember } from '@/lib/memory';
import type { SessionUser } from '@/lib/auth/session';

/**
 * The Adaptive Game Engine.
 *
 * When reality changes, the plan built for the previous reality quietly becomes a
 * plan for a situation that no longer exists. This surfaces that rather than letting
 * milestones drift into failures.
 */
export async function adaptToChange(
  user: SessionUser,
  change: string,
): Promise<{ plan: AdaptationPlan; councilRunId: string }> {
  await personal.addObservation(user.id, {
    text: `Context change: ${change}`,
    channel: 'conversation',
  });

  const ctx = await buildContext({
    purpose: 'adaptation',
    user,
    ask: {
      question: 'Something has changed. Does the plan still hold?',
      detail: change,
    },
  });

  const council = await convene(ctx);
  const { councilRunId } = await persistCouncilRun(user.id, council);

  const { data } = await generateArtefact({
    agent: 'adaptation',
    schema: adaptationPlan,
    schemaName: 'AdaptationPlan',
    ctx: {
      ...ctx,
      peerOutputs: council.outputs.map((o) => ({
        agent: o.agent,
        summary: o.summary,
        confidence: o.confidence,
        recommendations: o.recommendations.map((r) => r.title),
        risks: o.risks.map((r) => r.title),
        objections: o.objections.map((ob) => ({
          against: ob.against,
          claim: ob.claim,
          severity: ob.severity,
        })),
      })),
    },
    instruction: [
      `What changed: "${change}"`,
      'Identify what this affects and recommend continue, adjust, simplify, or recalibrate.',
      'Prefer reducing scope to reducing ambition — most plans fail on method, not on target.',
      'If milestones were anchored to a start date that no longer applies, say so explicitly and reset them from today.',
    ].join('\n'),
  });

  await remember(user.id, {
    layer: 'episodic',
    key: `context_change:${Date.now()}`,
    value: change,
    context: data.headline,
    source: 'user_said',
    confidence: 1,
  });

  if (data.recommendation === 'recalibrate') {
    const game = await gameRepo.getActiveGame(user.id);
    if (game) await gameRepo.markGameRecalibrating(user.id, game.id);
  }

  return { plan: data, councilRunId };
}
