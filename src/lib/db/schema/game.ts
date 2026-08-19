import {
  boolean,
  date,
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
import { lifeDomains } from './life';
import { provenance, provenanceWithoutStatus, timestamps } from './shared';
import {
  actionStatusEnum,
  decisionVerdictEnum,
  gameStatusEnum,
  goalDimensionEnum,
  itemStatusEnum,
  leverageCategoryEnum,
  likelihoodEnum,
  magnitudeEnum,
  severityEnum,
} from './enums';

/* ── Goals ──────────────────────────────────────────────────────────────────*/

export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    /** What the person actually typed, kept so we can show what we transformed. */
    rawInput: text('raw_input'),
    horizonMonths: integer('horizon_months').notNull().default(12),
    domainId: uuid('domain_id').references(() => lifeDomains.id, { onDelete: 'set null' }),
    isPrimary: boolean('is_primary').notNull().default(false),
    ...provenance,
  },
  (t) => [index('goals_user_idx').on(t.userId)],
);

/** A goal is never only an outcome. All four dimensions, always. */
export const wholeGoals = pgTable(
  'whole_goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    result: text('result').notNull(),
    experience: text('experience').notNull(),
    impact: text('impact').notNull(),
    identity: text('identity').notNull(),
    mostImportantDimension: goalDimensionEnum('most_important_dimension'),
    ...provenance,
  },
  (t) => [index('whole_goals_goal_idx').on(t.goalId)],
);

/* ── Game ───────────────────────────────────────────────────────────────────*/

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    purpose: text('purpose').notNull(),
    winningDefinition: text('winning_definition').notNull(),
    /** The differentiator: what winning explicitly does not require. */
    nonWinningDefinition: text('non_winning_definition').notNull(),
    strategicObjective: text('strategic_objective').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: gameStatusEnum('status').notNull().default('draft'),
    /** "Why this plan?" — required by the explainability law. */
    whyThisPlan: text('why_this_plan').notNull().default(''),
    /** "What we are not doing." */
    intentionalOmissions: jsonb('intentional_omissions').$type<string[]>().notNull().default([]),
    healthScore: real('health_score'),
    // `status` above is the game lifecycle, so provenance contributes everything
    // except its own status column.
    ...provenanceWithoutStatus,
  },
  (t) => [index('games_user_status_idx').on(t.userId, t.status)],
);

/**
 * Exactly three per game, one at each of day 30 / 60 / 90. The limit is enforced in
 * the repository and asserted in tests — three is the product decision, not a hint.
 */
export const boldResults = pgTable(
  'bold_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    dayMarker: integer('day_marker').notNull(),
    targetDate: date('target_date').notNull(),
    successDefinition: text('success_definition').notNull(),
    evidence: jsonb('evidence_list').$type<string[]>().notNull().default([]),
    leadingIndicators: jsonb('leading_indicators').$type<string[]>().notNull().default([]),
    dependencies: jsonb('dependencies').$type<string[]>().notNull().default([]),
    riskNotes: jsonb('risk_notes').$type<string[]>().notNull().default([]),
    confidence: real('bold_confidence').notNull().default(0.5),
    owner: text('owner').notNull().default('me'),
    progress: real('progress').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('bold_results_game_idx').on(t.gameId, t.dayMarker)],
);

export const milestones = pgTable(
  'milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    boldResultId: uuid('bold_result_id').references(() => boldResults.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    dueDate: date('due_date'),
    status: itemStatusEnum('status').notNull().default('draft'),
    ...timestamps,
  },
  (t) => [index('milestones_game_idx').on(t.gameId)],
);

/** Strategy, not tasks. `leverageCategory` is what stops "work harder" being a plan. */
export const strategicMoves = pgTable(
  'strategic_moves',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    detail: text('detail').notNull(),
    leverageCategory: leverageCategoryEnum('leverage_category'),
    expectedImpact: magnitudeEnum('expected_impact').notNull().default('medium'),
    effort: magnitudeEnum('effort').notNull().default('medium'),
    sequenceIndex: integer('sequence_index').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('strategic_moves_game_idx').on(t.gameId, t.sequenceIndex)],
);

