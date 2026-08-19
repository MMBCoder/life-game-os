import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth/session';
import * as execution from '@/lib/db/repositories/execution';
import * as gameRepo from '@/lib/db/repositories/game';
import { formatDate, todayIn, weekRange } from '@/lib/date';
import { Card, CardBody, CardHeader, CardTitle, SectionLabel } from '@/components/ui/card';
import { Badge } from '@/components/ui/feedback';
import { ReflectionClient } from './reflection-client';

export const metadata: Metadata = { title: 'Reflection' };

export default async function ReflectionPage() {
  const user = await requireSession();
  const today = todayIn(user.timezone);
  const week = weekRange(today);

  const [reflections, full, actions] = await Promise.all([
    execution.listReflections(user.id, undefined, 8),
    gameRepo.getFullGame(user.id),
    execution.getTodayActions(user.id, today),
  ]);

  const thisWeekDone = reflections.some(
    (r) => r.kind === 'weekly' && r.periodEnd === week.end,
  );

  // Offer the person's own moves and bold results as quick-select options, so the
  // review is mostly tapping rather than typing.
  const suggestions = [
    ...actions.map((a) => a.title),
    ...(full?.boldResults.map((b) => b.title) ?? []),
    ...(full?.strategicMoves.map((m) => m.title) ?? []),
  ]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 10);

  return (
    <div className="space-y-8">
      <header>
        <p className="type-label text-ink-faint">Reflection</p>
        <h1 className="type-statement mt-2 text-ink">Few questions. Real analysis.</h1>
        <p className="type-body mt-3 max-w-2xl text-ink-muted">
          You bring what happened. The council does the pattern-finding — including the part where
          it tells you the plan needs to change rather than you.
        </p>
      </header>

      <ReflectionClient
        suggestions={suggestions}
        weeklyDone={thisWeekDone}
        weekLabel={`${formatDate(week.start)} – ${formatDate(week.end)}`}
      />

      {reflections.length > 0 && (
        <section>
          <SectionLabel>History</SectionLabel>
          <ul className="mt-3 space-y-3">
            {reflections.map((r) => {
              const intel = r.intelligence as
                | { progress?: string; insight?: string; comparison?: string }
                | null;
              return (
                <li key={r.id}>
                  <Card>
                    <CardHeader>
                      <div>
                        <CardTitle as="h3" className="capitalize">
                          {r.kind} review
                        </CardTitle>
                        <p className="type-small mt-1 text-ink-faint">
                          {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        {r.moved.length > 0 && (
                          <Badge tone="protect">{r.moved.length} moved</Badge>
                        )}
                        {r.didntMove.length > 0 && (
                          <Badge tone="watch">{r.didntMove.length} stalled</Badge>
                        )}
                      </div>
                    </CardHeader>
                    {(intel?.progress || intel?.insight || intel?.comparison) && (
                      <CardBody className="space-y-2">
                        {intel.progress && (
                          <p className="type-body text-ink">{intel.progress}</p>
                        )}
                        {intel.comparison && (
                          <p className="type-body text-ink">{intel.comparison}</p>
                        )}
                        {intel.insight && (
                          <p className="type-small text-ink-muted">{intel.insight}</p>
                        )}
                      </CardBody>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
