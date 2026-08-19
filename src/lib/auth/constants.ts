/**
 * Auth constants with no runtime dependencies.
 *
 * Separated from `session.ts` because the Edge middleware needs the cookie name and
 * must not pull in the database layer, which uses Node-only APIs.
 */
export const SESSION_COOKIE = 'lgos_session';

export const SESSION_DAYS = 30;

/** Refresh the cookie once remaining life drops below this, to slide the window. */
export const SESSION_REFRESH_THRESHOLD_DAYS = 7;
