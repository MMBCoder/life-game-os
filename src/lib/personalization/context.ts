import 'server-only';
import { assessCapacity } from '@/lib/scoring/capacity';
import { recall } from '@/lib/memory';
import * as personal from '@/lib/db/repositories/personal-model';
import * as life from '@/lib/db/repositories/life';
import * as gameRepo from '@/lib/db/repositories/game';
import * as execution from '@/lib/db/repositories/execution';
import { getProfile } from '@/lib/db/repositories/users';
import type { CouncilPurpose } from '@/schemas/agent';
import type { CouncilContext } from './context-types';
import { todayIn, weekRange } from '@/lib/date';

export interface BuildContextOptions {
  purpose: CouncilPurpose;
  user: { id: string; name: string; timezone: string };
  ask?: {
    question?: string | null;
    detail?: string | null;
    payload?: Record<string, unknown>;
  };
}

/**
 * Assembles everything the council is allowed to see, once per run, so every agent
 * argues about the same facts.
 *
 * Reads run in parallel — a full context is around a dozen queries and the council
 * should not wait on them serially.
 */
export async function buildContext(options: BuildContextOptions): Promise<CouncilContext> {
  const { user, purpose } = options;

  const [
    profile,
    identity,
    values,
    strengths,
    constraints,
    nonNegotiables,
    patterns,
    domains,
    goal,
    player,
    fullGame,
    protocol,
    state,
    momentum,
    reflections,
    decisions,
    stableMemory,
    dynamicMemory,
    episodicMemory,
  ] = await Promise.all([
    getProfile(user.id),
    personal.getIdentityModel(user.id),
    personal.listValues(user.id),
    personal.listStrengths(user.id),
    personal.listConstraints(user.id),
    personal.listNonNegotiables(user.id),
    personal.listPatterns(user.id),
    life.getLifeMap(user.id),
    gameRepo.getPrimaryGoal(user.id),
    gameRepo.getActivePlayer(user.id),
    gameRepo.getFullGame(user.id),
    execution.getActiveProtocol(user.id),
    execution.latestState(user.id),
    execution.latestMomentum(user.id),
    execution.listReflections(user.id, undefined, 3),
    gameRepo.listDecisions(user.id, 5),
    recall(user.id, 'stable', 20),
    recall(user.id, 'dynamic', 20),
    recall(user.id, 'episodic', 12),
  ]);

  const wholeGoal = goal ? await gameRepo.getWholeGoal(user.id, goal.id) : null;
  const domainKeyById = new Map(domains.map((d) => [d.id, d.key]));

  const week = weekRange(todayIn(user.timezone));
  const plannedMinutes = await execution.plannedMinutes(user.id, week.start, week.end);

  const capacity = deriveCapacity({
    constraints,
    energyFromState: state?.energy ?? null,
    energyFromDomains: domains
      .map((d) => d.scores?.energy)
      .filter((e): e is number => typeof e === 'number'),
    plannedHoursThisWeek: plannedMinutes / 60,
  });

  return {
    purpose,
    user: {
      name: user.name,
      timezone: user.timezone,
      today: todayIn(user.timezone),
    },
    profile: {
      role: profile?.role ?? null,
      lifeStage: profile?.lifeStage ?? null,
      onboardingStage: profile?.onboardingStage ?? 'not_started',
    },
    identity: identity
      ? {
          current: identity.currentIdentity,
          emerging: identity.emergingIdentity,
          desired: identity.desiredIdentity,
          tensions: identity.identityTensions,
          motivators: identity.motivators,
          fears: identity.fears,
          tendencies: identity.naturalTendencies,
        }
      : null,
    values: values
      .filter((v) => v.status !== 'rejected')
      .map((v) => ({
        label: v.label,
        kind: v.kind,
        importance: v.importance,
        source: v.source,
      })),
    strengths: strengths
      .filter((s) => s.status !== 'rejected')
      .map((s) => ({ label: s.label, kind: s.kind })),
    constraints: constraints
      .filter((c) => c.status !== 'rejected')
      .map((c) => ({ label: c.label, category: c.category, severity: c.severity })),
    nonNegotiables: nonNegotiables
      .filter((n) => n.status !== 'rejected')
      .map((n) => ({ label: n.label, domainKey: n.domainKey, hardness: n.hardness })),
    patterns: patterns.map((p) => ({
      label: p.label,
      pattern: p.pattern,
      trigger: p.trigger,
      impact: p.impact,
      confidence: p.confidence,
    })),
    domains: domains.map((d) => ({ key: d.key, label: d.label, scores: d.scores })),
    goal: goal
      ? {
          title: goal.title,
          rawInput: goal.rawInput,
          horizonMonths: goal.horizonMonths,
          domainKey: goal.domainId ? (domainKeyById.get(goal.domainId) ?? null) : null,
          wholeGoal: wholeGoal
            ? {
                result: wholeGoal.result,
                experience: wholeGoal.experience,
                impact: wholeGoal.impact,
                identity: wholeGoal.identity,
              }
            : null,
        }
      : null,
    player: player
      ? {
          name: player.name,
          identity: player.identity,
          intention: player.intention,
          mantra: player.mantra,
          agreements: player.agreements,
          boundaries: player.boundaries,
        }
      : null,
    game: fullGame
      ? {
          name: fullGame.game.name,
          purpose: fullGame.game.purpose,
          winningDefinition: fullGame.game.winningDefinition,
          nonWinningDefinition: fullGame.game.nonWinningDefinition,
          strategicObjective: fullGame.game.strategicObjective,
          startDate: fullGame.game.startDate,
          endDate: fullGame.game.endDate,
          boldResults: fullGame.boldResults.map((b) => ({
            title: b.title,
            dayMarker: b.dayMarker,
            progress: b.progress,
          })),
          strategicMoves: fullGame.strategicMoves.map((m) => ({
            title: m.title,
            leverageCategory: m.leverageCategory,
          })),
          stopList: fullGame.stopList.map((s) => s.text),
          protectList: fullGame.protectList.map((p) => p.text),
          healthScore: fullGame.game.healthScore,
        }
      : null,
    protocol: protocol
      ? {
          items: protocol.items.map((i) => ({
            domainKey: i.domainId ? (domainKeyById.get(i.domainId) ?? null) : null,
            label: i.label,
            minimum: i.minimum,
            standard: i.standard,
            expansion: i.expansion,
          })),
          ritualCount: 0,
          routineCount: 0,
        }
      : null,
    capacity,
    state: state
      ? {
          operatingState: state.operatingState,
          momentum: momentum?.level ?? 5,
          focus: state.focus,
          energy: state.energy,
          alignment: state.alignment,
        }
      : null,
    recentReflections: reflections.map((r) => ({
      kind: r.kind,
      periodEnd: r.periodEnd,
      moved: r.moved,
      didntMove: r.didntMove,
      feeling: r.feeling,
      costMoreThanExpected: r.costMoreThanExpected,
      gaveEnergy: r.gaveEnergy,
    })),
    recentDecisions: decisions.map((d) => ({
      question: d.question,
      verdict: d.verdict,
      decidedAt: d.decidedAt.toISOString(),
    })),
    memory: {
      stable: stableMemory.map((m) => ({ key: m.key, value: m.value, confidence: m.confidence })),
      dynamic: dynamicMemory.map((m) => ({ key: m.key, value: m.value, confidence: m.confidence })),
      episodic: episodicMemory.map((m) => ({
        key: m.key,
        value: m.value,
        episodeAt: m.episodeAt?.toISOString() ?? null,
      })),
    },
    ask: {
      question: options.ask?.question ?? null,
      detail: options.ask?.detail ?? null,
      payload: options.ask?.payload ?? {},
    },
    peerOutputs: [],
  };
}

