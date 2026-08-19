import 'server-only';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { AppError } from '@/lib/errors';
import type { DailyPlan, ProtocolDraft } from '@/schemas/artefacts';
import type { OperatingState, PlanMode } from '@/schemas/common';
import type { MomentumComponents } from '@/lib/scoring/momentum';

/* ── Protocol ───────────────────────────────────────────────────────────────*/

export async function getActiveProtocol(userId: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.protocols)
    .where(and(eq(schema.protocols.userId, userId), eq(schema.protocols.isActive, true)))
    .limit(1);

  const protocol = rows[0];
  if (!protocol) return null;

  const items = await database
    .select()
    .from(schema.protocolItems)
    .where(eq(schema.protocolItems.protocolId, protocol.id))
    .orderBy(schema.protocolItems.orderIndex);

  return { protocol, items };
}

export async function saveProtocol(
  userId: string,
  draft: ProtocolDraft,
  options: { gameId?: string | null; domainIdByKey: Map<string, string> },
): Promise<{ id: string }> {
  const database = await db();

  await database
    .update(schema.protocols)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(schema.protocols.userId, userId), eq(schema.protocols.isActive, true)));

  const rows = await database
    .insert(schema.protocols)
    .values({
      userId,
      gameId: options.gameId ?? null,
      isActive: true,
      source: 'ai_suggested',
      confidence: draft.confidence,
    })
    .returning({ id: schema.protocols.id });

  const protocolId = rows[0]?.id;
  if (!protocolId) throw new AppError('database', 'protocol insert returned no row');

  await database.insert(schema.protocolItems).values(
    draft.items.map((item, i) => ({
      userId,
      protocolId,
      domainId: options.domainIdByKey.get(item.domainKey) ?? null,
      label: item.label,
      minimum: item.minimum,
      standard: item.standard,
      expansion: item.expansion,
      orderIndex: i,
    })),
  );

  // Rituals and routines are replaced wholesale: a protocol is a coherent design,
  // not an accumulating list.
  await database.delete(schema.rituals).where(eq(schema.rituals.userId, userId));
  await database.insert(schema.rituals).values(
    draft.rituals.map((r) => ({
      userId,
      category: r.category,
      name: r.name,
      detail: r.detail,
      cadence: r.cadence,
      whyThisFits: r.whyThisFits,
      source: 'ai_suggested' as const,
      confidence: draft.confidence,
    })),
  );

  await database.delete(schema.routines).where(eq(schema.routines.userId, userId));
  await database.insert(schema.routines).values(
    draft.routines.map((r) => ({
      userId,
      slot: r.slot,
      name: r.name,
      steps: r.steps,
      durationMinutes: r.durationMinutes,
      source: 'ai_suggested' as const,
      confidence: draft.confidence,
    })),
  );

  return { id: protocolId };
}

export async function listRituals(userId: string) {
  const database = await db();
  return database.select().from(schema.rituals).where(eq(schema.rituals.userId, userId));
}

export async function listRoutines(userId: string) {
  const database = await db();
  return database
    .select()
    .from(schema.routines)
    .where(eq(schema.routines.userId, userId))
    .orderBy(schema.routines.slot);
}

/* ── Daily play ─────────────────────────────────────────────────────────────*/

export async function getDayLog(userId: string, date: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.dayLogs)
    .where(and(eq(schema.dayLogs.userId, userId), eq(schema.dayLogs.date, date)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTodayActions(userId: string, date: string) {
  const database = await db();
  return database
    .select()
    .from(schema.actions)
    .where(and(eq(schema.actions.userId, userId), eq(schema.actions.date, date)))
    .orderBy(desc(schema.actions.isTodayMove));
}

export async function saveDailyPlan(
  userId: string,
  date: string,
  plan: DailyPlan,
  gameId: string | null,
): Promise<void> {
  const database = await db();

  const existing = await getDayLog(userId, date);
  if (existing) {
    await database
      .update(schema.dayLogs)
      .set({
        mode: plan.suggestedMode,
        councilNote: plan.councilNote,
        oneDecision: plan.oneDecision,
        updatedAt: new Date(),
      })
      .where(eq(schema.dayLogs.id, existing.id));
  } else {
    await database.insert(schema.dayLogs).values({
      userId,
      date,
      mode: plan.suggestedMode,
      councilNote: plan.councilNote,
      oneDecision: plan.oneDecision,
    });
  }

  // Regenerating a day replaces its generated moves but leaves anything the user
  // added themselves alone.
  await database
    .delete(schema.actions)
    .where(
      and(
        eq(schema.actions.userId, userId),
        eq(schema.actions.date, date),
        eq(schema.actions.isTodayMove, true),
      ),
    );

  await database.insert(schema.actions).values(
    plan.moves.map((move) => ({
      userId,
      gameId,
      title: move.title,
      kind: move.kind,
      why: move.why,
      date,
      energyCost: move.energyCost,
      timeMinutes: move.timeMinutes,
      isTodayMove: true,
    })),
  );
}

export async function setActionStatus(
  userId: string,
  actionId: string,
  status: 'planned' | 'done' | 'skipped' | 'moved',
): Promise<void> {
  const database = await db();
  await database
    .update(schema.actions)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(schema.actions.id, actionId), eq(schema.actions.userId, userId)));
}

