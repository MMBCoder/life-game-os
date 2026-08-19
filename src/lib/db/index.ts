import { getDb, activeDriver, type Database } from './client';
import { ensureLocalSchema } from './migrate';
import * as schema from './schema';

/**
 * The single accessor every repository uses. It guarantees the local embedded
 * database has its schema before the first query, so `npm run dev` needs no setup.
 */
export async function db(): Promise<Database> {
  await ensureLocalSchema();
  return getDb();
}

export { schema, activeDriver };
export type { Database };
