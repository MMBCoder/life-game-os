import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { CouncilRunResult } from '@/agents/orchestrator';
import type { SacrificeResult } from '@/lib/scoring/sacrifice';

/**
 * Persists a council run in full: the run, each agent's execution record and output,
 * the conflicts, and the decision.
 *
 * Note what is not written: private chain-of-thought. `reasoning` holds only the
 * concise user-facing summary (spec §47).
 */
export async function persistCouncilRun(
  userId: string,
  result: CouncilRunResult,
): Promise<{ councilRunId: string }> {
  const database = await db();

  const runRows = await database
    .insert(schema.councilRuns)
    .values({
      userId,
      purpose: result.purpose,
      status: result.failedAgents.length === 0 ? 'succeeded' : result.outputs.length > 0 ? 'partial' : 'failed',
      finishedAt: new Date(),
      latencyMs: result.latencyMs,
      agentCount: result.records.length,
      provider: result.provider,
      totalInputTokens: result.totalInputTokens,
      totalOutputTokens: result.totalOutputTokens,
      estimatedCostUsd: result.estimatedCostUsd,
      error: result.failedAgents.length > 0 ? `failed: ${result.failedAgents.join(',')}` : null,
    })
    .returning({ id: schema.councilRuns.id });

  const councilRunId = runRows[0]?.id;
  if (!councilRunId) return { councilRunId: '' };

  for (const record of result.records) {
    const agentRunRows = await database
      .insert(schema.agentRuns)
      .values({
        userId,
        councilRunId,
        agent: record.agent,
        purpose: result.purpose,
        status: record.status,
        confidence: record.output?.confidence ?? null,
        provider: record.provider,
        model: record.model,
        latencyMs: record.latencyMs,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        estimatedCostUsd: record.estimatedCostUsd,
        validationAttempts: record.validationAttempts,
        error: record.error,
      })
      .returning({ id: schema.agentRuns.id });

    const agentRunId = agentRunRows[0]?.id;
    if (!agentRunId || !record.output) continue;

    await database.insert(schema.agentOutputs).values({
      userId,
      agentRunId,
      payload: record.output,
      summary: record.output.summary,
      reasoning: record.output.reasoning,
      evidence: record.output.evidence,
    });
  }

  if (result.conflicts.length > 0) {
    await database.insert(schema.agentConflicts).values(
      result.conflicts.map((c) => ({
        userId,
        councilRunId,
        kind: c.kind,
        raisedBy: c.raisedBy,
        against: c.against,
        claim: c.claim,
        severity: c.severity,
        resolution: c.resolution,
        resolvedInFavourOf: c.resolvedInFavourOf,
      })),
    );
  }

  await database.insert(schema.agentDecisions).values({
    userId,
    councilRunId,
    verdict: result.decision.verdict,
    headline: result.decision.headline,
    rationale: result.decision.rationale,
    tradeOffs: result.decision.tradeOffs,
    omissions: result.decision.omissions,
    confidence: result.decision.confidence,
    nextQuestion: result.decision.nextQuestion ?? null,
  });

  // Recommendations become actionable items the user can accept or reject, rather
  // than text buried inside a decision.
  const recommendations = result.outputs.flatMap((o) =>
    o.recommendations.map((r) => ({
      userId,
      councilRunId,
      target: o.agent,
      title: r.title,
      detail: r.detail,
      rationale: r.rationale,
      priority: r.priority,
      leverage: r.leverage ?? null,
    })),
  );
  if (recommendations.length > 0) {
    await database.insert(schema.recommendations).values(recommendations);
  }

  return { councilRunId };
}