export async function setDayMode(userId: string, date: string, mode: PlanMode): Promise<void> {
  const database = await db();
  const existing = await getDayLog(userId, date);
  if (existing) {
    await database
      .update(schema.dayLogs)
      .set({ mode, updatedAt: new Date() })
      .where(eq(schema.dayLogs.id, existing.id));
    return;
  }
  await database.insert(schema.dayLogs).values({ userId, date, mode });
}

/**
 * Minutes of work actually scheduled in a window. Feeds the capacity calculation,
 * so load reflects committed time rather than the size of the plan on paper.
 */
export async function plannedMinutes(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<number> {
  const database = await db();
  const rows = await database
    .select({ minutes: schema.actions.timeMinutes, status: schema.actions.status })
    .from(schema.actions)
    .where(
      and(
        eq(schema.actions.userId, userId),
        gte(schema.actions.date, fromDate),
        lte(schema.actions.date, toDate),
      ),
    );

  return rows
    .filter((r) => r.status === 'planned' || r.status === 'done')
    .reduce((sum, r) => sum + r.minutes, 0);
}

/** Completion ratio over a window — an input to both momentum and game health. */
export async function completionRate(userId: string, fromDate: string, toDate: string) {
  const database = await db();
  const rows = await database
    .select({ status: schema.actions.status })
    .from(schema.actions)
    .where(
      and(
        eq(schema.actions.userId, userId),
        gte(schema.actions.date, fromDate),
        lte(schema.actions.date, toDate),
      ),
    );

  if (rows.length === 0) return { rate: 0, total: 0, done: 0 };
  const done = rows.filter((r) => r.status === 'done').length;
  return { rate: done / rows.length, total: rows.length, done };
}

/* ── State & momentum ───────────────────────────────────────────────────────*/

export async function latestState(userId: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.stateSnapshots)
    .where(eq(schema.stateSnapshots.userId, userId))
    .orderBy(desc(schema.stateSnapshots.capturedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function recordState(
  userId: string,
  input: {
    operatingState: OperatingState;
    confidence: number;
    drivers: string[];
    focus: number;
    energy: number;
    alignment: number;
    capacity: number;
    userOverride?: boolean;
  },
): Promise<void> {
  const database = await db();
  await database.insert(schema.stateSnapshots).values({
    userId,
    ...input,
    userOverride: input.userOverride ?? false,
  });
}

export async function latestMomentum(userId: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.intentionSnapshots)
    .where(eq(schema.intentionSnapshots.userId, userId))
    .orderBy(desc(schema.intentionSnapshots.capturedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function recordMomentum(
  userId: string,
  input: {
    level: number;
    computed: number;
    components: MomentumComponents;
    explanation: string;
    accepted?: boolean;
  },
): Promise<void> {
  const database = await db();
  await database.insert(schema.intentionSnapshots).values({
    userId,
    level: input.level,
    computed: input.computed,
    components: input.components,
    explanation: input.explanation,
    accepted: input.accepted ?? false,
  });
}

/* ── Reflection ─────────────────────────────────────────────────────────────*/

export async function listReflections(
  userId: string,
  kind?: 'daily' | 'weekly' | 'monthly',
  limit = 12,
) {
  const database = await db();
  const where = kind
    ? and(eq(schema.reflections.userId, userId), eq(schema.reflections.kind, kind))
    : eq(schema.reflections.userId, userId);

  return database
    .select()
    .from(schema.reflections)
    .where(where)
    .orderBy(desc(schema.reflections.periodEnd))
    .limit(limit);
}

export async function saveReflection(
  userId: string,
  input: {
    kind: 'daily' | 'weekly' | 'monthly';
    periodStart: string;
    periodEnd: string;
    answers?: Record<string, unknown>;
    moved?: string[];
    didntMove?: string[];
    surprises?: string | null;
    feeling?: string | null;
    costMoreThanExpected?: string | null;
    gaveEnergy?: string | null;
    shouldChange?: string | null;
  },
): Promise<{ id: string }> {
  const database = await db();
  const rows = await database
    .insert(schema.reflections)
    .values({
      userId,
      kind: input.kind,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      answers: input.answers ?? {},
      moved: input.moved ?? [],
      didntMove: input.didntMove ?? [],
      surprises: input.surprises ?? null,
      feeling: input.feeling ?? null,
      costMoreThanExpected: input.costMoreThanExpected ?? null,
      gaveEnergy: input.gaveEnergy ?? null,
      shouldChange: input.shouldChange ?? null,
    })
    .returning({ id: schema.reflections.id });
  return { id: rows[0]?.id ?? '' };
}

/** Stores the generated analysis alongside the reflection so it is never recomputed. */
export async function attachIntelligence(
  userId: string,
  reflectionId: string,
  intelligence: Record<string, unknown>,
): Promise<void> {
  const database = await db();
  await database
    .update(schema.reflections)
    .set({ intelligence, updatedAt: new Date() })
    .where(
      and(eq(schema.reflections.id, reflectionId), eq(schema.reflections.userId, userId)),
    );
}
