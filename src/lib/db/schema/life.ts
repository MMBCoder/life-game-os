import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';
import { provenance, timestamps } from './shared';

/**
 * Life domains. Seeded with the ten defaults on account creation and extensible by
 * the user. Never hard-deleted — `isActive` preserves the score history that
 * deletion would orphan (docs/decisions.md D10).
 */
export const lifeDomains = pgTable(
  'life_domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    orderIndex: integer('order_index').notNull().default(0),
    isCustom: boolean('is_custom').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('life_domains_user_key_unique').on(t.userId, t.key)],
);

/**
 * Append-only. A correction writes a new row rather than updating, because the
 * monthly review and the adaptation engine both need trajectory, not just the
 * current position (docs/decisions.md D8).
 *
 * `outerResult` vs `innerExperience` is the product's signature mechanism: a high
 * outer score with a low inner score is the divergence the insight engine hunts for.
 */
export const lifeScores = pgTable(
  'life_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    domainId: uuid('domain_id')
      .notNull()
      .references(() => lifeDomains.id, { onDelete: 'cascade' }),
    currentExperience: real('current_experience').notNull(),
    desiredExperience: real('desired_experience').notNull(),
    outerResult: real('outer_result').notNull(),
    innerExperience: real('inner_experience').notNull(),
    importance: real('importance').notNull(),
    energy: real('energy').notNull(),
    satisfaction: real('satisfaction').notNull(),
    risk: real('risk').notNull(),
    momentum: real('momentum').notNull(),
    basis: text('basis'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    ...provenance,
  },
  (t) => [
    index('life_scores_user_domain_idx').on(t.userId, t.domainId, t.capturedAt),
    index('life_scores_user_captured_idx').on(t.userId, t.capturedAt),
  ],
);
