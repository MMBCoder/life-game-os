'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * The loading experience. Never a bare spinner (spec §76).
 *
 * Steps tick over on a timer rather than tracking real agent completion: the council
 * runs its agents in parallel, so genuine per-agent progress would arrive in a burst
 * and communicate less than a paced sequence does. The steps are truthful about
 * *what* is happening, not about the exact moment each finishes.
 */
export function ProgressiveStatus({
  steps,
  intervalMs = 900,
  title = 'Your council is thinking',
}: {
  steps: string[];
  intervalMs?: number;
  title?: string;
}) {
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    if (completed >= steps.length) return;
    const timer = setTimeout(() => setCompleted((c) => c + 1), intervalMs);
    return () => clearTimeout(timer);
  }, [completed, steps.length, intervalMs]);

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-line bg-surface px-5 py-5"
      role="status"
      aria-live="polite"
    >
      <p className="type-label text-ink-faint">{title}</p>
      <ul className="stagger mt-4 space-y-2.5">
        {steps.map((step, index) => {
          const done = index < completed;
          const active = index === completed;
          return (
            <li
              key={step}
              className={cn(
                'type-small flex items-center gap-2.5 transition-colors',
                done ? 'text-ink' : active ? 'text-ink-muted' : 'text-ink-faint',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-4 shrink-0 place-items-center rounded-full border text-[10px]',
                  done
                    ? 'border-protect bg-protect text-white'
                    : active
                      ? 'border-primary'
                      : 'border-line-strong',
                )}
              >
                {done ? '✓' : ''}
              </span>
              {step}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const COUNCIL_STEPS = [
  'Reviewing your Personal Model',
  'Checking your current game',
  'Consulting the Health Guardian',
  'Testing capacity',
  'Checking relationship impact',
  'Red-teaming the recommendation',
  'Synthesising',
];

export const ONBOARDING_STEPS = [
  'Understanding what matters to you',
  'Reading your ambition',
  'Noting what must be protected',
  'Estimating your life map',
  'Looking for tensions',
  'Building your snapshot',
];

export const GAME_STEPS = [
  'Understanding your current situation',
  'Reviewing your priorities',
  'Searching for leverage',
  'Checking your capacity',
  'Protecting your non-negotiables',
  'Testing the strategy',
  'Your game is ready',
];
