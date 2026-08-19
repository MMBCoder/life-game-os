import 'server-only';
import { createHmac, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { isServerlessRuntime } from '@/lib/runtime';

import {
  SESSION_COOKIE,
  SESSION_DAYS,
  SESSION_REFRESH_THRESHOLD_DAYS as REFRESH_THRESHOLD_DAYS,
} from './constants';

export { SESSION_COOKIE };

/** Development-only. Never used in a deployed environment — see below. */
const DEV_SECRET = 'life-game-os-development-secret-do-not-use-in-deployment';

function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;

  // A deployment without this is a deployment whose session tokens cannot be
  // invalidated by rotating anything. Fail at startup rather than run degraded.
  if (isServerlessRuntime()) {
    throw new Error(
      'SESSION_SECRET is not set. Generate one with `openssl rand -base64 48` and ' +
        'add it to the deployment environment. See README → Deployment.',
    );
  }
  return DEV_SECRET;
}

/**
 * Only the keyed digest of a token is stored, so the sessions table on its own is
 * useless to an attacker. The tokens are 256 bits of randomness, so a plain hash
 * would already be unguessable; keying it with SESSION_SECRET buys one operational
 * property that matters — rotating the secret invalidates every session at once.
 */
function hashToken(token: string): string {
  return createHmac('sha256', sessionSecret()).update(token).digest('hex');
}

function expiryFromNow(days = SESSION_DAYS): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  timezone: string;
  isDemo: boolean;
}

/**
 * Issues a new session. The raw token goes to the cookie; only its SHA-256 is
 * stored, so a database leak does not yield usable session tokens.
 */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const database = await db();

  await database.insert(schema.sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: expiryFromNow(),
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiryFromNow(),
  });
}

/**
 * Resolves the current user, or null. Expired sessions are treated as absent and
 * cleaned up opportunistically.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const database = await db();
  const rows = await database
    .select({
      sessionId: schema.sessions.id,
      expiresAt: schema.sessions.expiresAt,
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      timezone: schema.users.timezone,
      isDemo: schema.users.isDemo,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(eq(schema.sessions.tokenHash, hashToken(token)), gt(schema.sessions.expiresAt, new Date())),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Slide the window so active users are not logged out mid-game. Only the database
  // row is touched here: this runs during a Server Component render, where Next.js
  // forbids cookie writes. The matching cookie expiry is re-issued by the proxy,
  // which has a response to attach it to.
  const remainingMs = row.expiresAt.getTime() - Date.now();
  if (remainingMs < REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000) {
    await database
      .update(schema.sessions)
      .set({ expiresAt: expiryFromNow() })
      .where(eq(schema.sessions.id, row.sessionId));
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    timezone: row.timezone,
    isDemo: row.isDemo,
  };
}

/**
 * The authorisation gate for every Server Action and protected page. Middleware
 * also guards the route group; this is the independent second check, because
 * middleware can be bypassed by a direct action invocation.
 */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorisedError();
  return user;
}

export class UnauthorisedError extends Error {
  constructor() {
    super('Not signed in');
    this.name = 'UnauthorisedError';
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    const database = await db();
    await database.delete(schema.sessions).where(eq(schema.sessions.tokenHash, hashToken(token)));
  }
  store.delete(SESSION_COOKIE);
}

/** Housekeeping, called opportunistically on sign-in. */
export async function purgeExpiredSessions(): Promise<void> {
  const database = await db();
  await database.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
}
