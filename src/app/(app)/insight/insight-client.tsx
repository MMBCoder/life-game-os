'use client';

import { useState, useTransition } from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, ErrorState } from '@/components/ui/feedback';
import { ProvenanceChip } from '@/components/ui/provenance';
import { ProgressiveStatus } from '@/components/ui/progressive-status';
import { WhyDisclosure } from '@/components/ui/dialog';
import type { SourceKind } from '@/schemas/common';
import { confirmClaimAction, generatePlanAction, rejectClaimAction } from './actions';

export function GeneratePlan({ hasPlan }: { hasPlan: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      setError(null);
      const result = await generatePlanAction();
      if (!result.ok) setError(result.error);
    });
  }

  if (pending) {
    return (
      <ProgressiveStatus
        steps={[
          'Reviewing everything you have told us',
          'Reading your life map',
          'Looking for what you may not be seeing',
          'Writing your insight plan',
        ]}
        title="Building your personal insight plan"
      />
    );
  }

  if (!hasPlan) {
    return (
      <div className="space-y-4">
        {error && <ErrorState message={error} />}
        <EmptyState
          title="No insight plan yet"
          description="Eighteen sections written from everything you have told us — including what you tend to overdo, what you avoid, and where the biggest opportunity actually is."
          actionLabel="Generate my insight plan"
          onAction={generate}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <ErrorState message={error} />}
      <Button variant="secondary" size="sm" onClick={generate}>
        Regenerate from what we know now
      </Button>
    </div>
  );
}

export function ClaimRow({
  id,
  table,
  label,
  note,
  source,
  confidence,
}: {
  id: string;
  table: 'values' | 'strengths' | 'constraints' | 'non_negotiables';
  label: string;
  note: string | null;
  source: SourceKind;
  confidence: number;
}) {
  const [pending, startTransition] = useTransition();
  const [resolved, setResolved] = useState<'confirmed' | 'rejected' | null>(null);
  const needsConfirmation = source !== 'user_said' && source !== 'user_confirmed';

  if (resolved === 'rejected') {
    return <p className="type-small text-ink-faint line-through">{label}</p>;
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="type-body text-ink">{label}</p>
        {note && <p className="type-small mt-0.5 text-ink-faint capitalize">{note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ProvenanceChip
          source={resolved === 'confirmed' ? 'user_confirmed' : source}
          confidence={confidence}
        />
        {needsConfirmation && resolved === null && (
          <div className="flex gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await confirmClaimAction(table, id);
                  setResolved('confirmed');
                })
              }
              className="type-label rounded-full border border-line-strong px-2 py-0.5 text-ink-muted transition-colors hover:border-protect hover:text-protect"
            >
              Yes
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await rejectClaimAction(table, id);
                  setResolved('rejected');
                })
              }
              className="type-label rounded-full border border-line-strong px-2 py-0.5 text-ink-muted transition-colors hover:border-risk hover:text-risk"
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A blind spot is only legitimate if it can be rejected. The Correct affordance is
 * as prominent as the Confirm one.
 */
export function BlindSpotCard({
  id,
  hypothesis,
  detail,
  confidence,
  basedOn,
}: {
  id: string;
  hypothesis: string;
  detail: string;
  confidence: number;
  basedOn: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [resolved, setResolved] = useState<'accepted' | 'rejected' | null>(null);

  return (
    <Card tone={resolved === 'rejected' ? 'default' : 'watch'}>
      <CardHeader>
        <div className="min-w-0">
          <Badge tone="neutral">Hypothesis</Badge>
          <CardTitle as="h3" className="mt-2">
            {hypothesis}
          </CardTitle>
        </div>
        <ProvenanceChip source="ai_inferred" confidence={confidence} />
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="type-body text-ink">{detail}</p>

        {basedOn.length > 0 && (
          <WhyDisclosure label="What this is based on">
            <ul className="list-inside list-disc space-y-1">
              {basedOn.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </WhyDisclosure>
        )}

        {resolved === null ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await confirmClaimAction('blind_spots', id);
                  setResolved('accepted');
                })
              }
            >
              That’s fair
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await rejectClaimAction('blind_spots', id);
                  setResolved('rejected');
                })
              }
            >
              Not right
            </Button>
          </div>
        ) : (
          <p className="type-small text-ink-faint">
            {resolved === 'accepted'
              ? 'Noted. This will inform your plan.'
              : 'Dismissed. We will not raise it again.'}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
