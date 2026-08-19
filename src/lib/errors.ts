/**
 * User-facing failure copy. CLAUDE.md §7: users never see a stack trace, a provider
 * error, or a database message.
 *
 * The invariant behind all of these: an AI failure never mutates the user's plan.
 * The reassurance in the copy is a promise the architecture keeps.
 */

export type FailureKind =
  | 'ai_timeout'
  | 'ai_invalid_output'
  | 'ai_unavailable'
  | 'ai_rate_limited'
  | 'missing_context'
  | 'database'
  | 'network'
  | 'unauthorised'
  | 'validation'
  | 'not_found'
  | 'unknown';

const MESSAGES: Record<FailureKind, string> = {
  ai_timeout:
    "That analysis took longer than expected and I stopped it. Your existing plan is safe — try again in a moment.",
  ai_invalid_output:
    "I couldn't complete that analysis. Your existing plan is safe. Try again.",
  ai_unavailable:
    'The council is unavailable right now. Everything you have is saved — please try again shortly.',
  ai_rate_limited:
    "We've hit a temporary limit. Nothing was lost — give it a minute and try again.",
  missing_context:
    "I don't know enough yet to do that well. Tell me a little more and I'll pick it up from there.",
  database: 'Something went wrong saving that. Please try again.',
  network: 'The connection dropped before that finished. Please try again.',
  unauthorised: 'Please sign in to continue.',
  validation: "That doesn't look quite right — check the highlighted field.",
  not_found: "I couldn't find that.",
  unknown: 'Something went wrong. Your existing plan is safe. Please try again.',
};

export class AppError extends Error {
  readonly kind: FailureKind;
  /** Safe to render to a user. */
  readonly userMessage: string;

  constructor(kind: FailureKind, internalMessage?: string) {
    super(internalMessage ?? kind);
    this.name = 'AppError';
    this.kind = kind;
    this.userMessage = MESSAGES[kind];
  }
}

export function userMessageFor(error: unknown): string {
  if (error instanceof AppError) return error.userMessage;
  if (error instanceof Error && error.name === 'UnauthorisedError') {
    return MESSAGES.unauthorised;
  }
  return MESSAGES.unknown;
}

/**
 * Logs a failure without leaking personal data. Only the kind, a short code and
 * ids are recorded — never prompt content, reflections, or user text (CLAUDE.md §8).
 */
export function logFailure(scope: string, error: unknown, meta?: Record<string, string>): void {
  const kind = error instanceof AppError ? error.kind : 'unknown';
  const code = error instanceof Error ? error.name : 'NonError';
  console.error(
    JSON.stringify({ scope, kind, code, ...meta }),
  );
}

/** Result type for Server Actions, so the UI can render errors without exceptions. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: unknown, field?: string): ActionResult<never> {
  return { ok: false, error: userMessageFor(error), field };
}

export function failWith(message: string, field?: string): ActionResult<never> {
  return { ok: false, error: message, field };
}
