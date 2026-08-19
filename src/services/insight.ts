import 'server-only';
import { buildContext } from '@/lib/personalization/context';
import { generateArtefact } from './generate';
import { blindSpotDraft, insightPlanDraft, suggestionSet } from '@/schemas/artefacts';
import * as personal from '@/lib/db/repositories/personal-model';
import type { SessionUser } from '@/lib/auth/session';
import type { SuggestionSet } from '@/schemas/artefacts';

/**
 * The Personal Insight Plan — the document that answers "what does this system
 * actually understand about me?".
 */
export async function generateInsightPlan(user: SessionUser) {
  const ctx = await buildContext({
    purpose: 'insight_plan',
    user,
    ask: { question: 'Write this person’s Personal Insight Plan.' },
  });

  const { data } = await generateArtefact({
    agent: 'identity',
    schema: insightPlanDraft,
    schemaName: 'InsightPlanDraft',
    ctx,
    instruction: [
      'Write the Personal Insight Plan across these sections: Who I Am, What Matters to Me, What Gives Me Energy, What Drains Me, What I Naturally Do Well, What I Tend To Overdo, What I Avoid, My Current Reality, My Biggest Opportunity, My Biggest Risk, My Identity Shift, What I Need To Stop, What I Need To Start, What I Need To Protect, What I Need To Practise, What I Need To Learn, What I Need To Delegate, What I Need To Say No To.',
      'Every section must be about this specific person. Mark the source honestly: what they told you is user_said, what you worked out is ai_inferred.',
      'Where you are inferring, say so in the writing itself rather than asserting it.',
    ].join('\n'),
  });

  await personal.saveInsightPlan(user.id, data.sections);
  return data;
}

/**
 * Potential blind spots.
 *
 * Every one is a hypothesis with confidence and evidence, and every one is
 * correctable. A system that tells someone what they cannot see about themselves,
 * and is not open to being wrong, has overstepped.
 */
export async function generateBlindSpots(user: SessionUser) {
  const ctx = await buildContext({
    purpose: 'insight_plan',
    user,
    ask: { question: 'What might this person not be seeing?' },
  });

  const { data } = await generateArtefact({
    agent: 'redTeam',
    schema: blindSpotDraft,
    schemaName: 'BlindSpotDraft',
    ctx,
    instruction: [
      'Identify up to four potential blind spots.',
      'Each is a hypothesis, not a diagnosis. Say what it is based on, and give an honest confidence.',
      'Prefer structural observations — a capacity problem being treated as a motivation problem, a positioning problem being solved with more work, stated priorities that the calendar does not reflect.',
      'Never speculate about mental health.',
    ].join('\n'),
  });

  await personal.replaceBlindSpots(user.id, data.blindSpots);
  return data.blindSpots;
}

/**
 * Contextual suggestions for an input field. This is what stands behind the second
 * law — no bare empty box anywhere in the product.
 */
export async function suggestFor(
  user: SessionUser,
  field: string,
  prompt?: string,
): Promise<SuggestionSet> {
  const ctx = await buildContext({
    purpose: 'insight_plan',
    user,
    ask: {
      question: prompt ?? `Suggest options for: ${field}`,
      payload: { field },
    },
  });

  const { data } = await generateArtefact({
    agent: 'identity',
    schema: suggestionSet,
    schemaName: 'SuggestionSet',
    ctx,
    tier: 'light',
    instruction: [
      `Suggest options for the "${field}" field.`,
      'Each suggestion needs a "because" that references something specific about this person. "Exercise" is a failure; "protect 30 minutes of movement before your workday, because your energy is highest before the day starts" is the standard.',
    ].join('\n'),
  });

  return data;
}
