import { cn } from '@/lib/cn';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/feedback';

export interface SacrificeRow {
  domainKey: string;
  label: string;
  delta: number;
  why: string;
}

/**
 * Sacrifice Radar. Diverging bars from a centre line, −3 to +3.
 *
 * The visual point is that gains and costs share a scale, so a plan that buys career
 * progress with health cannot present the gain without the bill next to it.
 */
export function SacrificeRadar({
  rows,
  verdict,
  warning,
  alternatives = [],
}: {
  rows: SacrificeRow[];
  verdict: 'balanced' | 'watch' | 'warning';
  warning?: string | null;
  alternatives?: Array<{ title: string; detail: string; leverage: string }>;
}) {
  const tone = verdict === 'warning' ? 'risk' : verdict === 'watch' ? 'watch' : 'protect';

  return (
    <Card tone={verdict === 'warning' ? 'risk' : 'default'}>
      <CardHeader>
        <div>
          <CardTitle>Sacrifice Radar</CardTitle>
          <p className="type-small mt-1 text-ink-muted">
            What this plan gains, and what it quietly costs.
          </p>
        </div>
        <Badge tone={tone}>
          {verdict === 'warning' ? 'Strategy warning' : verdict === 'watch' ? 'Watch' : 'Balanced'}
        </Badge>
      </CardHeader>

      <CardBody className="space-y-5">
        {warning && (
          <div
            className={cn(
              'rounded-[var(--radius-md)] border-l-3 px-4 py-3',
              verdict === 'warning'
                ? 'border-l-risk bg-risk-soft/50'
                : 'border-l-watch bg-watch-soft/50',
            )}
          >
            <p className="type-body text-ink">{warning}</p>
          </div>
        )}

        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.domainKey} className="grid grid-cols-[7rem_1fr] items-center gap-3">
              <span className="type-small truncate text-ink-muted" title={row.label}>
                {row.label}
              </span>
              <DivergingBar delta={row.delta} why={row.why} label={row.label} />
            </li>
          ))}
        </ul>

        {alternatives.length > 0 && (
          <div className="rounded-[var(--radius-md)] bg-bg-subtle px-4 py-4">
            <p className="type-label text-ink-faint">
              Same ambition, different method
            </p>
            <ul className="mt-3 space-y-3">
              {alternatives.map((alt) => (
                <li key={alt.title}>
                  <p className="type-small font-semibold text-ink">{alt.title}</p>
                  <p className="type-small mt-0.5 text-ink-muted">{alt.detail}</p>
                  <Badge tone="primary" className="mt-1.5">
                    {alt.leverage}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function DivergingBar({ delta, why, label }: { delta: number; why: string; label: string }) {
  const magnitude = Math.min(3, Math.abs(delta));
  const width = (magnitude / 3) * 50; // each half of the track is 50%
  const positive = delta > 0;

  return (
    <div
      className="group relative h-6"
      title={why}
      role="meter"
      aria-label={`${label} impact`}
      aria-valuenow={delta}
      aria-valuemin={-3}
      aria-valuemax={3}
      aria-valuetext={`${delta > 0 ? '+' : ''}${delta}: ${why}`}
    >
      <div className="absolute inset-0 rounded-[var(--radius-sm)] bg-bg-subtle" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-line-strong" aria-hidden="true" />
      {delta !== 0 && (
        <div
          className={cn(
            'absolute inset-y-1 rounded-[var(--radius-sm)] transition-[width] duration-320',
            positive ? 'bg-primary' : 'bg-risk',
          )}
          style={
            positive
              ? { left: '50%', width: `${width}%` }
              : { right: '50%', width: `${width}%` }
          }
        />
      )}
      <span
        data-numeric
        className={cn(
          'absolute top-1/2 -translate-y-1/2 text-xs font-semibold',
          positive ? 'left-[calc(50%+0.5rem)] text-primary-ink' : 'right-[calc(50%+0.5rem)] text-risk',
          positive && width < 12 && 'text-primary',
        )}
      >
        {delta > 0 ? `+${delta}` : delta < 0 ? delta : ''}
      </span>
    </div>
  );
}
