'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { Textarea } from './field';

export interface Suggestion {
  text: string;
  /** Why this fits *this* person. The difference between "Exercise" and a real suggestion. */
  because?: string;
}

/**
 * The second product law made concrete: no bare empty field.
 *
 * Every place the user would otherwise face a blank box offers model-derived options
 * with Use this / Modify / Write my own.
 */
export function SuggestionList({
  suggestions,
  onSelect,
  emptyLabel = 'Write your own',
  multiple = false,
  selected = [],
}: {
  suggestions: Suggestion[];
  onSelect: (value: string) => void;
  emptyLabel?: string;
  multiple?: boolean;
  selected?: string[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [writing, setWriting] = useState(false);

  if (editing !== null) {
    return (
      <div className="space-y-3">
        <Textarea
          label="Adjust this to fit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          autoFocus
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              if (draft.trim()) onSelect(draft.trim());
              setEditing(null);
              setDraft('');
            }}
          >
            Use this
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (writing) {
    return (
      <div className="space-y-3">
        <Textarea
          label="In your own words"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          autoFocus
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              if (draft.trim()) onSelect(draft.trim());
              setWriting(false);
              setDraft('');
            }}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setWriting(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {suggestions.map((suggestion) => {
        const isSelected = selected.includes(suggestion.text);
        return (
          <div
            key={suggestion.text}
            className={cn(
              'group rounded-[var(--radius-md)] border px-4 py-3 transition-colors',
              isSelected
                ? 'border-primary bg-primary-soft/40'
                : 'border-line hover:border-line-strong hover:bg-bg-subtle',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="type-body text-ink">{suggestion.text}</p>
                {suggestion.because && (
                  <p className="type-small mt-1 text-ink-muted">{suggestion.because}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant={isSelected ? 'primary' : 'secondary'}
                  onClick={() => onSelect(suggestion.text)}
                >
                  {isSelected ? 'Selected' : multiple ? 'Add' : 'Use this'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraft(suggestion.text);
                    setEditing(suggestion.text);
                  }}
                >
                  Modify
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setWriting(true)}
        className="type-small w-full rounded-[var(--radius-md)] border border-dashed border-line-strong px-4 py-3 text-left text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
      >
        {emptyLabel}
      </button>
    </div>
  );
}

/** Compact multi-select chips, used where options are single words. */
export function ChipSelect({
  options,
  selected,
  onToggle,
  max,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  max?: number;
}) {
  const atLimit = typeof max === 'number' && selected.length >= max;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isSelected}
            disabled={!isSelected && atLimit}
            onClick={() => onToggle(option)}
            className={cn(
              'rounded-full border px-3.5 py-2 text-sm transition-colors',
              isSelected
                ? 'border-primary bg-primary text-primary-ink'
                : 'border-line-strong text-ink-muted hover:border-ink-faint hover:text-ink',
              !isSelected && atLimit && 'cursor-not-allowed opacity-40',
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
