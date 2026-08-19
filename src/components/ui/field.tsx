'use client';

import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'w-full rounded-[var(--radius-md)] border border-line-strong bg-surface px-3.5 py-2.5 ' +
  'text-ink placeholder:text-ink-faint transition-colors ' +
  'hover:border-ink-faint focus:border-primary focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

export function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="type-label block text-ink-muted">
        {label}
        {required && (
          <span className="ml-1 text-risk" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="type-small text-ink-faint">{hint}</p>}
      {error && (
        <p className="type-small text-risk" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, className, id, ...props }: InputProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const describedBy = hint || error ? `${inputId}-desc` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="type-label block text-ink-muted">
        {label}
        {props.required && (
          <span className="ml-1 text-risk" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={inputId}
        className={cn(CONTROL, error && 'border-risk', className)}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {(hint || error) && (
        <p
          id={describedBy}
          className={cn('type-small', error ? 'text-risk' : 'text-ink-faint')}
          role={error ? 'alert' : undefined}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function Textarea({ label, hint, error, className, id, ...props }: TextareaProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const describedBy = hint || error ? `${inputId}-desc` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="type-label block text-ink-muted">
        {label}
      </label>
      <textarea
        id={inputId}
        rows={props.rows ?? 4}
        className={cn(CONTROL, 'resize-y leading-relaxed', error && 'border-risk', className)}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {(hint || error) && (
        <p
          id={describedBy}
          className={cn('type-small', error ? 'text-risk' : 'text-ink-faint')}
          role={error ? 'alert' : undefined}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
