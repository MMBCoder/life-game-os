import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws outside a React Server Component bundler. Tests run the
      // server code directly, which is exactly what it is guarding against in a
      // browser bundle — so it is stubbed out here rather than removed from source.
      'server-only': fileURLToPath(new URL('./tests/helpers/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // PGlite instances and full council runs are slower than a typical unit test.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // PGlite is single-connection; parallel files sharing one instance would deadlock.
    fileParallelism: false,
    env: {
      AI_PROVIDER: 'mock',
      SESSION_SECRET: 'test-secret-not-for-production-use-only-in-vitest',
      NODE_ENV: 'test',
    },
  },
});
