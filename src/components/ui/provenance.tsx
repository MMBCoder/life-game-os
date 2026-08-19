'use client';

import { cn } from '@/lib/cn';
import type { SourceKind } from '@/schemas/common';
import { Button } from './button';

/**
 * The visible face of the product's third law: an inference is never rendered as a
 * fact. Every claim about the person carries one of these.
 */

const LABELS: Record<SourceKind, string> = {
  user_said: 'You said',
  user_confirmed: 'Confirmed',
  ai_inferred: 'AI inferred',
  ai_suggested: 'AI suggests',
  ai_generated: 'AI generated',
};

const STYLES: Record<SourceKind, string> = {
  user_said: 'bg-primary-soft text-primary border-primary/30',
  user_confirmed: 'bg-protect-soft text-protect border-protect/40',
  ai_inferred: 'bg-bg-subtle text-ink-muted border-line-strong',
  ai_suggested: 'bg-bg-subtle text-ink-muted border-line-strong',
  ai_generated: 'bg-bg-subtle text-ink-muted border-line-strong',
};

export function ProvenanceChip({
  source,
  confidence,
  className,
}: {
  source: SourceKind;
  confidence?: number | null;
  className?: string;
}) {
  const isInference = source !== 'user_said' && source !== 'user_confirmed';

  return (
    <span
      className={cn(
        'type-label inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5',
        STYLES[source],
        className,
      )}
    >
      {LABELS[source]}
      {isInference && typeof confidence === 'number' && (
        <span data-numeric className="font-normal opacity-75">
          {Math.round(confidence * 100)}%
        </span>
      )}
    </span>
  );
}

/**
 * Confirm / Correct. Present wherever the system has made an inference, because a
 * system that cannot be corrected is a system that pretends to know the person
 * better than they know themselves.
 */
export function ConfirmCorrect({
  onConfirm,
  onCorrect,
  confirmLabel = 'Confirm',
  correctLabel = 'Correct',
  pending = false,
}: {
  onConfirm: () => void;
  onCorrect: () => void;
  confirmLabel?: string;
  correctLabel?: string;
  pending?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" onClick={onConfirm} disabled={pending}>
        {confirmLabel}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCorrect} disabled={pending}>
        {correctLabel}
      </Button>
    </div>
  );
}

/**
 * The fast score-confirmation control. Estimating and letting the person nudge is
 * dramatically less work than asking them to fill in ninety sliders.
 */
export function ScaleCheck({
  value,
  onAdjust,
  label,
  pending = false,
}: {
  value: number;
  label: string;
  onAdjust: (direction: 'lower' | 'right' | 'higher') => void;
  pending?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="type-small text-ink-muted">
        {label}{' '}
        <strong data-numeric className="text-ink">
          {value.toFixed(1)}
        </strong>
        /10
      </span>
      <div
        className="inline-flex overflow-hidden rounded-[var(--radius-md)] border border-line-strong"
        role="group"
        aria-label={`Adjust ${label}`}
      >
        {(
          [
            ['lower', 'Lower'],
            ['right', 'About right'],
            ['higher', 'Higher'],
          ] as const
        ).map(([dir, text]) => (
          <button
            key={dir}
            type="button"
            disabled={pending}
            onClick={() => onAdjust(dir)}
            className="border-line-strong px-3 py-1.5 text-xs text-ink-muted transition-colors not-last:border-r hover:bg-bg-subtle hover:text-ink disabled:opacity-50"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
