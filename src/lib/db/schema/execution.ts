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
import { games } from './game';
import { provenance, timestamps } from './shared';
import {
  insightKindEnum,
  itemStatusEnum,
  operatingStateEnum,
  planModeEnum,
  reflectionKindEnum,
  ritualCategoryEnum,
  routineSlotEnum,
  userResponseEnum,
} from './enums';

/* ── Protocol ───────────────────────────────────────────────────────────────*/

export const protocols = pgTable(
  'protocols',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'set null' }),
    isActive: boolean('is_active').notNull().default(true),
    ...provenance,
  },
  (t) => [index('protocols_user_active_idx').on(t.userId, t.isActive)],
);

/**
 * Three modes per item so the person is never all-or-nothing. A bad day still has a
 * defined move; that is what stops a missed day from becoming a missed month.
 */
export const protocolItems = pgTable(
  'protocol_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    protocolId: uuid('protocol_id')
      .notNull()
      .references(() => protocols.id, { onDelete: 'cascade' }),
    domainId: uuid('domain_id').references(() => lifeDomains.id, { onDelete: 'set null' }),
    label: text('label').notNull(),
    minimum: text('minimum').notNull(),
    standard: text('standard').notNull(),
    expansion: text('expansion').notNull(),
    orderIndex: integer('order_index').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('protocol_items_protocol_idx').on(t.protocolId, t.orderIndex)],
);

export const rituals = pgTable(
  'rituals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: ritualCategoryEnum('category').notNull(),
    name: text('name').notNull(),
    detail: text('detail').notNull(),
    cadence: text('cadence').notNull(),
    /** Personalised justification — the guard against generic ritual lists. */
    whyThisFits: text('why_this_fits').notNull(),
    ...provenance,
  },
  (t) => [index('rituals_user_idx').on(t.userId)],
);

export const routines = pgTable(
  'routines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slot: routineSlotEnum('slot').notNull(),
    name: text('name').notNull(),
    steps: jsonb('steps').$type<string[]>().notNull().default([]),
    durationMinutes: integer('duration_minutes').notNull().default(15),
    ...provenance,
  },
  (t) => [index('routines_user_slot_idx').on(t.userId, t.slot)],
);

/* ── State ──────────────────────────────────────────────────────────────────*/

/** Append-only. Trajectory matters more than the current reading. */
export const stateSnapshots = pgTable(
  'state_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    operatingState: operatingStateEnum('operating_state').notNull(),
    confidence: real('state_confidence').notNull().default(0.5),
    drivers: jsonb('drivers').$type<string[]>().notNull().default([]),
    focus: real('focus').notNull(),
    energy: real('energy').notNull(),
    alignment: real('alignment').notNull(),
    capacity: real('capacity').notNull(),
    /** The person can always override the system's read of their own state. */
    userOverride: boolean('user_override').notNull().default(false),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('state_snapshots_user_idx').on(t.userId, t.capturedAt)],
);

/**
 * Intentional Momentum, 1–10. Not a mental-health score: it measures how
 * intentionally the person is operating toward their chosen game. The component
 * breakdown is stored so the computation can always be shown, never hidden.
 */
export const intentionSnapshots = pgTable(
  'intention_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    level: integer('level').notNull(),
    computed: integer('computed').notNull(),
    components: jsonb('components')
      .$type<{
        clarity: number;
        commitment: number;
        alignment: number;
        action: number;
        capacity: number;
        consistency: number;
        resistance: number;
      }>()
      .notNull(),
    explanation: text('explanation').notNull(),
    accepted: boolean('accepted').notNull().default(false),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('intention_snapshots_user_idx').on(t.userId, t.capturedAt)],
);

/* ── Reflection ─────────────────────────────────────────────────────────────*/

export const reflections = pgTable(
  'reflections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: reflectionKindEnum('kind').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    /** Quick-select answers keyed by question id; free text is optional throughout. */
    answers: jsonb('answers').$type<Record<string, unknown>>().notNull().default({}),
    moved: jsonb('moved').$type<string[]>().notNull().default([]),
    didntMove: jsonb('didnt_move').$type<string[]>().notNull().default([]),
    surprises: text('surprises'),
    feeling: text('feeling'),
    costMoreThanExpected: text('cost_more_than_expected'),
    gaveEnergy: text('gave_energy'),
    shouldChange: text('should_change'),
    /** The generated intelligence for this period, so it is never recomputed. */
    intelligence: jsonb('intelligence').$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [index('reflections_user_kind_idx').on(t.userId, t.kind, t.periodStart)],
);

export const insights = pgTable(
  'insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: insightKindEnum('kind').notNull().default('insight'),
    title: text('title').notNull(),
    detail: text('detail').notNull(),
    domainId: uuid('domain_id').references(() => lifeDomains.id, { onDelete: 'set null' }),
    ...provenance,
  },
  (t) => [index('insights_user_idx').on(t.userId)],
);

/**
 * Potential blind spots. Always a hypothesis, always with confidence and evidence,
 * always correctable. `userResponse` records the person's verdict, which outranks
 * the system's.
 */
export const blindSpots = pgTable(
  'blind_spots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    hypothesis: text('hypothesis').notNull(),
    detail: text('detail').notNull(),
    basedOn: jsonb('based_on').$type<string[]>().notNull().default([]),
    userResponse: userResponseEnum('user_response'),
    ...provenance,
  },
  (t) => [index('blind_spots_user_idx').on(t.userId)],
);

export const insightPlans = pgTable(
  'insight_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sections: jsonb('sections')
      .$type<{ title: string; body: string; source: string; confidence: number }[]>()
      .notNull()
      .default([]),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    status: itemStatusEnum('status').notNull().default('suggested'),
  },
  (t) => [index('insight_plans_user_idx').on(t.userId, t.generatedAt)],
);

/* ── Daily play mode selection ──────────────────────────────────────────────*/

export const dayLogs = pgTable(
  'day_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    mode: planModeEnum('mode').notNull().default('standard'),
    councilNote: text('council_note'),
    oneDecision: text('one_decision'),
    ...timestamps,
  },
  (t) => [index('day_logs_user_date_idx').on(t.userId, t.date)],
);
