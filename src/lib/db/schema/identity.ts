import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  constraintCategoryEnum,
  hardnessEnum,
  memoryLayerEnum,
  observationChannelEnum,
  severityEnum,
  sourceKindEnum,
} from './enums';
import { provenance, timestamps } from './shared';
import { real } from 'drizzle-orm/pg-core';
import { itemStatusEnum } from './enums';

/* ── Account ────────────────────────────────────────────────────────────────*/

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    passwordSalt: text('password_salt').notNull(),
    name: text('name').notNull(),
    /** IANA zone. "Today" is resolved server-side from this — see docs/decisions.md D11. */
    timezone: text('timezone').notNull().default('UTC'),
    isDemo: boolean('is_demo').notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the cookie token. The raw token is never stored. */
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_unique').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
  ],
);

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name'),
    pronouns: text('pronouns'),
    role: text('role'),
    lifeStage: text('life_stage'),
    /** Progressive discovery: onboarding produces ~60–70% of the model, not all of it. */
    onboardingStage: text('onboarding_stage').notNull().default('not_started'),
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('profiles_user_unique').on(t.userId)],
);

/* ── Personal Model: identity ───────────────────────────────────────────────*/

export const identityModels = pgTable(
  'identity_models',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    currentIdentity: text('current_identity'),
    emergingIdentity: text('emerging_identity'),
    desiredIdentity: text('desired_identity'),
    identityTensions: jsonb('identity_tensions').$type<string[]>().notNull().default([]),
    motivators: jsonb('motivators').$type<string[]>().notNull().default([]),
    fears: jsonb('fears').$type<string[]>().notNull().default([]),
    naturalTendencies: jsonb('natural_tendencies').$type<string[]>().notNull().default([]),
    ...provenance,
  },
  (t) => [uniqueIndex('identity_models_user_unique').on(t.userId)],
);

export const values = pgTable(
  'values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    kind: text('kind', { enum: ['value', 'principle'] }).notNull().default('value'),
    importance: integer('importance').notNull().default(5),
    note: text('note'),
    ...provenance,
  },
  (t) => [index('values_user_idx').on(t.userId)],
);

export const strengths = pgTable(
  'strengths',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    /** `overdone` captures "what I tend to overdo" — a strength past its useful range. */
    kind: text('kind', { enum: ['strength', 'overdone'] }).notNull().default('strength'),
    note: text('note'),
    ...provenance,
  },
  (t) => [index('strengths_user_idx').on(t.userId)],
);

/* ── Personal Model: reality ────────────────────────────────────────────────*/

export const constraints = pgTable(
  'constraints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    category: constraintCategoryEnum('category').notNull(),
    severity: severityEnum('severity').notNull().default('medium'),
    note: text('note'),
    ...provenance,
  },
  (t) => [index('constraints_user_idx').on(t.userId)],
);

/**
 * The Protect List's source of truth. A `firm` non-negotiable is a hard block in
 * conflict detection — no strategy may breach it, regardless of upside.
 */
export const nonNegotiables = pgTable(
  'non_negotiables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    domainKey: text('domain_key'),
    hardness: hardnessEnum('hardness').notNull().default('strong'),
    note: text('note'),
    ...provenance,
  },
  (t) => [index('non_negotiables_user_idx').on(t.userId)],
);

/**
 * Behavioural tendencies. Never a diagnosis: `hypothesis` is always true and the
 * UI renders these as "possible pattern" with confidence and evidence.
 */
export const behavioralPatterns = pgTable(
  'behavioral_patterns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    pattern: text('pattern').notNull(),
    trigger: text('trigger'),
    impact: text('impact'),
    hypothesis: boolean('hypothesis').notNull().default(true),
    ...provenance,
  },
  (t) => [index('behavioral_patterns_user_idx').on(t.userId)],
);

/** Raw signals. Everything the system infers must trace back to one of these. */
export const observations = pgTable(
  'observations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    channel: observationChannelEnum('channel').notNull(),
    domainKey: text('domain_key'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('observations_user_idx').on(t.userId, t.capturedAt)],
);

/* ── Memory ─────────────────────────────────────────────────────────────────*/

export const memoryItems = pgTable(
  'memory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    layer: memoryLayerEnum('layer').notNull(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    context: text('context'),
    source: sourceKindEnum('source').notNull().default('ai_inferred'),
    confidence: real('confidence').notNull().default(0.5),
    status: itemStatusEnum('status').notNull().default('suggested'),
    /** Episodic memories carry when the event happened, not when it was recorded. */
    episodeAt: timestamp('episode_at', { withTimezone: true }),
    supersededById: uuid('superseded_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastConfirmedAt: timestamp('last_confirmed_at', { withTimezone: true }),
  },
  (t) => [
    index('memory_items_user_layer_idx').on(t.userId, t.layer),
    index('memory_items_key_idx').on(t.userId, t.key),
  ],
);
