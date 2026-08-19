import 'server-only';
import { buildContext } from '@/lib/personalization/context';
import { generateArtefact } from './generate';
import { wholeGoalDraft, type WholeGoalDraft } from '@/schemas/artefacts';
import * as gameRepo from '@/lib/db/repositories/game';
import * as life from '@/lib/db/repositories/life';
import { remember } from '@/lib/memory';
import type { SessionUser } from '@/lib/auth/session';

/**
 * Turns whatever the person said into a Whole Goal.
 *
 * "I want a promotion" is an outcome. The product's position is that an outcome
 * without an intended experience, impact and identity is a target you can hit and
 * still regret, so all four dimensions are generated together from minimal input.
 */
export async function draftWholeGoal(
  user: SessionUser,
  rawInput: string,
): Promise<WholeGoalDraft> {
  const ctx = await buildContext({
    purpose: 'whole_goal',
    user,
    ask: {
      question: rawInput,
      detail: 'Transform this into a Whole Goal across all four dimensions.',
      payload: { raw: rawInput },
    },
  });

  const { data } = await generateArtefact({
    agent: 'goal',
    schema: wholeGoalDraft,
    schemaName: 'WholeGoalDraft',
    ctx,
    instruction: [
      `The person said: "${rawInput}"`,
      'Transform it into a Whole Goal: Result, Experience, Impact, Identity.',
      'Infer the three dimensions they did not state. Only set clarifyingQuestion if something genuinely cannot be inferred and would change the plan — otherwise leave it null.',
      'Use a domainKey that exists in context.domains.',
    ].join('\n'),
  });

  return data;
}

export async function saveWholeGoal(
  user: SessionUser,
  draft: WholeGoalDraft,
  rawInput: string,
  confirmed: boolean,
): Promise<{ goalId: string }> {
  const domains = await life.listDomains(user.id);
  const domain = domains.find((d) => d.key === draft.domainKey) ?? domains[0];

  const result = await gameRepo.saveWholeGoal(user.id, draft, {
    rawInput,
    domainId: domain?.id ?? null,
    source: confirmed ? 'user_confirmed' : 'ai_suggested',
  });

  await remember(user.id, {
    layer: 'dynamic',
    key: 'primary_goal',
    value: draft.title,
    context: draft.result,
    source: confirmed ? 'user_confirmed' : 'ai_suggested',
    confidence: confirmed ? 1 : draft.confidence,
  });

  return result;
}

export async function setPriorityDimension(
  user: SessionUser,
  goalId: string,
  dimension: 'result' | 'experience' | 'impact' | 'identity',
): Promise<void> {
  await gameRepo.setGoalDimensionPriority(user.id, goalId, dimension);
  await remember(user.id, {
    layer: 'stable',
    key: 'priority_goal_dimension',
    value: dimension,
    source: 'user_said',
    confidence: 1,
  });
}
