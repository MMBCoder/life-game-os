/**
 * Drops the local embedded database so it can be rebuilt from scratch.
 *   npm run db:reset
 *
 * Refuses to touch a real Postgres — resetting production data is not something a
 * convenience script should be able to do.
 */
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { postgresUrl } from '../src/lib/db/client';

async function main() {
  // Shares the app's resolver rather than checking one variable, so the guard cannot
  // drift out of step with what actually counts as "a real database".
  if (postgresUrl()) {
    console.error(
      '✗ A Postgres connection string is set (DATABASE_URL or POSTGRES_URL).\n' +
        '  This script only resets the local embedded database.\n' +
        '  To reset a real database, do it deliberately with your own tooling.',
    );
    process.exit(1);
  }

  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), '.data', 'pglite');
  await rm(dir, { recursive: true, force: true });

  console.log(`✓ Removed ${dir}`);
  console.log('  Run `npm run db:seed` to rebuild with the demo account.');
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error('✗ Reset failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