export async function getCouncilRun(userId: string, councilRunId: string) {
  const database = await db();

  const runs = await database
    .select()
    .from(schema.councilRuns)
    .where(and(eq(schema.councilRuns.id, councilRunId), eq(schema.councilRuns.userId, userId)))
    .limit(1);

  const run = runs[0];
  if (!run) return null;

  const [agentRuns, conflicts, decisions] = await Promise.all([
    database
      .select()
      .from(schema.agentRuns)
      .where(eq(schema.agentRuns.councilRunId, councilRunId)),
    database
      .select()
      .from(schema.agentConflicts)
      .where(eq(schema.agentConflicts.councilRunId, councilRunId)),
    database
      .select()
      .from(schema.agentDecisions)
      .where(eq(schema.agentDecisions.councilRunId, councilRunId))
      .limit(1),
  ]);

  const outputs =
    agentRuns.length > 0
      ? await database
          .select()
          .from(schema.agentOutputs)
          .where(eq(schema.agentOutputs.userId, userId))
      : [];

  const runIds = new Set(agentRuns.map((r) => r.id));

  return {
    run,
    agentRuns,
    outputs: outputs.filter((o) => runIds.has(o.agentRunId)),
    conflicts,
    decision: decisions[0] ?? null,
  };
}

export async function latestCouncilRun(userId: string, purpose?: string) {
  const database = await db();
  const where = purpose
    ? and(
        eq(schema.councilRuns.userId, userId),
        eq(schema.councilRuns.purpose, purpose as typeof schema.councilRuns.$inferSelect.purpose),
      )
    : eq(schema.councilRuns.userId, userId);

  const rows = await database
    .select()
    .from(schema.councilRuns)
    .where(where)
    .orderBy(desc(schema.councilRuns.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listCouncilRuns(userId: string, limit = 25) {
  const database = await db();
  return database
    .select()
    .from(schema.councilRuns)
    .where(eq(schema.councilRuns.userId, userId))
    .orderBy(desc(schema.councilRuns.startedAt))
    .limit(limit);
}

/** Observability feed for /admin. */
export async function listAgentRuns(userId: string, limit = 100) {
  const database = await db();
  return database
    .select()
    .from(schema.agentRuns)
    .where(eq(schema.agentRuns.userId, userId))
    .orderBy(desc(schema.agentRuns.createdAt))
    .limit(limit);
}

export async function listConflicts(userId: string, limit = 50) {
  const database = await db();
  return database
    .select()
    .from(schema.agentConflicts)
    .where(eq(schema.agentConflicts.userId, userId))
    .orderBy(desc(schema.agentConflicts.createdAt))
    .limit(limit);
}

export async function listRecommendations(userId: string, limit = 30) {
  const database = await db();
  return database
    .select()
    .from(schema.recommendations)
    .where(eq(schema.recommendations.userId, userId))
    .orderBy(desc(schema.recommendations.createdAt))
    .limit(limit);
}

export async function setRecommendationStatus(
  userId: string,
  id: string,
  status: 'suggested' | 'accepted' | 'rejected' | 'applied',
): Promise<void> {
  const database = await db();
  await database
    .update(schema.recommendations)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(schema.recommendations.id, id), eq(schema.recommendations.userId, userId)));
}

export async function confirmDecision(userId: string, councilRunId: string): Promise<void> {
  const database = await db();
  await database
    .update(schema.agentDecisions)
    .set({ userConfirmedAt: new Date() })
    .where(
      and(
        eq(schema.agentDecisions.councilRunId, councilRunId),
        eq(schema.agentDecisions.userId, userId),
      ),
    );
}

/* ── Sacrifice ──────────────────────────────────────────────────────────────*/

export async function saveSacrificeAssessment(
  userId: string,
  result: SacrificeResult,
  options: {
    gameId?: string | null;
    councilRunId?: string | null;
    alternatives: Array<{ title: string; detail: string; leverage: string }>;
  },
): Promise<void> {
  const database = await db();
  await database.insert(schema.sacrificeAssessments).values({
    userId,
    gameId: options.gameId ?? null,
    councilRunId: options.councilRunId ?? null,
    scores: result.scores,
    verdict: result.verdict,
    warning: result.warning,
    alternatives: options.alternatives,
  });
}

export async function latestSacrifice(userId: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.sacrificeAssessments)
    .where(eq(schema.sacrificeAssessments.userId, userId))
    .orderBy(desc(schema.sacrificeAssessments.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
