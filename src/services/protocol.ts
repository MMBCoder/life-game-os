import 'server-only';
import { buildContext } from '@/lib/personalization/context';
import { generateArtefact } from './generate';
import { protocolDraft, type ProtocolDraft } from '@/schemas/artefacts';
import * as execution from '@/lib/db/repositories/execution';
import * as life from '@/lib/db/repositories/life';
import * as gameRepo from '@/lib/db/repositories/game';
import type { SessionUser } from '@/lib/auth/session';

/**
 * Designs the operating protocol: Minimum, Standard, Expansion.
 *
 * Three modes exist so a bad day still has a defined move. Without a minimum, one
 * missed day becomes a missed month — which is the actual failure mode of almost
 * every plan people abandon.
 */
export async function draftProtocol(user: SessionUser): Promise<ProtocolDraft> {
  const ctx = await buildContext({
    purpose: 'protocol_design',
    user,
    ask: { question: 'Design this person’s operating protocol.' },
  });

  const { data } = await generateArtefact({
    agent: 'execution',
    schema: protocolDraft,
    schemaName: 'ProtocolDraft',
    ctx,
    instruction: [
      'Design a protocol with three modes for each item: Minimum (a difficult day), Standard (normal), Expansion (high capacity).',
      'The Minimum must genuinely survive a bad day — if it needs willpower, it is not a minimum.',
      'Choose rituals and routines that fit this person’s actual life. Do not assume early mornings, meditation, a gym, or journalling unless the context shows an appetite for them.',
      'Every ritual needs a whyThisFits that references something specific about them.',
      'Use domain keys from context.domains.',
    ].join('\n'),
  });

  return data;
}

export async function saveProtocol(user: SessionUser, draft: ProtocolDraft): Promise<void> {
  const domains = await life.listDomains(user.id);
  const game = await gameRepo.getActiveGame(user.id);

  await execution.saveProtocol(user.id, draft, {
    gameId: game?.id ?? null,
    domainIdByKey: new Map(domains.map((d) => [d.key, d.id])),
  });
}
