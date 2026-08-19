import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';
import { Button } from './button';

/* ── Badge ──────────────────────────────────────────────────────────────────*/

export type BadgeTone = 'neutral' | 'primary' | 'protect' | 'watch' | 'risk';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-bg-subtle text-ink-muted border-line-strong',
  primary: 'bg-primary-soft text-primary border-primary/30',
  protect: 'bg-protect-soft text-protect border-protect/40',
  watch: 'bg-watch-soft text-watch border-watch/40',
  risk: 'bg-risk-soft text-risk border-risk/40',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'type-label inline-flex items-center rounded-full border px-2 py-0.5',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Callout ────────────────────────────────────────────────────────────────*/

export function Callout({
  tone = 'primary',
  title,
  children,
}: {
  tone?: BadgeTone;
  title?: string;
  children: ReactNode;
}) {
  const border: Record<BadgeTone, string> = {
    neutral: 'border-l-line-strong bg-bg-subtle',
    primary: 'border-l-primary bg-primary-soft/40',
    protect: 'border-l-protect bg-protect-soft/40',
    watch: 'border-l-watch bg-watch-soft/40',
    risk: 'border-l-risk bg-risk-soft/40',
  };

  return (
    <div className={cn('rounded-r-[var(--radius-md)] border-l-3 px-4 py-3', border[tone])}>
      {title && <p className="type-label mb-1 text-ink">{title}</p>}
      <div className="type-small text-ink">{children}</div>
    </div>
  );
}

/* ── Meter ──────────────────────────────────────────────────────────────────*/

/**
 * A labelled bar. Exposed as `role="meter"` so the value is available to assistive
 * technology rather than being conveyed by width alone.
 */
export function Meter({
  label,
  value,
  max = 10,
  tone = 'primary',
  caption,
}: {
  label: string;
  value: number;
  max?: number;
  tone?: BadgeTone;
  caption?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill: Record<BadgeTone, string> = {
    neutral: 'bg-ink-faint',
    primary: 'bg-primary',
    protect: 'bg-protect',
    watch: 'bg-watch',
    risk: 'bg-risk',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="type-small text-ink-muted">{label}</span>
        <span data-numeric className="type-small font-semibold text-ink">
          {value.toFixed(1)}
          <span className="text-ink-faint">/{max}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(value * 10) / 10}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-2 overflow-hidden rounded-full bg-bg-subtle"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-320', fill[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {caption && <p className="type-small text-ink-faint">{caption}</p>}
    </div>
  );
}

/* ── Stat ───────────────────────────────────────────────────────────────────*/

export function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: BadgeTone;
}) {
  const colour: Record<BadgeTone, string> = {
    neutral: 'text-ink',
    primary: 'text-primary',
    protect: 'text-protect',
    watch: 'text-watch',
    risk: 'text-risk',
  };

  return (
    <div>
      <p className="type-label text-ink-faint">{label}</p>
      <p data-numeric className={cn('mt-1 text-2xl font-semibold', colour[tone])}>
        {value}
      </p>
      {sub && <p className="type-small mt-0.5 text-ink-muted">{sub}</p>}
    </div>
  );
}

/* ── Empty & error states ───────────────────────────────────────────────────*/

/** Every page has one. An empty screen with no next action is a dead end. */
export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
      {icon && <div className="mb-4 text-ink-faint">{icon}</div>}
      <h3 className="type-h3 text-ink">{title}</h3>
      <p className="type-body mt-2 max-w-md text-ink-muted">{description}</p>
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="mt-6 inline-flex h-11 items-center rounded-[var(--radius-md)] bg-primary px-5 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover"
        >
          {actionLabel}
        </a>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-lg)] border border-risk/40 bg-risk-soft/40 px-5 py-4"
    >
      <p className="type-body text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ── Divider ────────────────────────────────────────────────────────────────*/

export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="border-line" />;
  return (
    <div className="flex items-center gap-3">
      <hr className="grow border-line" />
      <span className="type-label text-ink-faint">{label}</span>
      <hr className="grow border-line" />
    </div>
  );
}
