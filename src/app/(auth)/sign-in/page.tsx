import type { Metadata } from 'next';
import Link from 'next/link';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  return (
    <div>
      <h1 className="type-h1 text-ink">Welcome back.</h1>
      <p className="type-body mt-2 text-ink-muted">Pick up where your game left off.</p>

      <div className="mt-8">
        <SignInForm />
      </div>

      <p className="type-small mt-6 text-ink-muted">
        No account yet?{' '}
        <Link href="/sign-up" className="text-primary underline underline-offset-4">
          Create one
        </Link>
      </p>
    </div>
  );
}
