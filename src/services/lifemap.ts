import 'server-only';
import { buildContext } from '@/lib/personalization/context';
import { generateArtefact } from './generate';
import { lifeMapEstimate } from '@/schemas/artefacts';
import * as life from '@/lib/db/repositories/life';
import { analyseDivergence } from '@/lib/scoring/divergence';
import type { SessionUser } from '@/lib/auth/session';

/**
 * Estimates the whole Life Map from conversation rather than asking for ninety
 * numbers. The person then nudges anything that reads wrong with
 * [Lower] [About right] [Higher] — spec §10.
 */
export async function estimateLifeMap(
  user: SessionUser,
  hints?: Record<string, unknown>,
): Promise<void> {
  const ctx = await buildContext({
    purpose: 'life_map_estimate',
    user,
    ask: {
      question: 'Estimate this person’s life map across every domain.',
      payload: hints ?? {},
    },
  });

  const { data } = await generateArtefact({
    agent: 'reality',
    schema: lifeMapEstimate,
    schemaName: 'LifeMapEstimate',
    ctx,
    instruction: [
      'Estimate scores for every domain listed in context.domains. Use the domain keys exactly as given.',
      'Separate outer result (what is happening) from inner experience (what it feels like) — a domain can be strong on one and weak on the other, and that gap is the most useful thing you can surface.',
      'Be honest about confidence. A low-confidence estimate the person corrects is more useful than a confident guess they accept.',
    ].join('\n'),
  });

  const domains = await life.listDomains(user.id);
  const idByKey = new Map(domains.map((d) => [d.key, d.id]));

  const scores = data.scores
    .map((s) => {
      const domainId = idByKey.get(s.domainKey);
      if (!domainId) return null;
      return {
        domainId,
        currentExperience: s.currentExperience,
        desiredExperience: s.desiredExperience,
        outerResult: s.outerResult,
        innerExperience: s.innerExperience,
        importance: s.importance,
        energy: s.energy,
        satisfaction: s.satisfaction,
        risk: s.risk,
        momentum: s.momentum,
        basis: s.basis,
        source: 'ai_inferred' as const,
        confidence: s.confidence,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  await life.recordScores(user.id, scores);
}

/** The divergences the Life Map page leads with. Computed, not generated. */
export async function getDivergences(userId: string) {
  const map = await life.getLifeMap(userId);
  return analyseDivergence(
    map
      .filter((d) => d.scores !== null)
      .map((d) => ({ key: d.key, label: d.label, scores: d.scores! })),
  );
}
