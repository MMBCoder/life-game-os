import 'server-only';
import { buildContext } from '@/lib/personalization/context';
import { generateArtefact } from './generate';
import { personalSnapshot, type PersonalSnapshot } from '@/schemas/artefacts';
import * as personal from '@/lib/db/repositories/personal-model';
import { setOnboardingStage } from '@/lib/db/repositories/users';
import { rememberMany } from '@/lib/memory';
import { estimateLifeMap } from './lifemap';
import type { SessionUser } from '@/lib/auth/session';

export interface OnboardingAnswers {
  /** What feels most important right now. */
  matters: string[];
  /** If the next twelve months went really well, what would be different. */
  twelveMonths: string;
  /** What must not be sacrificed while pursuing that. */
  notSacrificed: string[];
  /** Index signature so the answers can travel as the council's ask payload. */
  [key: string]: unknown;
}

/**
 * Three questions in, a meaningful Personal Model out.
 *
 * Onboarding is expected to produce roughly 60–70% of the model; the rest is
 * gathered through use rather than through a longer form (spec §45).
 */
export async function runOnboarding(
  user: SessionUser,
  answers: OnboardingAnswers,
): Promise<PersonalSnapshot> {
  // The raw answers are observations first. Everything the system later infers has
  // to be traceable to one of these.
  await personal.addObservation(user.id, {
    text: `What matters most right now: ${answers.matters.join(', ')}`,
    channel: 'onboarding',
  });
  await personal.addObservation(user.id, {
    text: `If the next 12 months went well: ${answers.twelveMonths}`,
    channel: 'onboarding',
  });
  await personal.addObservation(user.id, {
    text: `Must not be sacrificed: ${answers.notSacrificed.join(', ')}`,
    channel: 'onboarding',
  });

  // The person's own words are user_said and outrank anything inferred later.
  for (const label of answers.notSacrificed) {
    await personal.addNonNegotiable(user.id, {
      label,
      hardness: isFirm(label) ? 'firm' : 'strong',
      source: 'user_said',
      confidence: 1,
    });
  }
  for (const label of answers.matters) {
    await personal.addValue(user.id, {
      label,
      importance: 9,
      source: 'user_said',
      confidence: 1,
    });
  }

  const ctx = await buildContext({
    purpose: 'onboarding_snapshot',
    user,
    ask: {
      question: 'Build an initial Personal Snapshot from these three answers.',
      payload: { ...answers },
    },
  });

  const { data: snapshot } = await generateArtefact({
    agent: 'identity',
    schema: personalSnapshot,
    schemaName: 'PersonalSnapshot',
    ctx,
    instruction: [
      'The person has answered three onboarding questions. Build their initial Personal Snapshot.',
      'Infer generously but mark every inference with honest confidence — the next screen asks them "how close did we get?", so an over-confident wrong guess is worse than a hedged right one.',
      'Do not ask for more information. This is the inference step; correction comes next.',
    ].join('\n'),
  });

  // Persist the inferences as provisional claims the person can confirm or correct.
  await personal.upsertIdentityModel(user.id, {
    currentIdentity: snapshot.identityShift.from,
    desiredIdentity: snapshot.identityShift.to,
    source: 'ai_inferred',
    confidence: snapshot.identityShift.confidence,
  });

  for (const constraint of snapshot.likelyConstraints) {
    await personal.addConstraint(user.id, {
      label: constraint.label,
      category: constraint.category,
      severity: constraint.severity,
      source: 'ai_inferred',
      confidence: constraint.confidence,
    });
  }

  for (const nn of snapshot.nonNegotiables) {
    const alreadyStated = answers.notSacrificed.some(
      (a) => a.toLowerCase() === nn.label.toLowerCase(),
    );
    if (alreadyStated) continue;
    await personal.addNonNegotiable(user.id, {
      label: nn.label,
      hardness: nn.hardness,
      source: 'ai_inferred',
      confidence: nn.confidence,
    });
  }

  await rememberMany(user.id, [
    {
      layer: 'stable',
      key: 'what_matters',
      value: answers.matters.join(', '),
      source: 'user_said',
      confidence: 1,
    },
    {
      layer: 'stable',
      key: 'must_not_sacrifice',
      value: answers.notSacrificed.join(', '),
      source: 'user_said',
      confidence: 1,
    },
    {
      layer: 'dynamic',
      key: 'twelve_month_ambition',
      value: answers.twelveMonths,
      source: 'user_said',
      confidence: 1,
    },
    {
      layer: 'dynamic',
      key: 'possible_tension',
      value: snapshot.possibleTension.statement,
      source: 'ai_inferred',
      confidence: snapshot.possibleTension.confidence,
    },
  ]);

  // An estimated Life Map means the next screen shows something real rather than an
  // empty wheel asking for ninety numbers.
  await estimateLifeMap(user, answers);

  await setOnboardingStage(user.id, 'snapshot_ready');

  return snapshot;
}

/** Records the person's verdict on the snapshot — the "how close did we get?" step. */
export async function recordSnapshotFeedback(
  user: SessionUser,
  verdict: 'close' | 'partly' | 'off',
  correction?: string,
): Promise<void> {
  await personal.addObservation(user.id, {
    text: `Snapshot accuracy: ${verdict}${correction ? `. Correction: ${correction}` : ''}`,
    channel: 'onboarding',
  });

  if (correction) {
    await rememberMany(user.id, [
      {
        layer: 'stable',
        key: 'snapshot_correction',
        value: correction,
        source: 'user_said',
        confidence: 1,
      },
    ]);
  }

  await setOnboardingStage(user.id, 'complete', true);
}

/**
 * Family and health protections are treated as firm by default. Getting this wrong
 * in the permissive direction would let a plan spend exactly what the product exists
 * to protect, and the person can always soften it afterwards.
 */
function isFirm(label: string): boolean {
  return /family|child|kid|partner|spouse|sleep|health/i.test(label);
}

// The suggestion lists live in src/lib/copy.ts so client components can import
// them without pulling this module's server-only dependencies into the bundle.
