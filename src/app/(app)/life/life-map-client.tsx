'use client';

import { useState, useTransition } from 'react';
import { LifeWheel } from '@/components/life-wheel/life-wheel';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, ErrorState, Meter } from '@/components/ui/feedback';
import { ProvenanceChip, ScaleCheck } from '@/components/ui/provenance';
import { ProgressiveStatus } from '@/components/ui/progressive-status';
import { Input } from '@/components/ui/field';
import type { SourceKind } from '@/schemas/common';
import type { DomainScores } from '@/lib/personalization/context-types';
import { addDomainAction, adjustScoreAction, estimateAction, removeDomainAction } from './actions';

interface DomainView {
  id: string;
  key: string;
  label: string;
  isCustom: boolean;
  source: SourceKind | null;
  confidence: number | null;
  basis: string | null;
  scores: DomainScores | null;
}

export function LifeMapClient({ domains }: { domains: DomainView[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const scored = domains.filter(
    (d): d is DomainView & { scores: DomainScores } => d.scores !== null,
  );
  const active = scored.find((d) => d.key === selected) ?? scored[0] ?? null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) setError(result.error ?? 'Something went wrong.');
    });
  }

  return (
    <div className="space-y-6">
      {error && <ErrorState message={error} />}

      {pending && scored.length === 0 && (
        <ProgressiveStatus
          steps={[
            'Reading what you have told us',
            'Estimating each domain',
            'Separating outer results from inner experience',
            'Looking for divergences',
          ]}
          title="Estimating your life map"
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardBody className="flex justify-center pt-6">
            {scored.length >= 3 ? (
              <LifeWheel
                domains={scored.map((d) => ({
                  key: d.key,
                  label: d.label,
                  outerResult: d.scores.outerResult,
                  innerExperience: d.scores.innerExperience,
                  importance: d.scores.importance,
                  desiredExperience: d.scores.desiredExperience,
                }))}
                onSelect={setSelected}
                selectedKey={active?.key ?? null}
              />
            ) : (
              <div className="py-12 text-center">
                <p className="type-body text-ink-muted">
                  Your map has not been estimated yet.
                </p>
                <Button
                  className="mt-5"
                  loading={pending}
                  onClick={() => run(() => estimateAction())}
                >
                  Estimate my life map
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Detail panel for the selected spoke */}
        {active && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{active.label}</CardTitle>
                {active.basis && (
                  <p className="type-small mt-1 text-ink-muted">{active.basis}</p>
                )}
              </div>
              {active.source && (
                <ProvenanceChip source={active.source} confidence={active.confidence} />
              )}
            </CardHeader>
            <CardBody className="space-y-4">
              <Meter label="Outer result" value={active.scores.outerResult} />
              <Meter
                label="Inner experience"
                value={active.scores.innerExperience}
                tone={
                  active.scores.outerResult - active.scores.innerExperience >= 2
                    ? 'watch'
                    : 'protect'
                }
              />
              <Meter label="Desired" value={active.scores.desiredExperience} tone="neutral" />
              <Meter label="Importance" value={active.scores.importance} tone="neutral" />

              <div className="space-y-3 border-t border-line pt-4">
                <p className="type-label text-ink-faint">Does this read right?</p>
                <ScaleCheck
                  label="Outer result"
                  value={active.scores.outerResult}
                  pending={pending}
                  onAdjust={(dir) =>
                    run(() => adjustScoreAction(active.id, 'outerResult', dir))
                  }
                />
                <ScaleCheck
                  label="Inner experience"
                  value={active.scores.innerExperience}
                  pending={pending}
                  onAdjust={(dir) =>
                    run(() => adjustScoreAction(active.id, 'innerExperience', dir))
                  }
                />
                <ScaleCheck
                  label="Importance"
                  value={active.scores.importance}
                  pending={pending}
                  onAdjust={(dir) => run(() => adjustScoreAction(active.id, 'importance', dir))}
                />
              </div>

              {active.isCustom && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => removeDomainAction(active.id))}
                >
                  Remove this domain
                </Button>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      {/* Domain list — the mobile-friendly equivalent of the wheel */}
      <Card>
        <CardHeader>
          <CardTitle>All domains</CardTitle>
          {scored.length >= 3 && (
            <Button
              size="sm"
              variant="ghost"
              loading={pending}
              onClick={() => run(() => estimateAction())}
            >
              Re-estimate
            </Button>
          )}
        </CardHeader>
        <CardBody className="space-y-2">
          <ul className="space-y-2">
            {domains.map((domain) => (
              <li key={domain.id}>
                <button
                  type="button"
                  onClick={() => setSelected(domain.key)}
                  className="w-full rounded-[var(--radius-md)] border border-line px-4 py-3 text-left transition-colors hover:border-line-strong hover:bg-bg-subtle"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="type-body text-ink">{domain.label}</span>
                    {domain.scores ? (
                      <span className="flex items-center gap-3">
                        <span data-numeric className="type-small text-primary">
                          {domain.scores.outerResult.toFixed(1)} out
                        </span>
                        <span data-numeric className="type-small text-protect">
                          {domain.scores.innerExperience.toFixed(1)} in
                        </span>
                        {domain.scores.outerResult - domain.scores.innerExperience >= 2 && (
                          <Badge tone="watch">diverging</Badge>
                        )}
                      </span>
                    ) : (
                      <span className="type-small text-ink-faint">not estimated</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {adding ? (
            <div className="flex items-end gap-2 pt-2">
              <div className="grow">
                <Input
                  label="New domain"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Craft"
                  autoFocus
                />
              </div>
              <Button
                disabled={pending || newLabel.trim().length < 2}
                onClick={() =>
                  run(async () => {
                    const result = await addDomainAction(newLabel);
                    setNewLabel('');
                    setAdding(false);
                    return result;
                  })
                }
              >
                Add
              </Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="type-small w-full rounded-[var(--radius-md)] border border-dashed border-line-strong px-4 py-3 text-left text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
            >
              Add a domain of your own
            </button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