/**
 * Capacity from what we actually know.
 *
 * A working week is treated as ~50 discretionary hours. High-severity time or
 * responsibility constraints reduce what is available *and* increase what is
 * already spoken for.
 *
 * Committed hours deliberately come from real obligations plus genuinely scheduled
 * work — not from the number of strategic moves in the plan. Counting the plan
 * itself as load would mean committing to a game instantly overloaded the person,
 * which is exactly backwards: a leverage-based plan is supposed to return capacity.
 */
function deriveCapacity(input: {
  constraints: Array<{ category: string; severity: string }>;
  energyFromState: number | null;
  energyFromDomains: number[];
  plannedHoursThisWeek: number;
}) {
  const BASE_HOURS = 50;
  /** A normal job's baseline claim on the week. */
  const BASELINE_COMMITTED = 30;

  const timePressure = input.constraints.filter(
    (c) =>
      (c.category === 'time' || c.category === 'responsibility') &&
      (c.severity === 'high' || c.severity === 'critical'),
  ).length;

  const available = Math.max(10, BASE_HOURS - timePressure * 8);
  const committed = BASELINE_COMMITTED + timePressure * 6 + input.plannedHoursThisWeek;

  const energy =
    input.energyFromState ??
    (input.energyFromDomains.length > 0
      ? input.energyFromDomains.reduce((a, b) => a + b, 0) / input.energyFromDomains.length
      : 6);

  return assessCapacity({
    availableHoursPerWeek: available,
    committedHoursPerWeek: Math.min(committed, available + 15),
    energyLevel: energy,
  });
}
