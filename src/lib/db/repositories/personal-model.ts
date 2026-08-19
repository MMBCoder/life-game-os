import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { USER_AUTHORED, type SourceKind } from '@/schemas/common';
import { AppError } from '@/lib/errors';

/* ── Identity ───────────────────────────────────────────────────────────────*/

export async function getIdentityModel(userId: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.identityModels)
    .where(eq(schema.identityModels.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export interface IdentityUpsert {
  currentIdentity?: string | null;
  emergingIdentity?: string | null;
  desiredIdentity?: string | null;
  identityTensions?: string[];
  motivators?: string[];
  fears?: string[];
  naturalTendencies?: string[];
  source: SourceKind;
  confidence: number;
}

export async function upsertIdentityModel(
  userId: string,
  input: IdentityUpsert,
): Promise<void> {
  const database = await db();
  const existing = await getIdentityModel(userId);

  if (!existing) {
    await database.insert(schema.identityModels).values({ userId, ...input });
    return;
  }

  // Provenance rule: an agent may not overwrite what the person said about
  // themselves. It can only propose a new claim (CLAUDE.md §8, data-model.md §4).
  if (
    USER_AUTHORED.includes(existing.source) &&
    !USER_AUTHORED.includes(input.source)
  ) {
    return;
  }

  await database
    .update(schema.identityModels)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.identityModels.userId, userId));
}

/* ── Values, strengths, constraints, non-negotiables ───────────────────────*/

export async function listValues(userId: string) {
  const database = await db();
  return database
    .select()
    .from(schema.values)
    .where(eq(schema.values.userId, userId))
    .orderBy(desc(schema.values.importance));
}

export async function addValue(
  userId: string,
  input: {
    label: string;
    kind?: 'value' | 'principle';
    importance?: number;
    note?: string;
    source: SourceKind;
    confidence: number;
  },
) {
  const database = await db();
  await database.insert(schema.values).values({
    userId,
    label: input.label,
    kind: input.kind ?? 'value',
    importance: input.importance ?? 5,
    note: input.note,
    source: input.source,
    confidence: input.confidence,
    status: USER_AUTHORED.includes(input.source) ? 'confirmed' : 'suggested',
    lastConfirmedAt: USER_AUTHORED.includes(input.source) ? new Date() : null,
  });
}

export async function listStrengths(userId: string) {
  const database = await db();
  return database.select().from(schema.strengths).where(eq(schema.strengths.userId, userId));
}

export async function addStrength(
  userId: string,
  input: {
    label: string;
    kind?: 'strength' | 'overdone';
    note?: string;
    source: SourceKind;
    confidence: number;
  },
) {
  const database = await db();
  await database.insert(schema.strengths).values({
    userId,
    label: input.label,
    kind: input.kind ?? 'strength',
    note: input.note,
    source: input.source,
    confidence: input.confidence,
  });
}

export async function listConstraints(userId: string) {
  const database = await db();
  return database.select().from(schema.constraints).where(eq(schema.constraints.userId, userId));
}

export async function addConstraint(
  userId: string,
  input: {
    label: string;
    category: 'time' | 'energy' | 'financial' | 'responsibility' | 'environment' | 'skill';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    note?: string;
    source: SourceKind;
    confidence: number;
  },
) {
  const database = await db();
  await database.insert(schema.constraints).values({
    userId,
    label: input.label,
    category: input.category,
    severity: input.severity ?? 'medium',
    note: input.note,
    source: input.source,
    confidence: input.confidence,
  });
}

export async function listNonNegotiables(userId: string) {
  const database = await db();
  return database
    .select()
    .from(schema.nonNegotiables)
    .where(eq(schema.nonNegotiables.userId, userId));
}

