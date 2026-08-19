import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth/session';
import * as gameRepo from '@/lib/db/repositories/game';
import { Card, CardBody, CardHeader, CardTitle, SectionLabel } from '@/components/ui/card';
import { Badge } from '@/components/ui/feedback';
import { formatDate } from '@/lib/date';
import { PlayerClient } from './player-client';
import { AskPlayer } from './ask-player';

export const metadata: Metadata = { title: 'Player' };

export default async function PlayerPage() {
  const user = await requireSession();
  const [player, decisions] = await Promise.all([
    gameRepo.getActivePlayer(user.id),
    gameRepo.listDecisions(user.id, 8),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <p className="type-label text-ink-faint">Your player</p>
        <h1 className="type-statement mt-2 text-ink">
          The version of you this game needs.
        </h1>
        <p className="type-body mt-3 max-w-2xl text-ink-muted">
          Not who you are — who you are choosing to be while you play this particular ninety days.
        </p>
      </header>

      <PlayerClient
        existing={
          player
            ? {
                name: player.name,
                identity: player.identity,
                intention: player.intention,
                mantra: player.mantra,
                attitude: player.attitude,
                actions: player.actions,
                agreements: player.agreements,
                boundaries: player.boundaries,
                strengths: player.strengths,
                watchOuts: player.watchOuts,
                whyThisFits: player.whyThisFits,
                source: player.source,
                confidence: player.confidence,
              }
            : null
        }
      />

      {player && (
        <section>
          <SectionLabel>Ask my player</SectionLabel>
          <p className="type-small mt-1 mb-3 text-ink-muted">
            Bring a real decision. The full council weighs in — strategy, capacity, and both
            guardians — before your Player answers.
          </p>
          <AskPlayer playerName={player.name} />
        </section>
      )}

      {decisions.length > 0 && (
        <section>
          <SectionLabel>Past decisions</SectionLabel>
          <ul className="mt-3 space-y-3">
            {decisions.map((decision) => (
              <li key={decision.id}>
                <Card>
                  <CardHeader>
                    <div className="min-w-0">
                      <CardTitle as="h3">{decision.question}</CardTitle>
                      <p className="type-small mt-1 text-ink-faint">
                        {formatDate(decision.decidedAt.toISOString().slice(0, 10))}
                      </p>
                    </div>
                    <Badge
                      tone={
                        decision.verdict === 'take'
                          ? 'protect'
                          : decision.verdict === 'decline'
                            ? 'risk'
                            : 'watch'
                      }
                    >
                      {decision.verdict}
                    </Badge>
                  </CardHeader>
                  <CardBody>
                    <p className="type-body text-ink">{decision.headline}</p>
                    {decision.userOutcome && (
                      <p className="type-small mt-2 text-ink-muted">
                        What you did: {decision.userOutcome}
                      </p>
                    )}
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
