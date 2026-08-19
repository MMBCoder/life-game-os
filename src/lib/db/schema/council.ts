import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';
import { games } from './game';
import { timestamps } from './shared';
import {
  agentIdEnum,
  conflictKindEnum,
  councilPurposeEnum,
  councilVerdictEnum,
  recommendationStatusEnum,
  runStatusEnum,
  sacrificeVerdictEnum,
  severityEnum,
} from './enums';
import type { AgentOutput } from '@/schemas/agent';
import type { EvidenceRef } from '@/schemas/common';

/**
 * Observability spine. Every significant council execution is recorded so the
 * multi-agent behaviour is debuggable and its cost visible (spec §47, §63).
 *
 * Note what is deliberately absent: private chain-of-thought. Only the concise,
 * user-facing reasoning summary is persisted.
 */
export const councilRuns = pgTable(
  'council_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: councilPurposeEnum('purpose').notNull(),
    status: runStatusEnum('status').notNull().default('running'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    latencyMs: integer('latency_ms'),
    agentCount: integer('agent_count').notNull().default(0),
    provider: text('provider').notNull(),
    totalInputTokens: integer('total_input_tokens').notNull().default(0),
    totalOutputTokens: integer('total_output_tokens').notNull().default(0),
    estimatedCostUsd: real('estimated_cost_usd').notNull().default(0),
    error: text('error'),
  },
  (t) => [index('council_runs_user_idx').on(t.userId, t.startedAt)],
);

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    councilRunId: uuid('council_run_id')
      .notNull()
      .references(() => councilRuns.id, { onDelete: 'cascade' }),
    agent: agentIdEnum('agent').notNull(),
    purpose: councilPurposeEnum('purpose').notNull(),
    status: runStatusEnum('status').notNull().default('running'),
    confidence: real('confidence'),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    latencyMs: integer('latency_ms'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    estimatedCostUsd: real('estimated_cost_usd').notNull().default(0),
    /** 1 normally; 2 when a schema-repair round trip was needed. */
    validationAttempts: integer('validation_attempts').notNull().default(1),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('agent_runs_council_idx').on(t.councilRunId),
    index('agent_runs_user_agent_idx').on(t.userId, t.agent),
  ],
);

export const agentOutputs = pgTable(
  'agent_outputs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentRunId: uuid('agent_run_id')
      .notNull()
      .references(() => agentRuns.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').$type<AgentOutput>().notNull(),
    summary: text('summary').notNull(),
    reasoning: jsonb('reasoning').$type<string[]>().notNull().default([]),
    evidence: jsonb('evidence').$type<EvidenceRef[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('agent_outputs_run_idx').on(t.agentRunId)],
);

/** Persisted disagreement. This is a product feature, not just a log. */
export const agentConflicts = pgTable(
  'agent_conflicts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    councilRunId: uuid('council_run_id')
      .notNull()
      .references(() => councilRuns.id, { onDelete: 'cascade' }),
    kind: conflictKindEnum('kind').notNull(),
    raisedBy: agentIdEnum('raised_by').notNull(),
    against: agentIdEnum('against'),
    claim: text('claim').notNull(),
    severity: severityEnum('severity').notNull(),
    resolution: text('resolution').notNull(),
    resolvedInFavourOf: agentIdEnum('resolved_in_favour_of'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('agent_conflicts_council_idx').on(t.councilRunId)],
);

export const agentDecisions = pgTable(
  'agent_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    councilRunId: uuid('council_run_id')
      .notNull()
      .references(() => councilRuns.id, { onDelete: 'cascade' }),
    verdict: councilVerdictEnum('verdict').notNull(),
    headline: text('headline').notNull(),
    rationale: text('rationale').notNull(),
    tradeOffs: jsonb('trade_offs').$type<string[]>().notNull().default([]),
    omissions: jsonb('omissions').$type<string[]>().notNull().default([]),
    confidence: real('confidence').notNull().default(0.5),
    nextQuestion: jsonb('next_question').$type<Record<string, unknown>>(),
    userConfirmedAt: timestamp('user_confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('agent_decisions_council_idx').on(t.councilRunId)],
);

export const recommendations = pgTable(
  'recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    councilRunId: uuid('council_run_id').references(() => councilRuns.id, {
      onDelete: 'set null',
    }),
    target: text('target').notNull(),
    title: text('title').notNull(),
    detail: text('detail').notNull(),
    rationale: text('rationale').notNull(),
    priority: text('priority').notNull().default('medium'),
    leverage: text('leverage'),
    status: recommendationStatusEnum('status').notNull().default('suggested'),
    ...timestamps,
  },
  (t) => [index('recommendations_user_status_idx').on(t.userId, t.status)],
);

/**
 * Sacrifice Radar results. `verdict` is computed deterministically in
 * src/lib/scoring — protection must be reliable, not probabilistic (decisions.md D7).
 */
export const sacrificeAssessments = pgTable(
  'sacrifice_assessments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }),
    councilRunId: uuid('council_run_id').references(() => councilRuns.id, {
      onDelete: 'set null',
    }),
    /** domainKey → delta in −3…+3 */
    scores: jsonb('scores')
      .$type<{ domainKey: string; delta: number; why: string }[]>()
      .notNull()
      .default([]),
    verdict: sacrificeVerdictEnum('verdict').notNull(),
    warning: text('warning'),
    alternatives: jsonb('alternatives')
      .$type<{ title: string; detail: string; leverage: string }[]>()
      .notNull()
      .default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sacrifice_user_idx').on(t.userId, t.createdAt)],
);