export const stopListItems = pgTable(
  'stop_list_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    reason: text('reason').notNull(),
    ...provenance,
  },
  (t) => [index('stop_list_game_idx').on(t.gameId)],
);

export const protectListItems = pgTable(
  'protect_list_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    /** Links back to the non-negotiable it enforces, if any. */
    nonNegotiableId: uuid('non_negotiable_id'),
    reason: text('reason').notNull(),
    ...provenance,
  },
  (t) => [index('protect_list_game_idx').on(t.gameId)],
);

export const gameRisks = pgTable(
  'game_risks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    detail: text('detail').notNull(),
    severity: severityEnum('severity').notNull().default('medium'),
    likelihood: likelihoodEnum('likelihood').notNull().default('medium'),
    mitigation: text('mitigation').notNull(),
    ...timestamps,
  },
  (t) => [index('game_risks_game_idx').on(t.gameId)],
);

export const squadMembers = pgTable(
  'squad_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    relationship: text('relationship'),
    canHelpWith: text('can_help_with').notNull(),
    askDraft: text('ask_draft'),
    ...provenance,
  },
  (t) => [index('squad_user_idx').on(t.userId)],
);

/* ── Player ─────────────────────────────────────────────────────────────────*/

export const players = pgTable(
  'players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    identity: text('identity').notNull(),
    intention: text('intention').notNull(),
    mantra: text('mantra').notNull(),
    attitude: jsonb('attitude').$type<string[]>().notNull().default([]),
    actions: jsonb('actions').$type<string[]>().notNull().default([]),
    agreements: jsonb('agreements').$type<string[]>().notNull().default([]),
    boundaries: jsonb('boundaries').$type<string[]>().notNull().default([]),
    strengths: jsonb('strengths').$type<string[]>().notNull().default([]),
    watchOuts: jsonb('watch_outs').$type<string[]>().notNull().default([]),
    whyThisFits: text('why_this_fits'),
    isActive: boolean('is_active').notNull().default(false),
    ...provenance,
  },
  (t) => [index('players_user_active_idx').on(t.userId, t.isActive)],
);

/** Every Ask My Player consultation, kept so patterns in decisions become visible. */
export const decisions = pgTable(
  'decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'set null' }),
    question: text('question').notNull(),
    context: text('context'),
    verdict: decisionVerdictEnum('verdict').notNull(),
    headline: text('headline').notNull(),
    reasoning: text('reasoning').notNull(),
    conflictsWith: jsonb('conflicts_with').$type<string[]>().notNull().default([]),
    supports: jsonb('supports').$type<string[]>().notNull().default([]),
    betterMove: text('better_move'),
    opportunityCost: text('opportunity_cost'),
    councilRunId: uuid('council_run_id'),
    confidence: real('decision_confidence').notNull().default(0.5),
    /** What the person actually did — closes the loop for the Reflection Agent. */
    userOutcome: text('user_outcome'),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('decisions_user_idx').on(t.userId, t.decidedAt)],
);

/* ── Actions ────────────────────────────────────────────────────────────────*/

export const actions = pgTable(
  'actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }),
    boldResultId: uuid('bold_result_id').references(() => boldResults.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    kind: text('kind').notNull().default('strategic'),
    why: text('why'),
    date: date('date').notNull(),
    status: actionStatusEnum('status').notNull().default('planned'),
    energyCost: magnitudeEnum('energy_cost').notNull().default('medium'),
    timeMinutes: integer('time_minutes').notNull().default(30),
    /** One of today's three moves, as opposed to background work. */
    isTodayMove: boolean('is_today_move').notNull().default(false),
    ...timestamps,
  },
  (t) => [index('actions_user_date_idx').on(t.userId, t.date)],
);
