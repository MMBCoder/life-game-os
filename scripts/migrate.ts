/**
 * Applies pending migrations to whichever database is configured.
 *   npm run db:migrate
 */
import { activeDriver } from '../src/lib/db/client';
import { runMigrations } from '../src/lib/db/migrate';

async function main() {
  const driver = activeDriver();
  console.log(`Applying migrations (driver: ${driver})…`);
  await runMigrations();
  console.log('✓ Migrations applied.');
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error('✗ Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
