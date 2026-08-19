import 'server-only';
import { buildContext } from '@/lib/personalization/context';
import { generateArtefact } from './generate';
import { gameDraft, sacrificeAssessment, type GameDraft } from '@/schemas/artefacts';
import * as gameRepo from '@/lib/db/repositories/game';
import * as life from '@/lib/db/repositories/life';
import * as personal from '@/lib/db/repositories/personal-model';
import * as execution from '@/lib/db/repositories/execution';
import { persistCouncilRun, saveSacrificeAssessment } from '@/lib/db/repositories/council';
import { convene } from '@/agents/orchestrator';
import { assessSacrifice } from '@/lib/scoring/sacrifice';
import { computeGameHealth } from '@/lib/scoring/game-health';
import { remember } from '@/lib/memory';
import type { SessionUser } from '@/lib/auth/session';
import type { CouncilRunResult } from '@/agents/orchestrator';

export interface GameProposal {
  draft: GameDraft;
  council: CouncilRunResult;
  councilRunId: string;
  sacrifice: ReturnType<typeof assessSacrifice>;
  alternatives: Array<{ title: string; detail: string; leverage: string }>;
}

/**
 * Designs a Game and puts it through the council before the person ever sees it.
 *
 * The order matters: the strategy is drafted, then attacked, then costed. A plan the
 * guardians would veto should never reach the screen as a recommendation.
 */
export async function proposeGame(user: SessionUser): Promise<GameProposal> {
  const ctx = await buildContext({
    purpose: 'game_design',
    user,
    ask: { question: 'Design a 90-day game for this person.' },
  });

  const { data: draft } = await generateArtefact({
    agent: 'strategy',
    schema: gameDraft,
    schemaName: 'GameDraft',
    ctx,
    instruction: [
      'Design a 90-day Game for this person.',
      'Exactly three bold results, at day 30, 60 and 90.',
      'Before proposing effort, test whether the outcome is reachable through leverage. Name the leverage category on every strategic move.',
      'The non-winning definition is required and must be specific to them — what winning explicitly does not require.',
      'whyThisPlan and intentionalOmissions are required. They are how the person can tell this was designed for them.',
    ].join('\n'),
  });

  // The council reviews the draft rather than the abstract situation.
  const reviewCtx = {
    ...ctx,
    purpose: 'plan_review' as const,
    ask: {
      question: 'Review this proposed game before the person sees it.',
      detail: `Proposed game: ${draft.name}. Objective: ${draft.strategicObjective}. Moves: ${draft.strategicMoves.map((m) => m.title).join('; ')}.`,
      payload: { draft: draft as unknown as Record<string, unknown> },
    },
  };

  const council = await convene(reviewCtx);
  const { councilRunId } = await persistCouncilRun(user.id, council);

  const { sacrifice, alternatives } = await assessGameCost(user, ctx, councilRunId, draft);

  return { draft, council, councilRunId, sacrifice, alternatives };
}

/**
 * Scores the plan's cost across domains. The per-domain deltas come from the model;
 * the verdict is computed against the person's own non-negotiables, because
 * protection has to be reliable rather than probabilistic.
 */
