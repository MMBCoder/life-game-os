import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { SourceKind } from '@/schemas/common';
import type { DomainScores } from '@/lib/personalization/context-types';

export interface DomainWithScores {
  id: string;
  key: string;
  label: string;
  orderIndex: number;
  isCustom: boolean;
  scores: DomainScores | null;
  scoreId: string | null;
  source: SourceKind | null;
  confidence: number | null;
  basis: string | null;
  confirmedAt: Date | null;
  capturedAt: Date | null;
}

export async function listDomains(userId: string) {
  const database = await db();
  return database
    .select()
    .from(schema.lifeDomains)
    .where(and(eq(schema.lifeDomains.userId, userId), eq(schema.lifeDomains.isActive, true)))
    .orderBy(schema.lifeDomains.orderIndex);
}

/**
 * Domains with their most recent score. `lifeScores` is append-only, so "current"
 * means the latest row rather than a mutated one — that is what preserves the
 * trajectory the monthly review compares against (docs/decisions.md D8).
 */
export async function getLifeMap(userId: string): Promise<DomainWithScores[]> {
  const database = await db();
  const domains = await listDomains(userId);
  if (domains.length === 0) return [];

  const allScores = await database
    .select()
    .from(schema.lifeScores)
    .where(
      and(
        eq(schema.lifeScores.userId, userId),
        inArray(
          schema.lifeScores.domainId,
          domains.map((d) => d.id),
        ),
      ),
    )
    .orderBy(desc(schema.lifeScores.capturedAt));

  const latestByDomain = new Map<string, (typeof allScores)[number]>();
  for (const score of allScores) {
    if (!latestByDomain.has(score.domainId)) latestByDomain.set(score.domainId, score);
  }

  return domains.map((domain) => {
    const score = latestByDomain.get(domain.id);
    return {
      id: domain.id,
      key: domain.key,
      label: domain.label,
      orderIndex: domain.orderIndex,
      isCustom: domain.isCustom,
      scoreId: score?.id ?? null,
      source: (score?.source as SourceKind | undefined) ?? null,
      confidence: score?.confidence ?? null,
      basis: score?.basis ?? null,
      confirmedAt: score?.lastConfirmedAt ?? null,
      capturedAt: score?.capturedAt ?? null,
      scores: score
        ? {
            currentExperience: score.currentExperience,
            desiredExperience: score.desiredExperience,
            outerResult: score.outerResult,
            innerExperience: score.innerExperience,
            importance: score.importance,
            energy: score.energy,
            satisfaction: score.satisfaction,
            risk: score.risk,
            momentum: score.momentum,
          }
        : null,
    };
  });
}

export interface ScoreInput extends DomainScores {
  domainId: string;
  basis?: string | null;
  source: SourceKind;
  confidence: number;
}

/** Appends new score rows. Never updates — corrections are new rows. */
export async function recordScores(userId: string, scores: ScoreInput[]): Promise<void> {
  if (scores.length === 0) return;
  const database = await db();
  const confirmed = scores.every((s) => s.source === 'user_confirmed' || s.source === 'user_said');

  await database.insert(schema.lifeScores).values(
    scores.map((s) => ({
      userId,
      domainId: s.domainId,
      currentExperience: s.currentExperience,
      desiredExperience: s.desiredExperience,
      outerResult: s.outerResult,
      innerExperience: s.innerExperience,
      importance: s.importance,
      energy: s.energy,
      satisfaction: s.satisfaction,
      risk: s.risk,
      momentum: s.momentum,
      basis: s.basis ?? null,
      source: s.source,
      confidence: s.confidence,
      status: confirmed ? ('confirmed' as const) : ('suggested' as const),
      lastConfirmedAt: confirmed ? new Date() : null,
    })),
  );
}

/**
 * The [Lower] [About right] [Higher] control. Rather than asking for a number, the
 * user nudges the estimate — far faster and, in practice, more honest.
 */
export async function adjustScore(
  userId: string,
  domainId: string,
  field: keyof DomainScores,
  direction: 'lower' | 'right' | 'higher',
): Promise<void> {
  const map = await getLifeMap(userId);
  const domain = map.find((d) => d.id === domainId);
  if (!domain?.scores) return;

  const delta = direction === 'lower' ? -1.5 : direction === 'higher' ? 1.5 : 0;
  const next: DomainScores = {
    ...domain.scores,
    [field]: Math.max(0, Math.min(10, domain.scores[field] + delta)),
  };

  await recordScores(userId, [
    {
      domainId,
      ...next,
      basis: `Adjusted by you (${direction === 'right' ? 'confirmed as about right' : direction}).`,
      source: 'user_confirmed',
      confidence: 1,
    },
  ]);
}

export async function addCustomDomain(
  userId: string,
  label: string,
): Promise<{ id: string }> {
  const database = await db();
  const existing = await listDomains(userId);
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 30);

  const rows = await database
    .insert(schema.lifeDomains)
    .values({
      userId,
      key: key || `custom_${existing.length + 1}`,
      label: label.trim(),
      orderIndex: existing.length,
      isCustom: true,
    })
    .returning({ id: schema.lifeDomains.id });

  return { id: rows[0]?.id ?? '' };
}

/** Deactivates rather than deletes, so historical scores are not orphaned. */
export async function deactivateDomain(userId: string, domainId: string): Promise<void> {
  const database = await db();
  await database
    .update(schema.lifeDomains)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(schema.lifeDomains.id, domainId), eq(schema.lifeDomains.userId, userId)));
}

/** Score history for a domain, oldest first — powers the monthly comparison. */
export async function scoreHistory(userId: string, domainId: string, limit = 12) {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.lifeScores)
    .where(and(eq(schema.lifeScores.userId, userId), eq(schema.lifeScores.domainId, domainId)))
    .orderBy(desc(schema.lifeScores.capturedAt))
    .limit(limit);
  return rows.reverse();
}
