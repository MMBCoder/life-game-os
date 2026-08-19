'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { ProgressiveStatus, COUNCIL_STEPS } from '@/components/ui/progressive-status';
import { ErrorState } from '@/components/ui/feedback';
import { OPERATING_STATE_LABEL, type OperatingState, type PlanMode } from '@/schemas/common';
import {
  acceptMomentumAction,
  generateTodayAction,
  overrideStateAction,
  setModeAction,
} from './actions';

export function GenerateDayButton({
  hasPlan,
  size = 'sm',
  label,
}: {
  hasPlan: boolean;
  /** `lg` is used when this is the dashboard's single next action. */
  size?: 'sm' | 'lg';
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        size={size}
        variant={hasPlan && size === 'sm' ? 'ghost' : 'primary'}
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await generateTodayAction();
            if (!result.ok) setError(result.error);
          })
        }
      >
        {label ?? (hasPlan ? 'Regenerate' : 'Plan today')}
      </Button>
      {pending && (
        <div className="mt-3">
          <ProgressiveStatus steps={COUNCIL_STEPS.slice(0, 4)} title="Planning your day" />
        </div>
      )}
      {error && (
        <div className="mt-3">
          <ErrorState message={error} />
        </div>
      )}
    </div>
  );
}

const MODES: PlanMode[] = ['minimum', 'standard', 'expansion'];

/** Three modes, so a bad day still has a defined move rather than becoming a gap. */
export function ModeSwitch({ current }: { current: PlanMode }) {
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label="Today's mode"
      className="inline-flex overflow-hidden rounded-[var(--radius-md)] border border-line-strong"
    >
      {MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          disabled={pending}
          aria-pressed={current === mode}
          onClick={() => startTransition(async () => void (await setModeAction(mode)))}
          className={cn(
            'border-line-strong px-3.5 py-2 text-sm capitalize transition-colors not-last:border-r',
            current === mode
              ? 'bg-primary text-primary-ink'
              : 'text-ink-muted hover:bg-bg-subtle hover:text-ink',
          )}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}

const STATES = Object.keys(OPERATING_STATE_LABEL) as OperatingState[];

export function StateOverride({ current }: { current: OperatingState }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="type-small text-primary underline underline-offset-4"
      >
        That’s not quite right
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="type-small text-ink-muted">Which fits better?</p>
      <div className="flex flex-wrap gap-1.5">
        {STATES.map((state) => (
          <button
            key={state}
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await overrideStateAction(state);
                setOpen(false);
              })
            }
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition-colors',
              state === current
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-line-strong text-ink-muted hover:border-ink-faint hover:text-ink',
            )}
          >
            {OPERATING_STATE_LABEL[state]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MomentumAccept({
  computed,
  accepted,
}: {
  computed: number;
  accepted: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [level, setLevel] = useState(computed);

  if (accepted) {
    return <p className="type-small text-ink-faint">You accepted this level.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        variant="secondary"
        loading={pending}
        onClick={() => startTransition(async () => void (await acceptMomentumAction(computed)))}
      >
        Accept
      </Button>
      <div className="flex items-center gap-2">
        <label htmlFor="momentum-adjust" className="type-small text-ink-muted">
          Adjust
        </label>
        <input
          id="momentum-adjust"
          type="range"
          min={1}
          max={10}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          className="accent-[var(--primary)]"
        />
        <span data-numeric className="type-small w-6 text-ink">
          {level}
        </span>
        {level !== computed && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => startTransition(async () => void (await acceptMomentumAction(level)))}
          >
            Save
          </Button>
        )}
      </div>
    </div>
  );
}
