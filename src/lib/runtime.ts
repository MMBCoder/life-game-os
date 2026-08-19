/**
 * Where the process is running.
 *
 * Used to fail loudly on configuration that is merely inconvenient locally but
 * destroys data in a serverless deployment. Deliberately does *not* key off
 * `NODE_ENV === 'production'`: `npm run start` on a laptop is a production build and
 * is a perfectly good way to run this app with the embedded database.
 */
export function isServerlessRuntime(): boolean {
  return (
    process.env.VERCEL === '1' ||
    process.env.VERCEL === 'true' ||
    typeof process.env.AWS_LAMBDA_FUNCTION_NAME === 'string' ||
    process.env.NETLIFY === 'true'
  );
}
