'use client';

import { useTransition } from 'react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/feedback';
import { setActionStatusAction } from './actions';

export interface Move {
  id: string;
  title: string;
  kind: string;
  why: string | null;
  timeMinutes: number;
  status: string;
}

const KIND_LABEL: Record<string, string> = {
  strategic: 'Strategic',
  health: 'Self',
  relationship: 'Relationship',
  admin: 'Admin',
};

const KIND_TONE: Record<string, 'primary' | 'protect' | 'neutral'> = {
  strategic: 'primary',
  health: 'protect',
  relationship: 'protect',
  admin: 'neutral',
};

/**
 * The three moves. Composition is fixed — one strategic, one for the self, one for a
 * relationship — so a day cannot quietly become three career tasks.
 */
export function TodayMoves({ moves }: { moves: Move[] }) {
  const [pending, startTransition] = useTransition();

  function toggle(move: Move) {
    startTransition(async () => {
      await setActionStatusAction(move.id, move.status === 'done' ? 'planned' : 'done');
    });
  }

  return (
    <ol className="space-y-3">
      {moves.map((move, index) => {
        const done = move.status === 'done';
        return (
          <li
            key={move.id}
            className={cn(
              'rounded-[var(--radius-lg)] border bg-surface px-5 py-4 transition-colors',
              done ? 'border-protect/45 bg-protect-soft/25' : 'border-line',
            )}
          >
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={() => toggle(move)}
                disabled={pending}
                aria-pressed={done}
                aria-label={done ? `Mark "${move.title}" as not done` : `Mark "${move.title}" as done`}
                className={cn(
                  'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors',
                  done
                    ? 'border-protect bg-protect text-white'
                    : 'border-line-strong hover:border-primary',
                )}
              >
                {done && (
                  <svg className="size-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path
                      d="M2.5 7.5 5.5 10.5 11.5 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>

              <div className="min-w-0 grow">
                <div className="flex flex-wrap items-center gap-2">
                  <span data-numeric className="type-label text-ink-faint">
                    {index + 1}
                  </span>
                  <Badge tone={KIND_TONE[move.kind] ?? 'neutral'}>
                    {KIND_LABEL[move.kind] ?? move.kind}
                  </Badge>
                  <span className="type-label text-ink-faint">{move.timeMinutes} min</span>
                </div>
                <p
                  className={cn(
                    'type-body mt-1.5 font-medium',
                    done ? 'text-ink-muted line-through' : 'text-ink',
                  )}
                >
                  {move.title}
                </p>
                {move.why && <p className="type-small mt-1 text-ink-muted">{move.why}</p>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