async function assessGameCost(
  user: SessionUser,
  ctx: Awaited<ReturnType<typeof buildContext>>,
  councilRunId: string,
  draft: GameDraft,
) {
  const { data } = await generateArtefact({
    agent: 'redTeam',
    schema: sacrificeAssessment,
    schemaName: 'SacrificeAssessment',
    ctx: {
      ...ctx,
      ask: {
        question: 'What does this plan cost across their life?',
        detail: `${draft.name}: ${draft.strategicObjective}`,
        payload: {},
      },
    },
    instruction: [
      'Score what this plan does to every domain in context.domains, from −3 (severe cost) to +3 (strong gain). Use the exact domain keys.',
      'Be honest about the cost. A plan that shows only gains has not been assessed.',
      'Where there is a cost, offer alternatives that reach the same ambition by a different method. Never lower the ambition.',
    ].join('\n'),
  });

  const domains = await life.listDomains(user.id);
  const labelByKey = new Map(domains.map((d) => [d.key, d.label]));
  const nonNegotiables = await personal.listNonNegotiables(user.id);

  const protectedDomains = nonNegotiables
    .map((n) => {
      const key = n.domainKey ?? inferDomainKey(n.label, domains.map((d) => d.key));
      if (!key) return null;
      return { domainKey: key, label: n.label, hardness: n.hardness };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const sacrifice = assessSacrifice(
    data.scores.map((s) => ({
      domainKey: s.domainKey,
      delta: s.delta,
      why: s.why,
    })),
    protectedDomains,
  );

  const alternatives = data.alternatives.map((a) => ({
    title: a.title,
    detail: a.detail,
    leverage: a.leverage,
  }));

  await saveSacrificeAssessment(user.id, sacrifice, {
    councilRunId,
    alternatives,
  });

  return {
    sacrifice: {
      ...sacrifice,
      scores: sacrifice.scores.map((s) => ({
        ...s,
        label: labelByKey.get(s.domainKey) ?? s.domainKey,
      })),
    } as ReturnType<typeof assessSacrifice>,
    alternatives,
  };
}

export async function commitGame(
  user: SessionUser,
  draft: GameDraft,
  chosenName?: string,
): Promise<{ gameId: string }> {
  const goal = await gameRepo.getPrimaryGoal(user.id);
  const result = await gameRepo.saveGame(
    user.id,
    { ...draft, name: chosenName ?? draft.name },
    { goalId: goal?.id ?? null, source: 'user_confirmed' },
  );

  await gameRepo.activateGame(user.id, result.gameId);
  await refreshGameHealth(user);

  await remember(user.id, {
    layer: 'dynamic',
    key: 'current_game',
    value: chosenName ?? draft.name,
    context: draft.strategicObjective,
    source: 'user_confirmed',
    confidence: 1,
  });

  return result;
}

/**
 * Recomputes Game Health from real state. Every input is measured rather than
 * generated — this evaluates the plan, and a generated self-assessment would be
 * worth nothing.
 */
export async function refreshGameHealth(user: SessionUser): Promise<number | null> {
  const full = await gameRepo.getFullGame(user.id);
  if (!full) return null;

  const ctx = await buildContext({ purpose: 'plan_review', user });
  const goal = await gameRepo.getPrimaryGoal(user.id);
  const wholeGoal = goal ? await gameRepo.getWholeGoal(user.id, goal.id) : null;

  const protectText = full.protectList.map((p) => p.text.toLowerCase()).join(' ');
  const leverageCount = full.strategicMoves.filter((m) => m.leverageCategory).length;

  const window = last30Days(ctx.user.today);
  const completion = await execution.completionRate(user.id, window.from, window.to);
  const progressed = full.boldResults.filter((b) => b.progress > 0).length;

  const health = computeGameHealth({
    goalClarity: wholeGoal ? 9 : goal ? 6 : 2,
    strategicCoherence:
      full.strategicMoves.length === 0
        ? 2
        : Math.min(10, 4 + (leverageCount / full.strategicMoves.length) * 6),
    capacityLoad: ctx.capacity.load,
    alignment: goal ? 8 : 4,
    healthProtection: /sleep|health|recovery|rest|exercise/.test(protectText) ? 9 : 4,
    familyProtection: /family|partner|child|relationship|evening|weekend/.test(protectText) ? 9 : 4,
    executionConsistency: completion.rate,
    evidenceOfProgress: full.boldResults.length > 0 ? progressed / full.boldResults.length : 0,
    adaptability: full.game.status === 'recalibrating' ? 9 : 6,
  });

  await gameRepo.setGameHealth(user.id, full.game.id, health.score);
  return health.score;
}

export async function getGameHealthDetail(user: SessionUser) {
  const full = await gameRepo.getFullGame(user.id);
  if (!full) return null;

  const ctx = await buildContext({ purpose: 'plan_review', user });
  const goal = await gameRepo.getPrimaryGoal(user.id);
  const wholeGoal = goal ? await gameRepo.getWholeGoal(user.id, goal.id) : null;
  const protectText = full.protectList.map((p) => p.text.toLowerCase()).join(' ');
  const leverageCount = full.strategicMoves.filter((m) => m.leverageCategory).length;
  const window = last30Days(ctx.user.today);
  const completion = await execution.completionRate(user.id, window.from, window.to);
  const progressed = full.boldResults.filter((b) => b.progress > 0).length;

  return computeGameHealth({
    goalClarity: wholeGoal ? 9 : goal ? 6 : 2,
    strategicCoherence:
      full.strategicMoves.length === 0
        ? 2
        : Math.min(10, 4 + (leverageCount / full.strategicMoves.length) * 6),
    capacityLoad: ctx.capacity.load,
    alignment: goal ? 8 : 4,
    healthProtection: /sleep|health|recovery|rest|exercise/.test(protectText) ? 9 : 4,
    familyProtection: /family|partner|child|relationship|evening|weekend/.test(protectText) ? 9 : 4,
    executionConsistency: completion.rate,
    evidenceOfProgress: full.boldResults.length > 0 ? progressed / full.boldResults.length : 0,
    adaptability: full.game.status === 'recalibrating' ? 9 : 6,
  });
}

function inferDomainKey(label: string, keys: string[]): string | null {
  const lower = label.toLowerCase();
  const direct = keys.find((k) => lower.includes(k));
  if (direct) return direct;
  if (/family|child|kid|partner|spouse/.test(lower)) return keys.includes('family') ? 'family' : null;
  if (/sleep|health|rest|recovery|exercise|fitness/.test(lower))
    return keys.includes('health') ? 'health' : null;
  if (/friend|relationship/.test(lower)) return keys.includes('relationships') ? 'relationships' : null;
  if (/money|financ|saving/.test(lower)) return keys.includes('finance') ? 'finance' : null;
  if (/time to think|mine|myself|integrity/.test(lower)) return keys.includes('self') ? 'self' : null;
  return null;
}

function last30Days(today: string) {
  const to = today;
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 30);
  return { from: date.toISOString().slice(0, 10), to };
}
