import type { Config } from 'drizzle-kit';

// drizzle-kit only needs the dialect and paths to generate SQL from the schema.
// Migrations are applied by scripts/migrate.ts, which handles both PGlite and real
// Postgres — drizzle-kit's own push/migrate commands are not used here.
export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/life_game_os',
  },
  strict: true,
  verbose: true,
} satisfies Config;
