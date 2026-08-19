/**
 * Static option lists shared by client components.
 *
 * These live outside `src/services` deliberately: importing a constant from a
 * service module would pull that module's server-only dependency graph — the
 * database driver, the AI provider — into the browser bundle.
 */

/** Onboarding question 1. */
export const MATTERS_SUGGESTIONS = [
  'Career growth',
  'Leadership',
  'Financial freedom',
  'Health',
  'Family',
  'Relationships',
  'Personal freedom',
  'Learning',
  'Creativity',
  'Purpose',
  'Impact',
  'Confidence',
  'Peace',
  'Adventure',
  'Stability',
  'Recognition',
  'Reinvention',
] as const;

/** Onboarding question 3 — the one that constrains every plan we later build. */
export const PROTECT_SUGGESTIONS = [
  'Sleep',
  'Time with my family',
  'My health',
  'Evenings',
  'Weekends',
  'My relationship',
  'Time to think',
  'My integrity',
  'Financial safety',
  'Time with friends',
  'Something that is just mine',
] as const;

/** Reset Your Game — framed as causes, never as failures. */
export const RESET_CAUSES = [
  'Work overload',
  'Unexpected event',
  'Family issue',
  'Low energy',
  'Lack of clarity',
  'Fear',
  'Conflict',
  'Loss of motivation',
  'Poor planning',
  'Something else',
] as const;
