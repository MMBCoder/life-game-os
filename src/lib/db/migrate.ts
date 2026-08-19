import path from 'node:path';
import { activeDriver, getDb, type Database } from './client';

/** Resolved lazily — `process.cwd()` at module scope breaks the Edge bundler. */
function migrationsFolder(): string {
  return path.join(process.cwd(), 'drizzle');
}

/**
 * Applies pending migrations. Drizzle exposes a driver-specific migrator, so the
 * correct one is selected from the active driver — the SQL files are shared.
 */
export async function runMigrations(db?: Database): Promise<void> {
  const database = db ?? (await getDb());

  // The two driver migrators are structurally identical but nominally distinct, so
  // each needs its own narrowing cast; the driver check establishes which applies.
  if (activeDriver() === 'postgres') {
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    await migrate(database as unknown as Parameters<typeof migrate>[0], {
      migrationsFolder: migrationsFolder(),
    });
    return;
  }

  const { migrate } = await import('drizzle-orm/pglite/migrator');
  await migrate(database as unknown as Parameters<typeof migrate>[0], {
    migrationsFolder: migrationsFolder(),
  });
}

type MigrationGlobal = { __lgos_migrated?: Promise<void> };
const globalForMigration = globalThis as unknown as MigrationGlobal;

/**
 * Local-development convenience: the embedded database migrates itself on first
 * use, which is what makes `npm run dev` work with no setup step. Real Postgres is
 * never migrated implicitly — that is an explicit, reviewable deploy action
 * (`npm run db:migrate`).
 */
export async function ensureLocalSchema(): Promise<void> {
  if (activeDriver() === 'postgres') return;
  if (!globalForMigration.__lgos_migrated) {
    globalForMigration.__lgos_migrated = runMigrations();
  }
  await globalForMigration.__lgos_migrated;
}
