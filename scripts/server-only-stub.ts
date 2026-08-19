/**
 * Stub for the `server-only` guard, used by the operator scripts.
 *
 * That package throws when imported outside a React Server Component bundler, which
 * is exactly the protection we want in the app. Scripts run the same server modules
 * directly from Node, so they map the import to this no-op via tsconfig.scripts.json.
 */
export {};