export async function addNonNegotiable(
  userId: string,
  input: {
    label: string;
    domainKey?: string | null;
    hardness?: 'firm' | 'strong' | 'preference';
    note?: string;
    source: SourceKind;
    confidence: number;
  },
) {
  const database = await db();
  await database.insert(schema.nonNegotiables).values({
    userId,
    label: input.label,
    domainKey: input.domainKey ?? null,
    hardness: input.hardness ?? 'strong',
    note: input.note,
    source: input.source,
    confidence: input.confidence,
    status: USER_AUTHORED.includes(input.source) ? 'confirmed' : 'suggested',
    lastConfirmedAt: USER_AUTHORED.includes(input.source) ? new Date() : null,
  });
}

/**
 * A `firm` non-negotiable is a hard block in conflict detection, so it may not be
 * removed by anything other than an explicit user action (data-model.md §2).
 */
export async function removeNonNegotiable(userId: string, id: string): Promise<void> {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.nonNegotiables)
    .where(and(eq(schema.nonNegotiables.id, id), eq(schema.nonNegotiables.userId, userId)))
    .limit(1);

  const row = rows[0];
  if (!row) throw new AppError('not_found');

  await database
    .delete(schema.nonNegotiables)
    .where(and(eq(schema.nonNegotiables.id, id), eq(schema.nonNegotiables.userId, userId)));
}

/* ── Patterns & observations ────────────────────────────────────────────────*/

export async function listPatterns(userId: string) {
  const database = await db();
  return database
    .select()
    .from(schema.behavioralPatterns)
    .where(eq(schema.behavioralPatterns.userId, userId));
}

export async function addPattern(
  userId: string,
  input: {
    label: string;
    pattern: string;
    trigger?: string;
    impact?: string;
    source: SourceKind;
    confidence: number;
  },
) {
  const database = await db();
  await database.insert(schema.behavioralPatterns).values({
    userId,
    ...input,
    hypothesis: true, // never a diagnosis
  });
}

export async function addObservation(
  userId: string,
  input: {
    text: string;
    channel: 'conversation' | 'reflection' | 'decision' | 'rating' | 'onboarding';
    domainKey?: string | null;
  },
) {
  const database = await db();
  await database.insert(schema.observations).values({
    userId,
    text: input.text,
    channel: input.channel,
    domainKey: input.domainKey ?? null,
  });
}

export async function listObservations(userId: string, limit = 30) {
  const database = await db();
  return database
    .select()
    .from(schema.observations)
    .where(eq(schema.observations.userId, userId))
    .orderBy(desc(schema.observations.capturedAt))
    .limit(limit);
}

/* ── Confirm / correct ──────────────────────────────────────────────────────*/

type ClaimTable = 'values' | 'strengths' | 'constraints' | 'non_negotiables' | 'blind_spots' | 'insights';

/**
 * The Confirm affordance. Promotes an inference to a user-confirmed fact, which
 * raises its authority above anything an agent can later propose.
 */
export async function confirmClaim(
  userId: string,
  table: ClaimTable,
  id: string,
): Promise<void> {
  const database = await db();
  const now = new Date();
  const patch = {
    source: 'user_confirmed' as const,
    status: 'confirmed' as const,
    confidence: 1,
    lastConfirmedAt: now,
    updatedAt: now,
  };

  switch (table) {
    case 'values':
      await database
        .update(schema.values)
        .set(patch)
        .where(and(eq(schema.values.id, id), eq(schema.values.userId, userId)));
      return;
    case 'strengths':
      await database
        .update(schema.strengths)
        .set(patch)
        .where(and(eq(schema.strengths.id, id), eq(schema.strengths.userId, userId)));
      return;
    case 'constraints':
      await database
        .update(schema.constraints)
        .set(patch)
        .where(and(eq(schema.constraints.id, id), eq(schema.constraints.userId, userId)));
      return;
    case 'non_negotiables':
      await database
        .update(schema.nonNegotiables)
        .set(patch)
        .where(and(eq(schema.nonNegotiables.id, id), eq(schema.nonNegotiables.userId, userId)));
      return;
    case 'blind_spots':
      await database
        .update(schema.blindSpots)
        .set({ ...patch, userResponse: 'accepted' })
        .where(and(eq(schema.blindSpots.id, id), eq(schema.blindSpots.userId, userId)));
      return;
    case 'insights':
      await database
        .update(schema.insights)
        .set(patch)
        .where(and(eq(schema.insights.id, id), eq(schema.insights.userId, userId)));
      return;
    default:
      throw new AppError('validation', 'unknown claim table');
  }
}

