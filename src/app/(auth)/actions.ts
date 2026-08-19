'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createUser, findUserByEmail } from '@/lib/db/repositories/users';
import { verifyPassword, validatePassword } from '@/lib/auth/password';
import { createSession, destroySession, purgeExpiredSessions } from '@/lib/auth/session';
import { AppError, fail, failWith, logFailure, type ActionResult } from '@/lib/errors';

const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Tell us what to call you.').max(80),
  email: z.string().trim().toLowerCase().email('That does not look like an email address.'),
  password: z.string(),
  timezone: z.string().max(60).optional(),
});

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('That does not look like an email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export async function signUpAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const parsed = signUpSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    timezone: formData.get('timezone') || undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return failWith(issue?.message ?? 'Check the form.', String(issue?.path[0] ?? ''));
  }

  const passwordProblem = validatePassword(parsed.data.password);
  if (passwordProblem) return failWith(passwordProblem, 'password');

  try {
    const user = await createUser({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      timezone: parsed.data.timezone ?? 'UTC',
    });
    await createSession(user.id);
  } catch (error) {
    if (error instanceof AppError && error.kind === 'validation') {
      // Deliberately specific: this is not an enumeration risk worth the confusion
      // of a vague message on a sign-up form.
      return failWith('An account already exists for that email.', 'email');
    }
    logFailure('auth.signUp', error);
    return fail(error);
  }

  redirect('/discover');
}

export async function signInAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return failWith(issue?.message ?? 'Check the form.', String(issue?.path[0] ?? ''));
  }

  try {
    const user = await findUserByEmail(parsed.data.email);

    // One message for both "no such user" and "wrong password", so the form does
    // not confirm which emails have accounts.
    const ok =
      user !== null &&
      (await verifyPassword(parsed.data.password, {
        hash: user.passwordHash,
        salt: user.passwordSalt,
      }));

    if (!user || !ok) {
      return failWith('That email and password do not match.', 'password');
    }

    await purgeExpiredSessions();
    await createSession(user.id);
  } catch (error) {
    logFailure('auth.signIn', error);
    return fail(error);
  }

  redirect('/dashboard');
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect('/');
}
