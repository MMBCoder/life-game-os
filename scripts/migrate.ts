/**
 * Applies pending migrations to whichever database is configured.
 *   npm run db:migrate
 */
import { postgresUrl } from '../src/lib/db/client';
import { runMigrations } from '../src/lib/db/migrate';

async function main() {
  // Reports the *target*, not `activeDriver()`, which returns its embedded fallback
  // when nothing is configured — printing "driver: pglite" immediately before an
  // error saying no connection string exists reads like a contradiction.
  const target = postgresUrl() ? 'postgres (DATABASE_URL/POSTGRES_URL)' : 'embedded pglite (local)';
  console.log(`Applying migrations to: ${target}`);

  await runMigrations();
  console.log('✓ Migrations applied.');
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error('✗ Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
