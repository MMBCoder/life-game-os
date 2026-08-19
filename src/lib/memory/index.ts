import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { USER_AUTHORED, type MemoryLayer, type SourceKind } from '@/schemas/common';

/**
 * Three memory layers over one table.
 *
 *  stable   — values, principles, identity, family priorities, long-term preferences
 *  dynamic  — current goals, workload, game, energy, priorities
 *  episodic — decisions, wins, difficult weeks, insights, failures, breakthroughs
 *
 * Retrieval is recency- and confidence-weighted and prefers user-confirmed memories
 * over inferred ones when the two disagree (docs/architecture.md §6).
 */

export interface MemoryWrite {
  layer: MemoryLayer;
  key: string;
  value: string;
  context?: string;
  source: SourceKind;
  confidence: number;
  episodeAt?: Date;
}

export async function remember(userId: string, item: MemoryWrite): Promise<void> {
  const database = await db();

  // Stable and dynamic memories are keyed facts: writing a new value supersedes the
  // old one rather than accumulating contradictions. Episodic memories are events
  // and always accumulate.
  if (item.layer !== 'episodic') {
    const existing = await database
      .select()
      .from(schema.memoryItems)
      .where(
        and(
          eq(schema.memoryItems.userId, userId),
          eq(schema.memoryItems.key, item.key),
          eq(schema.memoryItems.layer, item.layer),
          isNull(schema.memoryItems.supersededById),
        ),
      )
      .limit(1);

    const prior = existing[0];

    // The person's own account outranks an inference — an agent cannot overwrite it.
    if (prior && USER_AUTHORED.includes(prior.source) && !USER_AUTHORED.includes(item.source)) {
      return;
    }

    const inserted = await database
      .insert(schema.memoryItems)
      .values({
        userId,
        layer: item.layer,
        key: item.key,
        value: item.value,
        context: item.context,
        source: item.source,
        confidence: item.confidence,
        status: USER_AUTHORED.includes(item.source) ? 'confirmed' : 'suggested',
        lastConfirmedAt: USER_AUTHORED.includes(item.source) ? new Date() : null,
      })
      .returning({ id: schema.memoryItems.id });

    if (prior && inserted[0]) {
      await database
        .update(schema.memoryItems)
        .set({ supersededById: inserted[0].id })
        .where(eq(schema.memoryItems.id, prior.id));
    }
    return;
  }

  await database.insert(schema.memoryItems).values({
    userId,
    layer: 'episodic',
    key: item.key,
    value: item.value,
    context: item.context,
    source: item.source,
    confidence: item.confidence,
    status: 'suggested',
    episodeAt: item.episodeAt ?? new Date(),
  });
}

export async function rememberMany(userId: string, items: MemoryWrite[]): Promise<void> {
  for (const item of items) {
    await remember(userId, item);
  }
}

export interface RecalledMemory {
  key: string;
  value: string;
  confidence: number;
  source: SourceKind;
  episodeAt: Date | null;
}

/**
 * Retrieval for context building. Superseded and rejected memories are excluded;
 * the remainder are ranked by confidence and recency and truncated to a budget so
 * a long history cannot crowd out the current situation.
 */
export async function recall(
  userId: string,
  layer: MemoryLayer,
  limit = 20,
): Promise<RecalledMemory[]> {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.memoryItems)
    .where(
      and(
        eq(schema.memoryItems.userId, userId),
        eq(schema.memoryItems.layer, layer),
        isNull(schema.memoryItems.supersededById),
      ),
    )
    .orderBy(desc(schema.memoryItems.createdAt))
    .limit(limit * 3);

  const now = Date.now();

  return rows
    .filter((r) => r.status !== 'rejected' && r.status !== 'archived')
    .map((r) => ({
      row: r,
      score: rank(r.confidence, r.source, r.episodeAt ?? r.createdAt, now),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row }) => ({
      key: row.key,
      value: row.value,
      confidence: row.confidence,
      source: row.source,
      episodeAt: row.episodeAt,
    }));
}

/**
 * A confirmed memory is worth substantially more than an inferred one; recency
 * decays over roughly a quarter, which matches the product's 90-day game cycle.
 */
function rank(confidence: number, source: SourceKind, at: Date, now: number): number {
  const ageDays = (now - at.getTime()) / 86_400_000;
  const recency = Math.exp(-ageDays / 90);
  const authority = USER_AUTHORED.includes(source) ? 1.5 : 1;
  return confidence * authority * (0.4 + 0.6 * recency);
}

export async function confirmMemory(userId: string, key: string): Promise<void> {
  const database = await db();
  await database
    .update(schema.memoryItems)
    .set({ source: 'user_confirmed', status: 'confirmed', confidence: 1, lastConfirmedAt: new Date() })
    .where(and(eq(schema.memoryItems.userId, userId), eq(schema.memoryItems.key, key)));
}

export async function forget(userId: string, key: string): Promise<void> {
  const database = await db();
  await database
    .update(schema.memoryItems)
    .set({ status: 'archived' })
    .where(and(eq(schema.memoryItems.userId, userId), eq(schema.memoryItems.key, key)));
}

/** Everything the system currently believes — powers the "what do you know about me" view. */
export async function recallAll(userId: string) {
  const [stable, dynamic, episodic] = await Promise.all([
    recall(userId, 'stable', 40),
    recall(userId, 'dynamic', 40),
    recall(userId, 'episodic', 40),
  ]);
  return { stable, dynamic, episodic };
}
