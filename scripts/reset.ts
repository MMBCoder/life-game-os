/**
 * Drops the local embedded database so it can be rebuilt from scratch.
 *   npm run db:reset
 *
 * Refuses to touch a real Postgres — resetting production data is not something a
 * convenience script should be able to do.
 */
import { rm } from 'node:fs/promises';
import path from 'node:path';

async function main() {
  if (process.env.DATABASE_URL?.trim()) {
    console.error(
      '✗ DATABASE_URL is set. This script only resets the local embedded database.\n' +
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
