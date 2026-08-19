'use client';

import { useActionState } from 'react';
import { signInAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { ErrorState } from '@/components/ui/feedback';

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, null);

  const fieldError = (field: string) =>
    state && !state.ok && state.field === field ? state.error : undefined;

  return (
    <form action={action} className="space-y-5">
      {state && !state.ok && !state.field && <ErrorState message={state.error} />}

      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={fieldError('password')}
      />

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
