/**
 * Single entry point for the database schema. drizzle-kit reads this file; the
 * definitions are split by concern under ./schema/ to keep each module readable.
 */
export * from './schema/enums';
export * from './schema/shared';
export * from './schema/identity';
export * from './schema/life';
export * from './schema/game';
export * from './schema/execution';
export * from './schema/council';
