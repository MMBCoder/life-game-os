import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { AppError } from '@/lib/errors';
import type { GameDraft, PlayerDraft, WholeGoalDraft } from '@/schemas/artefacts';
import type { SourceKind } from '@/schemas/common';

/** Exactly three bold results per game — a product decision, enforced here. */
const MAX_BOLD_RESULTS = 3;

/* ── Goals ──────────────────────────────────────────────────────────────────*/

export async function getPrimaryGoal(userId: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.goals)
    .where(and(eq(schema.goals.userId, userId), eq(schema.goals.isPrimary, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getWholeGoal(userId: string, goalId: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.wholeGoals)
    .where(and(eq(schema.wholeGoals.userId, userId), eq(schema.wholeGoals.goalId, goalId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveWholeGoal(
  userId: string,
  draft: WholeGoalDraft,
  options: { rawInput?: string; domainId?: string | null; source: SourceKind },
): Promise<{ goalId: string }> {
  const database = await db();

  // One primary goal at a time. Parallel major goals reliably produce slower
  // progress on each — the Goal Architect's charter says so, and this enforces it.
  await database
    .update(schema.goals)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(and(eq(schema.goals.userId, userId), eq(schema.goals.isPrimary, true)));

  const goalRows = await database
    .insert(schema.goals)
    .values({
      userId,
      title: draft.title,
      rawInput: options.rawInput ?? null,
      horizonMonths: draft.horizonMonths,
      domainId: options.domainId ?? null,
      isPrimary: true,
      source: options.source,
      confidence: draft.confidence,
      status: options.source === 'user_confirmed' ? 'confirmed' : 'suggested',
    })
    .returning({ id: schema.goals.id });

  const goalId = goalRows[0]?.id;
  if (!goalId) throw new AppError('database', 'goal insert returned no row');

  await database.insert(schema.wholeGoals).values({
    userId,
    goalId,
    result: draft.result,
    experience: draft.experience,
    impact: draft.impact,
    identity: draft.identity,
    source: options.source,
    confidence: draft.confidence,
  });

  return { goalId };
}

export async function setGoalDimensionPriority(
  userId: string,
  goalId: string,
  dimension: 'result' | 'experience' | 'impact' | 'identity',
): Promise<void> {
  const database = await db();
  await database
    .update(schema.wholeGoals)
    .set({
      mostImportantDimension: dimension,
      source: 'user_confirmed',
      status: 'confirmed',
      lastConfirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.wholeGoals.userId, userId), eq(schema.wholeGoals.goalId, goalId)));
}

/* ── Player ─────────────────────────────────────────────────────────────────*/

export async function getActivePlayer(userId: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.players)
    .where(and(eq(schema.players.userId, userId), eq(schema.players.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function savePlayer(
  userId: string,
  draft: PlayerDraft,
  options: { gameId?: string | null; source: SourceKind },
): Promise<{ id: string }> {
  const database = await db();

  await database
    .update(schema.players)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(schema.players.userId, userId), eq(schema.players.isActive, true)));

  const rows = await database
    .insert(schema.players)
    .values({
      userId,
      gameId: options.gameId ?? null,
      name: draft.name,
      identity: draft.identity,
      intention: draft.intention,
      mantra: draft.mantra,
      attitude: draft.attitude,
      actions: draft.actions,
      agreements: draft.agreements,
      boundaries: draft.boundaries,
      strengths: draft.strengths,
      watchOuts: draft.watchOuts,
      whyThisFits: draft.whyThisFits,
      isActive: true,
      source: options.source,
      confidence: draft.confidence,
      status: options.source === 'user_confirmed' ? 'confirmed' : 'suggested',
      lastConfirmedAt: options.source === 'user_confirmed' ? new Date() : null,
    })
    .returning({ id: schema.players.id });

  return { id: rows[0]?.id ?? '' };
}

/* ── Game ───────────────────────────────────────────────────────────────────*/

export async function getActiveGame(userId: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.games)
    .where(
      and(
        eq(schema.games.userId, userId),
        inArray(schema.games.status, ['active', 'draft', 'recalibrating']),
      ),
    )
    .orderBy(desc(schema.games.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export interface FullGame {
  game: NonNullable<Awaited<ReturnType<typeof getActiveGame>>>;
  boldResults: Array<typeof schema.boldResults.$inferSelect>;
  strategicMoves: Array<typeof schema.strategicMoves.$inferSelect>;
  stopList: Array<typeof schema.stopListItems.$inferSelect>;
  protectList: Array<typeof schema.protectListItems.$inferSelect>;
  risks: Array<typeof schema.gameRisks.$inferSelect>;
  squad: Array<typeof schema.squadMembers.$inferSelect>;
}

export async function getFullGame(userId: string): Promise<FullGame | null> {
  const game = await getActiveGame(userId);
  if (!game) return null;

  const database = await db();
  const [boldResults, strategicMoves, stopList, protectList, risks, squad] = await Promise.all([
    database
      .select()
      .from(schema.boldResults)
      .where(and(eq(schema.boldResults.userId, userId), eq(schema.boldResults.gameId, game.id)))
      .orderBy(schema.boldResults.dayMarker),
    database
      .select()
      .from(schema.strategicMoves)
      .where(
        and(eq(schema.strategicMoves.userId, userId), eq(schema.strategicMoves.gameId, game.id)),
      )
      .orderBy(schema.strategicMoves.sequenceIndex),
    database
      .select()
      .from(schema.stopListItems)
      .where(and(eq(schema.stopListItems.userId, userId), eq(schema.stopListItems.gameId, game.id))),
    database
      .select()
      .from(schema.protectListItems)
      .where(
        and(eq(schema.protectListItems.userId, userId), eq(schema.protectListItems.gameId, game.id)),
      ),
    database
      .select()
      .from(schema.gameRisks)
      .where(and(eq(schema.gameRisks.userId, userId), eq(schema.gameRisks.gameId, game.id))),
    database
      .select()
      .from(schema.squadMembers)
      .where(and(eq(schema.squadMembers.userId, userId), eq(schema.squadMembers.gameId, game.id))),
  ]);

  return { game, boldResults, strategicMoves, stopList, protectList, risks, squad };
}

export async function saveGame(
  userId: string,
  draft: GameDraft,
  options: { goalId?: string | null; source: SourceKind; startDate?: Date },
): Promise<{ gameId: string }> {
  if (draft.boldResults.length > MAX_BOLD_RESULTS) {
    throw new AppError('validation', `a game may hold at most ${MAX_BOLD_RESULTS} bold results`);
  }

  const database = await db();
  const start = options.startDate ?? new Date();
  const end = addDays(start, 90);

  // Archive any prior game rather than deleting it — the monthly review compares
  // against where the person started.
  await database
    .update(schema.games)
    .set({ status: 'completed', updatedAt: new Date() })
    .where(
      and(
        eq(schema.games.userId, userId),
        inArray(schema.games.status, ['active', 'draft', 'recalibrating']),
      ),
    );

  const gameRows = await database
    .insert(schema.games)
    .values({
      userId,
      goalId: options.goalId ?? null,
      name: draft.name,
      purpose: draft.purpose,
      winningDefinition: draft.winningDefinition,
      nonWinningDefinition: draft.nonWinningDefinition,
      strategicObjective: draft.strategicObjective,
      startDate: isoDate(start),
      endDate: isoDate(end),
      status: options.source === 'user_confirmed' ? 'active' : 'draft',
      whyThisPlan: draft.whyThisPlan,
      intentionalOmissions: draft.intentionalOmissions,
      source: options.source,
      confidence: draft.confidence,
    })
    .returning({ id: schema.games.id });

  const gameId = gameRows[0]?.id;
  if (!gameId) throw new AppError('database', 'game insert returned no row');

  await database.insert(schema.boldResults).values(
    draft.boldResults.map((b) => ({
      userId,
      gameId,
      title: b.title,
      dayMarker: b.dayMarker,
      targetDate: isoDate(addDays(start, b.dayMarker)),
      successDefinition: b.successDefinition,
      evidence: b.evidence,
      leadingIndicators: b.leadingIndicators,
      dependencies: b.dependencies,
      riskNotes: b.risks,
      confidence: b.confidence,
      owner: b.owner,
    })),
  );

  await database.insert(schema.strategicMoves).values(
    draft.strategicMoves.map((m, i) => ({
      userId,
      gameId,
      title: m.title,
      detail: m.detail,
      leverageCategory: m.leverageCategory,
      expectedImpact: m.expectedImpact,
      effort: m.effort,
      sequenceIndex: i,
    })),
  );

  await database.insert(schema.stopListItems).values(
    draft.stopList.map((s) => ({
      userId,
      gameId,
      text: s.text,
      reason: s.reason,
      source: 'ai_suggested' as const,
      confidence: draft.confidence,
    })),
  );

  await database.insert(schema.protectListItems).values(
    draft.protectList.map((p) => ({
      userId,
      gameId,
      text: p.text,
      reason: p.reason,
      source: 'ai_suggested' as const,
      confidence: draft.confidence,
    })),
  );

  if (draft.risks.length > 0) {
    await database.insert(schema.gameRisks).values(
      draft.risks.map((r) => ({
        userId,
        gameId,
        title: r.title,
        detail: r.detail,
        severity: r.severity,
        likelihood: r.likelihood,
        mitigation: r.mitigation,
      })),
    );
  }

  if (draft.squad.length > 0) {
    await database.insert(schema.squadMembers).values(
      draft.squad.map((s) => ({
        userId,
        gameId,
        name: s.role,
        canHelpWith: s.canHelpWith,
        askDraft: s.askDraft,
        source: 'ai_suggested' as const,
        confidence: draft.confidence,
      })),
    );
  }

  return { gameId };
}

export async function activateGame(userId: string, gameId: string): Promise<void> {
  const database = await db();
  await database
    .update(schema.games)
    .set({
      status: 'active',
      source: 'user_confirmed',
      lastConfirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.games.id, gameId), eq(schema.games.userId, userId)));
}

export async function setGameHealth(
  userId: string,
  gameId: string,
  score: number,
): Promise<void> {
  const database = await db();
  await database
    .update(schema.games)
    .set({ healthScore: score, updatedAt: new Date() })
    .where(and(eq(schema.games.id, gameId), eq(schema.games.userId, userId)));
}

export async function setBoldResultProgress(
  userId: string,
  boldResultId: string,
  progress: number,
): Promise<void> {
  const database = await db();
  await database
    .update(schema.boldResults)
    .set({ progress: Math.max(0, Math.min(1, progress)), updatedAt: new Date() })
    .where(
      and(eq(schema.boldResults.id, boldResultId), eq(schema.boldResults.userId, userId)),
    );
}

export async function markGameRecalibrating(userId: string, gameId: string): Promise<void> {
  const database = await db();
  await database
    .update(schema.games)
    .set({ status: 'recalibrating', updatedAt: new Date() })
    .where(and(eq(schema.games.id, gameId), eq(schema.games.userId, userId)));
}

/* ── Decisions ──────────────────────────────────────────────────────────────*/

export async function recordDecision(
  userId: string,
  input: {
    gameId?: string | null;
    question: string;
    context?: string | null;
    verdict: 'take' | 'decline' | 'delegate' | 'defer' | 'renegotiate';
    headline: string;
    reasoning: string;
    conflictsWith: string[];
    supports: string[];
    betterMove: string;
    opportunityCost: string;
    councilRunId?: string | null;
    confidence: number;
  },
): Promise<{ id: string }> {
  const database = await db();
  const rows = await database
    .insert(schema.decisions)
    .values({
      userId,
      gameId: input.gameId ?? null,
      question: input.question,
      context: input.context ?? null,
      verdict: input.verdict,
      headline: input.headline,
      reasoning: input.reasoning,
      conflictsWith: input.conflictsWith,
      supports: input.supports,
      betterMove: input.betterMove,
      opportunityCost: input.opportunityCost,
      councilRunId: input.councilRunId ?? null,
      confidence: input.confidence,
    })
    .returning({ id: schema.decisions.id });
  return { id: rows[0]?.id ?? '' };
}

export async function listDecisions(userId: string, limit = 20) {
  const database = await db();
  return database
    .select()
    .from(schema.decisions)
    .where(eq(schema.decisions.userId, userId))
    .orderBy(desc(schema.decisions.decidedAt))
    .limit(limit);
}

/** Closes the loop: what the person actually did feeds the Reflection Agent. */
export async function recordDecisionOutcome(
  userId: string,
  decisionId: string,
  outcome: string,
): Promise<void> {
  const database = await db();
  await database
    .update(schema.decisions)
    .set({ userOutcome: outcome })
    .where(and(eq(schema.decisions.id, decisionId), eq(schema.decisions.userId, userId)));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
