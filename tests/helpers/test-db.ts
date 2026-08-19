import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'node:path';
import * as schema from '@/lib/db/schema';
import { __resetDbForTests, __setDbForTests, type Database } from '@/lib/db/client';

/**
 * An in-memory Postgres per test file.
 *
 * PGlite runs the real engine in WASM, so integration tests exercise the actual SQL,
 * the actual constraints and the actual cascade behaviour — not a mock.
 */
export async function setupTestDb(): Promise<Database> {
  __resetDbForTests();

  const client = new PGlite(); // in-memory
  await client.waitReady;
  const database = drizzle(client, { schema }) as unknown as Database;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migrator is driver-typed
  await migrate(database as any, {
    migrationsFolder: path.join(process.cwd(), 'drizzle'),
  });

  __setDbForTests(database);
  return database;
}

export async function teardownTestDb(): Promise<void> {
  __resetDbForTests();
}
