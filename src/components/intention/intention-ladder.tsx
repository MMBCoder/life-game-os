import { cn } from '@/lib/cn';
import { INTENTION_LADDER, type IntentionTone } from '@/lib/intention/scale';
import type { IntentionReading } from '@/lib/scoring/intention';

const RAIL_FILL: Record<IntentionTone, string> = {
  protect: 'bg-protect',
  primary: 'bg-primary',
  neutral: 'bg-ink-faint',
  watch: 'bg-watch',
  risk: 'bg-risk',
};

const TEXT: Record<IntentionTone, string> = {
  protect: 'text-protect',
  primary: 'text-primary',
  neutral: 'text-ink-muted',
  watch: 'text-watch',
  risk: 'text-risk',
};

/**
 * The Intention Ladder: fifteen rungs from -7 to +7, current position marked.
 *
 * A rail rather than a dial, because the point is the *distance* between where the
 * person is and where they could be — a dial hides that. Position is conveyed three
 * ways (colour, the raised rung, and the readout) so it never depends on colour
 * alone, and the whole scale is available as a table for screen readers.
 */
export function IntentionLadder({ reading }: { reading: IntentionReading }) {
  const { level, detail } = reading;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-label text-ink-faint">Intention level</p>
          <div className="mt-1.5 flex items-baseline gap-3">
            <span
              data-numeric
              className={cn('font-display text-6xl leading-none font-semibold', TEXT[detail.tone])}
            >
              {level > 0 ? `+${level}` : level}
            </span>
            <div>
              <p className="type-h3 text-ink">{detail.stance}</p>
              <p className="type-small text-ink-muted">
                Putting out <span className="font-medium text-ink">{detail.energy}</span>
              </p>
            </div>
          </div>
        </div>

        <dl className="flex gap-6">
          <div>
            <dt className="type-label text-ink-faint">Chosen effort</dt>
            <dd data-numeric className="type-h3 mt-0.5 text-ink">
              {reading.lift.toFixed(1)}
            </dd>
          </div>
          <div>
            <dt className="type-label text-ink-faint">Absorbed cost</dt>
            <dd data-numeric className="type-h3 mt-0.5 text-ink">
              {reading.drag.toFixed(1)}
            </dd>
          </div>
        </dl>
      </div>

      {/* ── The rail ─────────────────────────────────────────────────────── */}
      <div
        className="mt-6"
        role="img"
        aria-label={`Intention level ${level > 0 ? `+${level}` : level} on a scale from −7 to +7. ${detail.stance}, putting out ${detail.energy}.`}
      >
        <div className="flex items-end gap-[3px]">
          {[...INTENTION_LADDER].reverse().map((rung) => {
            const current = rung.level === level;
            const reached = level >= 0 ? rung.level > 0 && rung.level <= level : rung.level < 0 && rung.level >= level;
            return (
              <div key={rung.level} className="group relative flex-1">
                <div
                  className={cn(
                    'rounded-full transition-all duration-320',
                    current
                      ? cn('h-12', RAIL_FILL[rung.tone])
                      : reached
                        ? cn('h-7 opacity-55', RAIL_FILL[rung.tone])
                        : 'h-4 bg-line-strong/45',
                  )}
                />
                {current && (
                  <span
                    data-numeric
                    className={cn(
                      'type-label absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap',
                      TEXT[rung.tone],
                    )}
                  >
                    {rung.level > 0 ? `+${rung.level}` : rung.level}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex justify-between">
          <span className="type-label text-ink-faint">+7 Sovereignty</span>
          <span className="type-label text-ink-faint">0 Settling</span>
          <span className="type-label text-ink-faint">−7 Suffering</span>
        </div>
      </div>

      <p className="type-body mt-5 text-ink">{detail.experience}</p>
      <p className="type-small mt-1.5 text-ink-muted">{detail.putting}</p>

      {/* The full scale, for assistive technology and for anyone who wants it. */}
      <details className="group mt-5">
        <summary className="type-small cursor-pointer text-primary underline-offset-4 hover:underline">
          See the whole ladder
        </summary>
        <table className="mt-3 w-full border-collapse text-left">
          <caption className="sr-only">
            The intention ladder, from +7 to −7, with the stance and energy at each level.
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="type-label py-2 text-ink-faint">
                Level
              </th>
              <th scope="col" className="type-label py-2 text-ink-faint">
                Experience
              </th>
              <th scope="col" className="type-label py-2 text-ink-faint">
                Putting out
              </th>
            </tr>
          </thead>
          <tbody>
            {INTENTION_LADDER.map((rung) => (
              <tr
                key={rung.level}
                aria-current={rung.level === level ? 'true' : undefined}
                className={cn(
                  'border-b border-line/60',
                  rung.level === level && 'bg-primary-soft/30',
                )}
              >
                <td data-numeric className={cn('type-small py-1.5 font-semibold', TEXT[rung.tone])}>
                  {rung.level > 0 ? `+${rung.level}` : rung.level}
                </td>
                <td className="type-small py-1.5 text-ink">{rung.stance}</td>
                <td className="type-small py-1.5 text-ink-muted">{rung.energy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
