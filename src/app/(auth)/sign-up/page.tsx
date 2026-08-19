import type { Metadata } from 'next';
import Link from 'next/link';
import { SignUpForm } from './sign-up-form';

export const metadata: Metadata = { title: 'Create your account' };

export default function SignUpPage() {
  return (
    <div>
      <h1 className="type-h1 text-ink">Let’s build your game.</h1>
      <p className="type-body mt-2 text-ink-muted">
        Three questions to start. You can correct anything we get wrong.
      </p>

      <div className="mt-8">
        <SignUpForm />
      </div>

      <p className="type-small mt-6 text-ink-muted">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-primary underline underline-offset-4">
          Sign in
        </Link>
      </p>

      <p className="type-small mt-8 text-ink-faint">
        This product holds personal information about your life and work. It is stored on your own
        deployment, never shared, and you can export or delete all of it at any time.
      </p>
    </div>
  );
}
