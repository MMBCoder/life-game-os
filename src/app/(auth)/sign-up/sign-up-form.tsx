'use client';

import { useActionState, useSyncExternalStore } from 'react';
import { signUpAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { ErrorState } from '@/components/ui/feedback';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password';

/**
 * The browser knows the zone; the server needs it stored so "today" resolves in the
 * person's own day rather than the server's. Read as an external value rather than
 * mirrored into state, because it never changes while the form is open.
 */
function subscribeToNothing(): () => void {
  return () => {};
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function serverTimezone(): string {
  return 'UTC';
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, null);
  const timezone = useSyncExternalStore(subscribeToNothing, browserTimezone, serverTimezone);

  const fieldError = (field: string) =>
    state && !state.ok && state.field === field ? state.error : undefined;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="timezone" value={timezone} />

      {state && !state.ok && !state.field && <ErrorState message={state.error} />}

      <Input
        label="What should we call you?"
        name="name"
        autoComplete="name"
        required
        error={fieldError('name')}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={fieldError('email')}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. Length matters more than symbols.`}
        error={fieldError('password')}
      />

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Create account
      </Button>
    </form>
  );
}
