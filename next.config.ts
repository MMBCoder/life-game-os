import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const nextConfig: NextConfig = {
  // This project sits inside a multi-project directory; pin the root so Turbopack
  // does not walk up and adopt an unrelated lockfile from the home directory.
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
  // PGlite ships WASM + a filesystem shim; it must stay out of the bundler and be
  // required at runtime from node_modules instead.
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  experimental: {
    // Server Actions carry onboarding transcripts and reflections, which can be long.
    serverActions: { bodySizeLimit: '2mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Production only: over plain HTTP browsers ignore this, and emitting it in
          // development would pin localhost to HTTPS in the developer's browser.
          ...(process.env.NODE_ENV === 'production'
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
