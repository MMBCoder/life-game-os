import 'server-only';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { DEFAULT_DOMAINS } from '@/schemas/common';
import { AppError } from '@/lib/errors';

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  timezone?: string;
  isDemo?: boolean;
}

/**
 * Creates an account and everything it needs to be immediately usable: a profile and
 * the ten default life domains. A blank Life Map would violate the minimal-input law
 * before the user had typed anything (docs/decisions.md D10).
 */
export async function createUser(input: CreateUserInput): Promise<{ id: string }> {
  const database = await db();
  const email = input.email.trim().toLowerCase();

  const existing = await database
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError('validation', 'email already registered');
  }

  const { hash, salt } = await hashPassword(input.password);

  const inserted = await database
    .insert(schema.users)
    .values({
      email,
      passwordHash: hash,
      passwordSalt: salt,
      name: input.name.trim(),
      timezone: input.timezone ?? 'UTC',
      isDemo: input.isDemo ?? false,
    })
    .returning({ id: schema.users.id });

  const user = inserted[0];
  if (!user) throw new AppError('database', 'user insert returned no row');

  await database.insert(schema.profiles).values({
    userId: user.id,
    displayName: input.name.trim(),
    onboardingStage: 'not_started',
  });

  await database.insert(schema.lifeDomains).values(
    DEFAULT_DOMAINS.map((domain, index) => ({
      userId: user.id,
      key: domain.key,
      label: domain.label,
      orderIndex: index,
      isCustom: false,
      isActive: true,
    })),
  );

  return { id: user.id };
}

export async function findUserByEmail(email: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.trim().toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function getProfile(userId: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function setOnboardingStage(
  userId: string,
  stage: string,
  completed = false,
): Promise<void> {
  const database = await db();
  await database
    .update(schema.profiles)
    .set({
      onboardingStage: stage,
      onboardingCompletedAt: completed ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.profiles.userId, userId));
}

export async function updateTimezone(userId: string, timezone: string): Promise<void> {
  const database = await db();
  await database
    .update(schema.users)
    .set({ timezone, updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
}

/**
 * Hard delete. Every user-owned table declares `onDelete: cascade`, so this is
 * genuinely complete rather than a soft flag — required by the deletion capability
 * in spec §50.
 */
export async function deleteUser(userId: string): Promise<void> {
  const database = await db();
  await database.delete(schema.users).where(eq(schema.users.id, userId));
}
