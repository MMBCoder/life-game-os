'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Modal dialog with a focus trap, Esc to close, scroll lock, and focus restoration.
 * Built on the native `<dialog>` element so the semantics come from the platform.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    } else if (!open && dialog.open) {
      dialog.close();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    previouslyFocused.current?.focus?.();
  }, [open]);

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Clicking the backdrop (the dialog element itself) closes.
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      aria-describedby={description ? 'dialog-desc' : undefined}
      className={cn(
        'w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-line bg-surface p-0',
        'text-ink shadow-[var(--shadow-lift)] backdrop:bg-black/40',
        'open:animate-fade',
        widths[size],
      )}
    >
      <div className="border-b border-line px-5 py-4">
        <h2 id="dialog-title" className="type-h3">
          {title}
        </h2>
        {description && (
          <p id="dialog-desc" className="type-small mt-1 text-ink-muted">
            {description}
          </p>
        )}
      </div>
      <div className="max-h-[60vh] overflow-y-auto px-5 py-4">{children}</div>
      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5">
          {footer}
        </div>
      )}
    </dialog>
  );
}

/**
 * Disclosure used for "Why?" throughout the product. Explainability is a
 * requirement, and burying it behind a modal makes it feel like fine print.
 */
export function WhyDisclosure({
  label = 'Why?',
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <details className="group">
      <summary className="type-small inline-flex cursor-pointer list-none items-center gap-1 text-primary hover:underline">
        {label}
        <svg
          className="size-3 transition-transform group-open:rotate-180"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="type-small mt-2 rounded-[var(--radius-md)] bg-bg-subtle px-4 py-3 text-ink-muted">
        {children}
      </div>
    </details>
  );
}
