import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

export type CardTone = 'default' | 'protect' | 'watch' | 'risk' | 'primary';

const TONES: Record<CardTone, string> = {
  default: 'border-line',
  protect: 'border-protect/45 bg-protect-soft/35',
  watch: 'border-watch/45 bg-watch-soft/35',
  risk: 'border-risk/45 bg-risk-soft/35',
  primary: 'border-primary/35 bg-primary-soft/30',
};

export function Card({
  tone = 'default',
  className,
  children,
  id,
  as: Tag = 'section',
}: {
  tone?: CardTone;
  className?: string;
  children: ReactNode;
  /** Set when the card is an in-page anchor target. */
  id?: string;
  as?: 'section' | 'article' | 'div' | 'li';
}) {
  return (
    <Tag
      id={id}
      className={cn(
        'rounded-[var(--radius-lg)] border bg-surface shadow-[var(--shadow-soft)]',
        TONES[tone],
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5 pb-3', className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  as: Tag = 'h2',
}: {
  className?: string;
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
}) {
  return <Tag className={cn('type-h3 text-ink', className)}>{children}</Tag>;
}

export function CardDescription({ children }: { children: ReactNode }) {
  return <p className="type-small mt-1 text-ink-muted">{children}</p>;
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn('px-5 pb-5', className)}>{children}</div>;
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 border-t border-line px-5 py-3.5',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Small uppercase section heading used above groups of cards. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="type-label text-ink-faint">{children}</p>;
}
