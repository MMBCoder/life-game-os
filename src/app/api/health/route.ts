import { NextResponse } from 'next/server';
import { db, schema, activeDriver } from '@/lib/db';
import { postgresUrl } from '@/lib/db/client';
import { resolveProviderChoice } from '@/lib/ai/config';
import { isServerlessRuntime } from '@/lib/runtime';

/**
 * Deployment diagnostics.
 *
 * The app deliberately shows users a generic message on failure and never a database
 * error (CLAUDE.md §7), which is right for users and unhelpful for whoever deployed
 * it: "Something went wrong" covers a missing table, a refused connection and a
 * missing environment variable equally well. This endpoint answers the one question
 * an operator actually has — which of those is it — without exposing anything.
 *
 * Reports only booleans and enum values. No connection string, no host, no key, not
 * even a prefix of one. Requires no session, because the failure it most often
 * diagnoses is the one that stops you creating the first account.
 */
export const dynamic = 'force-dynamic';

type State = 'ok' | 'missing' | 'failed';

/** Postgres SQLSTATE for `undefined_table`. */
const UNDEFINED_TABLE = '42P01';

/**
 * The driver's error code — a SQLSTATE like `42P01`, or a socket code like
 * `ECONNREFUSED`. Safe to report: it names the class of failure and carries no row
 * values or credentials.
 */
function codeOf(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code.slice(0, 40);
  }
  return undefined;
}

export async function GET() {
  const hints: string[] = [];

  const connectionConfigured = postgresUrl() !== null;
  const serverless = isServerlessRuntime();

  let connection: State = 'missing';
  let tables: State = 'missing';
  let errorCode: string | undefined;

  if (connectionConfigured || !serverless) {
    try {
      // Goes through the app's own accessor, so this reports what a real request
      // would experience — including the local embedded auto-migration.
      const database = await db();

      // Constructing a postgres-js client does not open a socket — it connects
      // lazily. So reaching this line proves nothing yet, and `connection` stays
      // undecided until a query has actually gone to the server.
      try {
        await database.select({ id: schema.users.id }).from(schema.users).limit(1);
        connection = 'ok';
        tables = 'ok';
      } catch (error) {
        errorCode = codeOf(error);

        // 42P01 is undefined_table: the server answered, so the connection is fine
        // and the schema simply is not there. Anything else — refused, timed out,
        // bad credentials — is a connection problem, and reporting it as a missing
        // schema would send the operator to run migrations that cannot possibly run.
        if (errorCode === UNDEFINED_TABLE) {
          connection = 'ok';
          tables = 'missing';
        } else {
          connection = 'failed';
        }
      }
    } catch (error) {
      errorCode = codeOf(error);
      connection = 'failed';
    }
  }

  const sessionSecret: State = process.env.SESSION_SECRET?.trim() ? 'ok' : 'missing';

  // ── Hints, ordered so the first one is the thing to fix ──────────────────
  if (serverless && !connectionConfigured) {
    hints.push(
      'Set DATABASE_URL (or attach a Postgres integration, which provides POSTGRES_URL). ' +
        'Without it there is no persistent storage and the app will not start.',
    );
  }
  if (connection === 'failed') {
    hints.push(
      `Could not reach the database${errorCode ? ` (${errorCode})` : ''}. Check the host and ` +
        'credentials, that the instance is awake, and that sslmode is accepted. Use the ' +
        'POOLED connection string, not the direct one.',
    );
  }
  if (connection === 'ok' && tables === 'missing') {
    hints.push(
      'Connected, but the tables do not exist yet — this is why sign-up fails. Run ' +
        '`npm run db:migrate` against this database, or set the Vercel Build Command ' +
        'to `npm run db:migrate && npm run build` and redeploy.',
    );
  }
  if (serverless && sessionSecret === 'missing') {
    hints.push('Set SESSION_SECRET. Generate one with `openssl rand -base64 48`.');
  }

  const ok = connection === 'ok' && tables === 'ok' && (!serverless || sessionSecret === 'ok');

  return NextResponse.json(
    {
      ok,
      database: {
        driver: activeDriver(),
        connectionConfigured,
        connection,
        tables,
        errorCode,
      },
      session: { secret: sessionSecret },
      ai: { provider: resolveProviderChoice() },
      runtime: { serverless },
      hints,
    },
    { status: ok ? 200 : 503 },
  );
}
