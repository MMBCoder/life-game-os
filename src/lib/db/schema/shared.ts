import { jsonb, real, timestamp } from 'drizzle-orm/pg-core';
import { itemStatusEnum, sourceKindEnum } from './enums';
import type { EvidenceRef } from '@/schemas/common';

/**
 * Provenance columns, spread into every table that holds a claim about the user.
 * Required by CLAUDE.md §4 — the product must always be able to distinguish what
 * the person said from what the system inferred.
 */
const provenanceCore = {
  source: sourceKindEnum('source').notNull().default('ai_inferred'),
  confidence: real('confidence').notNull().default(0.5),
  evidence: jsonb('evidence').$type<EvidenceRef[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  /** Null until the person has explicitly accepted the claim. */
  lastConfirmedAt: timestamp('last_confirmed_at', { withTimezone: true }),
};

export const provenance = {
  ...provenanceCore,
  status: itemStatusEnum('status').notNull().default('suggested'),
};

/**
 * For tables that already own a `status` column with different semantics — `games`
 * tracks a lifecycle (draft → active → completed), not a provenance state.
 */
export const provenanceWithoutStatus = provenanceCore;

/** Timestamps for rows that make no claim about the user. */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};
