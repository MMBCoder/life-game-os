import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth/session';
import * as life from '@/lib/db/repositories/life';
import { getDivergences } from '@/services/lifemap';
import { Card, CardBody, CardHeader, CardTitle, SectionLabel } from '@/components/ui/card';
import { Badge, EmptyState } from '@/components/ui/feedback';
import { LifeMapClient } from './life-map-client';

export const metadata: Metadata = { title: 'Life Map' };

export default async function LifePage() {
  const user = await requireSession();
  const [map, divergences] = await Promise.all([
    life.getLifeMap(user.id),
    getDivergences(user.id),
  ]);

  const scored = map.filter((d) => d.scores !== null);

  return (
    <div className="space-y-8">
      <header>
        <p className="type-label text-ink-faint">Your life map</p>
        <h1 className="type-statement mt-2 text-ink">
          What is happening, and what it feels like.
        </h1>
        <p className="type-body mt-3 max-w-2xl text-ink-muted">
          Two scores per domain. When the outer result runs ahead of the inner experience, the
          strategy is working and something is paying for it.
        </p>
      </header>

      {scored.length === 0 ? (
        <EmptyState
          title="Your map has not been estimated yet"
          description="Rather than asking you for ninety numbers, we estimate every domain from what you have told us — then you nudge whatever reads wrong."
          actionLabel=""
        />
      ) : null}

      {/* The signature insight, above the chart — it is the reason for the chart. */}
      {divergences.length > 0 && (
        <section>
          <SectionLabel>What the map is telling us</SectionLabel>
          <ul className="mt-3 space-y-3">
            {divergences.slice(0, 3).map((d) => (
              <li key={d.key}>
                <Card
                  tone={
                    d.kind === 'unsustainable_success'
                      ? 'watch'
                      : d.kind === 'neglected_priority'
                        ? 'risk'
                        : 'default'
                  }
                >
                  <CardBody className="pt-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          d.kind === 'unsustainable_success'
                            ? 'watch'
                            : d.kind === 'neglected_priority'
                              ? 'risk'
                              : 'neutral'
                        }
                      >
                        {d.kind === 'unsustainable_success'
                          ? 'Costing more than it returns'
                          : d.kind === 'neglected_priority'
                            ? 'Matters, and is not getting attention'
                            : 'Better than it looks'}
                      </Badge>
                      <span className="type-label text-ink-faint">{d.severity} signal</span>
                    </div>
                    <p className="type-body mt-2.5 text-ink">{d.statement}</p>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <LifeMapClient
        domains={map.map((d) => ({
          id: d.id,
          key: d.key,
          label: d.label,
          isCustom: d.isCustom,
          source: d.source,
          confidence: d.confidence,
          basis: d.basis,
          scores: d.scores,
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>How these scores work</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          <p className="type-small text-ink-muted">
            <strong className="text-ink">Outer result</strong> — what is measurably happening in
            this part of your life.
          </p>
          <p className="type-small text-ink-muted">
            <strong className="text-ink">Inner experience</strong> — what it actually feels like to
            live it.
          </p>
          <p className="type-small text-ink-muted">
            <strong className="text-ink">Importance</strong> — how much this domain matters to you,
            which is what makes a gap here worth acting on.
          </p>
          <p className="type-small pt-1 text-ink-faint">
            These are estimates until you confirm them. Nothing here is a measurement of you.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
