import { cn } from '@/lib/cn';
import { formatDayMonth } from '@/lib/date';

export interface TimelineResult {
  id: string;
  title: string;
  dayMarker: number;
  targetDate: string;
  progress: number;
  successDefinition: string;
}

/**
 * The 30 / 60 / 90 timeline.
 *
 * A quarter is short enough to hold and long enough to matter; showing "today"
 * against the markers is what turns a plan into a position.
 */
export function GameTimeline({
  results,
  startDate,
  endDate,
  today,
}: {
  results: TimelineResult[];
  startDate: string;
  endDate: string;
  today: string;
}) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  const span = Math.max(1, end - start);
  const elapsed = Math.max(0, Math.min(100, ((now - start) / span) * 100));

  return (
    <div>
      <div className="relative pt-2 pb-1">
        <div className="h-1.5 rounded-full bg-bg-subtle">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-320"
            style={{ width: `${elapsed}%` }}
          />
        </div>

        {/* Today marker */}
        <div
          className="absolute top-0 -translate-x-1/2"
          style={{ left: `${elapsed}%` }}
          aria-hidden="true"
        >
          <div className="size-3 rounded-full border-2 border-surface bg-ink" />
        </div>

        {results.map((result) => {
          const at = Math.max(
            0,
            Math.min(100, ((Date.parse(`${result.targetDate}T00:00:00Z`) - start) / span) * 100),
          );
          return (
            <div
              key={result.id}
              className="absolute top-1.5 -translate-x-1/2"
              style={{ left: `${at}%` }}
              aria-hidden="true"
            >
              <div
                className={cn(
                  'size-2.5 rounded-full border-2 border-surface',
                  result.progress >= 1
                    ? 'bg-protect'
                    : now >= Date.parse(`${result.targetDate}T00:00:00Z`)
                      ? 'bg-watch'
                      : 'bg-line-strong',
                )}
              />
            </div>
          );
        })}
      </div>

      <p className="type-small mt-2 text-ink-faint">
        Day {Math.max(0, Math.round((now - start) / 86_400_000))} of 90 · {formatDayMonth(startDate)} to{' '}
        {formatDayMonth(endDate)}
      </p>

      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {results.map((result) => {
          const overdue =
            result.progress < 1 && now > Date.parse(`${result.targetDate}T00:00:00Z`);
          return (
            <li
              key={result.id}
              className={cn(
                'rounded-[var(--radius-md)] border p-4',
                result.progress >= 1
                  ? 'border-protect/45 bg-protect-soft/30'
                  : overdue
                    ? 'border-watch/45 bg-watch-soft/30'
                    : 'border-line',
              )}
            >
              <p className="type-label text-ink-faint">Day {result.dayMarker}</p>
              <p className="type-h3 mt-1.5 text-ink">{result.title}</p>
              <p className="type-small mt-2 text-ink-muted">{result.successDefinition}</p>
              <div className="mt-3 flex items-center gap-2">
                <div
                  className="h-1.5 grow overflow-hidden rounded-full bg-bg-subtle"
                  role="meter"
                  aria-label={`${result.title} progress`}
                  aria-valuenow={Math.round(result.progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round(result.progress * 100)}%` }}
                  />
                </div>
                <span data-numeric className="type-small text-ink-muted">
                  {Math.round(result.progress * 100)}%
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
