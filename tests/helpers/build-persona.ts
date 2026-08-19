import { createUser, setOnboardingStage } from '@/lib/db/repositories/users';
import * as personal from '@/lib/db/repositories/personal-model';
import * as life from '@/lib/db/repositories/life';
import { rememberMany } from '@/lib/memory';
import type { SessionUser } from '@/lib/auth/session';
import type { Persona } from '../fixtures/personas';

/**
 * Materialises a persona into the database as a fully onboarded user.
 *
 * This is the state the product would be in after discovery plus a few corrections,
 * which is what the evaluation suite needs to test against.
 */
export async function buildPersona(persona: Persona): Promise<SessionUser> {
  const created = await createUser({
    name: persona.name,
    email: persona.email,
    password: 'evaluation-suite-password',
    timezone: 'Europe/London',
    isDemo: true,
  });

  const user: SessionUser = {
    id: created.id,
    email: persona.email,
    name: persona.name,
    timezone: 'Europe/London',
    isDemo: true,
  };

  await personal.upsertIdentityModel(user.id, {
    currentIdentity: persona.identity.current,
    desiredIdentity: persona.identity.desired,
    identityTensions: persona.identity.tensions,
    motivators: persona.identity.motivators,
    fears: persona.identity.fears,
    source: 'user_said',
    confidence: 1,
  });

  for (const value of persona.values) {
    await personal.addValue(user.id, {
      label: value.label,
      importance: value.importance,
      source: 'user_said',
      confidence: 1,
    });
  }

  for (const strength of persona.strengths) {
    await personal.addStrength(user.id, {
      label: strength.label,
      kind: strength.kind,
      source: 'user_said',
      confidence: 1,
    });
  }

  for (const constraint of persona.constraints) {
    await personal.addConstraint(user.id, {
      label: constraint.label,
      category: constraint.category,
      severity: constraint.severity,
      source: 'user_said',
      confidence: 1,
    });
  }

  for (const nn of persona.nonNegotiables) {
    await personal.addNonNegotiable(user.id, {
      label: nn.label,
      domainKey: nn.domainKey,
      hardness: nn.hardness,
      source: 'user_said',
      confidence: 1,
    });
  }

  // Life scores are confirmed rather than estimated, so the evaluation is testing
  // strategy quality rather than estimation quality.
  const domains = await life.listDomains(user.id);
  const idByKey = new Map(domains.map((d) => [d.key, d.id]));

  await life.recordScores(
    user.id,
    persona.domains
      .map((d) => {
        const domainId = idByKey.get(d.key);
        if (!domainId) return null;
        const { key: _key, ...scores } = d;
        return {
          domainId,
          ...scores,
          basis: 'Persona fixture',
          source: 'user_confirmed' as const,
          confidence: 1,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null),
  );

  await rememberMany(user.id, [
    {
      layer: 'stable',
      key: 'must_not_sacrifice',
      value: persona.nonNegotiables.map((n) => n.label).join(', '),
      source: 'user_said',
      confidence: 1,
    },
    {
      layer: 'dynamic',
      key: 'twelve_month_ambition',
      value: persona.ambition,
      source: 'user_said',
      confidence: 1,
    },
  ]);

  await personal.addObservation(user.id, {
    text: persona.ambition,
    channel: 'onboarding',
  });

  await setOnboardingStage(user.id, 'complete', true);

  return user;
}
