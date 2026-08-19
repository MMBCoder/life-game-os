/**
 * Deterministic scoring. Everything here is a pure function: no LLM, no clock, no
 * database. That makes it fast, free, unit-testable, and — where protection is
 * concerned — reliable rather than probabilistic.
 */
export * from './capacity';
export * from './momentum';
export * from './sacrifice';
export * from './game-health';
export * from './conflicts';
export * from './divergence';
