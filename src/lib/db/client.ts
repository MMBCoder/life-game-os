import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';
import { isServerlessRuntime } from '@/lib/runtime';

/**
 * One dialect, two drivers.
 *
 * `DATABASE_URL` set   → postgres-js against a real Postgres (production).
 * `DATABASE_URL` unset → PGlite, an embedded Postgres persisted to ./.data/pglite,
 *                        so the app runs locally with zero setup.
 *
 * Both are Postgres, so the SQL, the migrations and the query builder are identical
 * and no calling code knows the difference. See docs/decisions.md D1.
 */

/**
 * The common Drizzle surface both drivers implement. Typing this as a union of the
 * two concrete driver types would make every query builder call ambiguous at the
 * call site; `PgDatabase` is the shared interface they both satisfy.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

const PGLITE_DIR = process.env.PGLITE_DIR ?? './.data/pglite';

/**
 * Cached on globalThis so Next.js hot reloads and serverless warm invocations reuse
 * one connection. PGlite in particular is single-instance — creating a second one
 * against the same directory would fail on the lock file.
 */
type DbGlobal = {
  __lgos_db?: Database;
  __lgos_dbPromise?: Promise<Database>;
  __lgos_driver?: 'pglite' | 'postgres';
};

const globalForDb = globalThis as unknown as DbGlobal;

function isPostgresConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return typeof url === 'string' && url.trim().length > 0;
}

export function activeDriver(): 'pglite' | 'postgres' {
  return globalForDb.__lgos_driver ?? (isPostgresConfigured() ? 'postgres' : 'pglite');
}

/**
 * The embedded database writes to the deployment's own filesystem. On a serverless
 * host that filesystem is read-only, per-instance, and discarded on every cold start
 * — so falling back to it there does not mean "slower", it means every account and
 * all of its history silently disappears, and two concurrent instances disagree
 * about what exists.
 *
 * Refusing to start is the only safe behaviour. The alternative is an app that looks
 * like it works right up until someone signs back in and finds nothing.
 */
function assertPersistentStorage(): void {
  if (isPostgresConfigured() || !isServerlessRuntime()) return;

  throw new Error(
    'DATABASE_URL is not set, and this is a serverless deployment.\n' +
      'The embedded database would be discarded on every cold start, losing every ' +
      'account and all of its history.\n' +
      'Fix: provision a Postgres database, set DATABASE_URL, then run ' +
      '`npm run db:migrate` once against it. See README → Deployment.',
  );
}

async function createDatabase(): Promise<Database> {
  assertPersistentStorage();

  if (isPostgresConfigured()) {
    // Dynamic import keeps the postgres driver out of the bundle when unused.
    const postgres = (await import('postgres')).default;
    const client = postgres(process.env.DATABASE_URL as string, {
      // Serverless: a small pool per instance, with idle connections released.
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
    globalForDb.__lgos_driver = 'postgres';
    return drizzlePostgres(client, { schema }) as unknown as Database;
  }

  // PGlite creates its own data files but not intermediate directories.
  const { mkdir } = await import('node:fs/promises');
  await mkdir(PGLITE_DIR, { recursive: true });

  const { PGlite } = await import('@electric-sql/pglite');
  const client = new PGlite(PGLITE_DIR);
  await client.waitReady;
  globalForDb.__lgos_driver = 'pglite';
  return drizzlePglite(client, { schema }) as unknown as Database;
}

/**
 * Returns the shared database handle, creating it once. Concurrent callers during
 * cold start share a single in-flight promise rather than racing to build two.
 */
export async function getDb(): Promise<Database> {
  if (globalForDb.__lgos_db) return globalForDb.__lgos_db;
  if (!globalForDb.__lgos_dbPromise) {
    globalForDb.__lgos_dbPromise = createDatabase().then((db) => {
      globalForDb.__lgos_db = db;
      return db;
    });
  }
  return globalForDb.__lgos_dbPromise;
}

/** Test-only: drops the cached handle so a fresh in-memory instance can be created. */
export function __resetDbForTests(): void {
  delete globalForDb.__lgos_db;
  delete globalForDb.__lgos_dbPromise;
  delete globalForDb.__lgos_driver;
}

/** Test-only: injects a pre-built handle (e.g. an in-memory PGlite). */
export function __setDbForTests(db: Database, driver: 'pglite' | 'postgres' = 'pglite'): void {
  globalForDb.__lgos_db = db;
  globalForDb.__lgos_dbPromise = Promise.resolve(db);
  globalForDb.__lgos_driver = driver;
}

export { schema };