/** The Correct affordance. The person's rejection is itself a confirmed fact. */
export async function rejectClaim(
  userId: string,
  table: ClaimTable,
  id: string,
): Promise<void> {
  const database = await db();
  const patch = { status: 'rejected' as const, updatedAt: new Date() };

  if (table === 'blind_spots') {
    await database
      .update(schema.blindSpots)
      .set({ ...patch, userResponse: 'rejected' })
      .where(and(eq(schema.blindSpots.id, id), eq(schema.blindSpots.userId, userId)));
    return;
  }
  if (table === 'values') {
    await database
      .update(schema.values)
      .set(patch)
      .where(and(eq(schema.values.id, id), eq(schema.values.userId, userId)));
    return;
  }
  if (table === 'insights') {
    await database
      .update(schema.insights)
      .set(patch)
      .where(and(eq(schema.insights.id, id), eq(schema.insights.userId, userId)));
    return;
  }
  if (table === 'constraints') {
    await database
      .update(schema.constraints)
      .set(patch)
      .where(and(eq(schema.constraints.id, id), eq(schema.constraints.userId, userId)));
    return;
  }
  if (table === 'strengths') {
    await database
      .update(schema.strengths)
      .set(patch)
      .where(and(eq(schema.strengths.id, id), eq(schema.strengths.userId, userId)));
    return;
  }
  await database
    .update(schema.nonNegotiables)
    .set(patch)
    .where(and(eq(schema.nonNegotiables.id, id), eq(schema.nonNegotiables.userId, userId)));
}

/* ── Insights & blind spots ─────────────────────────────────────────────────*/

export async function listInsights(userId: string) {
  const database = await db();
  return database
    .select()
    .from(schema.insights)
    .where(
      and(
        eq(schema.insights.userId, userId),
        inArray(schema.insights.status, ['suggested', 'confirmed', 'draft']),
      ),
    )
    .orderBy(desc(schema.insights.createdAt));
}

export async function listBlindSpots(userId: string) {
  const database = await db();
  return database
    .select()
    .from(schema.blindSpots)
    .where(eq(schema.blindSpots.userId, userId))
    .orderBy(desc(schema.blindSpots.confidence));
}

export async function replaceBlindSpots(
  userId: string,
  items: Array<{ hypothesis: string; detail: string; confidence: number; basedOn: string[] }>,
): Promise<void> {
  const database = await db();
  // Replace only unanswered hypotheses — a person's accept/reject verdict outranks
  // any newly generated one and must survive regeneration.
  await database
    .delete(schema.blindSpots)
    .where(
      and(eq(schema.blindSpots.userId, userId), eq(schema.blindSpots.status, 'suggested')),
    );

  if (items.length === 0) return;

  await database.insert(schema.blindSpots).values(
    items.map((item) => ({
      userId,
      hypothesis: item.hypothesis,
      detail: item.detail,
      basedOn: item.basedOn,
      source: 'ai_inferred' as const,
      confidence: item.confidence,
      status: 'suggested' as const,
    })),
  );
}

export async function getInsightPlan(userId: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.insightPlans)
    .where(eq(schema.insightPlans.userId, userId))
    .orderBy(desc(schema.insightPlans.generatedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveInsightPlan(
  userId: string,
  sections: Array<{ title: string; body: string; source: string; confidence: number }>,
): Promise<void> {
  const database = await db();
  await database.insert(schema.insightPlans).values({ userId, sections });
}
