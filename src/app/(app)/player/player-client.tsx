'use client';

import { useState, useTransition } from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, ErrorState } from '@/components/ui/feedback';
import { ProvenanceChip } from '@/components/ui/provenance';
import { WhyDisclosure } from '@/components/ui/dialog';
import { ProgressiveStatus } from '@/components/ui/progressive-status';
import type { SourceKind } from '@/schemas/common';
import type { PlayerDraft } from '@/schemas/artefacts';
import { choosePlayerAction, draftPlayersAction } from './actions';

interface ExistingPlayer {
  name: string;
  identity: string;
  intention: string;
  mantra: string;
  attitude: string[];
  actions: string[];
  agreements: string[];
  boundaries: string[];
  strengths: string[];
  watchOuts: string[];
  whyThisFits: string | null;
  source: SourceKind;
  confidence: number;
}

export function PlayerClient({ existing }: { existing: ExistingPlayer | null }) {
  const [options, setOptions] = useState<PlayerDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      setError(null);
      const result = await draftPlayersAction();
      if (!result.ok) setError(result.error);
      else setOptions(result.data);
    });
  }

  if (options) {
    return (
      <div className="space-y-5">
        <p className="type-body text-ink-muted">
          Three players that fit what you have told us. Choose the one you would actually want to
          be for the next ninety days.
        </p>
        {error && <ErrorState message={error} />}

        <div className="grid gap-5 md:grid-cols-3">
          {options.map((option) => (
            <Card key={option.name} className="flex flex-col">
              <CardHeader>
                <CardTitle as="h3">{option.name}</CardTitle>
              </CardHeader>
              <CardBody className="flex grow flex-col gap-3">
                <p className="type-statement text-lg text-ink">“{option.mantra}”</p>
                <p className="type-small text-ink-muted">{option.identity}</p>
                <div className="flex flex-wrap gap-1.5">
                  {option.attitude.map((a) => (
                    <Badge key={a} tone="neutral">
                      {a}
                    </Badge>
                  ))}
                </div>
                <WhyDisclosure label="Why this one?">{option.whyThisFits}</WhyDisclosure>
                <div className="mt-auto pt-3">
                  <Button
                    className="w-full"
                    loading={pending}
                    onClick={() =>
                      startTransition(async () => {
                        setError(null);
                        const result = await choosePlayerAction(option);
                        if (!result.ok) setError(result.error);
                        else setOptions(null);
                      })
                    }
                  >
                    Be this player
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        <Button variant="ghost" onClick={() => setOptions(null)}>
          None of these
        </Button>
      </div>
    );
  }

  if (pending) {
    return (
      <ProgressiveStatus
        steps={[
          'Reviewing your identity',
          'Reading your current game',
          'Drafting agreements',
          'Shaping three options',
        ]}
        title="Designing your player"
      />
    );
  }

  if (!existing) {
    return (
      <div className="space-y-4">
        {error && <ErrorState message={error} />}
        <EmptyState
          title="You have not designed your Player yet"
          description="We will propose three, built from your identity, your constraints and what you refuse to sacrifice. You choose."
          actionLabel="Design my player"
          onAction={generate}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <ErrorState message={error} />}

      <Card tone="primary">
        <CardHeader>
          <div>
            <p className="type-label text-primary">Player</p>
            <CardTitle as="h2" className="type-statement mt-1">
              {existing.name}
            </CardTitle>
          </div>
          <ProvenanceChip source={existing.source} confidence={existing.confidence} />
        </CardHeader>
        <CardBody className="space-y-5">
          <p className="type-statement text-xl text-ink">“{existing.mantra}”</p>
          <p className="type-body text-ink-muted">{existing.identity}</p>

          <div>
            <p className="type-label text-ink-faint">Intention</p>
            <p className="type-body mt-1 text-ink">{existing.intention}</p>
          </div>

          <div>
            <p className="type-label text-ink-faint">Attitude</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {existing.attitude.map((a) => (
                <Badge key={a} tone="primary">
                  {a}
                </Badge>
              ))}
            </div>
          </div>

          {existing.whyThisFits && (
            <WhyDisclosure label="Why this player?">{existing.whyThisFits}</WhyDisclosure>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <ListCard title="Agreements" items={existing.agreements} tone="protect" />
        <ListCard title="Boundaries" items={existing.boundaries} tone="protect" />
        <ListCard title="Actions" items={existing.actions} />
        <ListCard title="Watch-outs" items={existing.watchOuts} tone="watch" />
      </div>

      <Button variant="secondary" onClick={generate}>
        Design a different player
      </Button>
    </div>
  );
}

function ListCard({
  title,
  items,
  tone = 'default',
}: {
  title: string;
  items: string[];
  tone?: 'default' | 'protect' | 'watch';
}) {
  if (items.length === 0) return null;

  return (
    <Card tone={tone}>
      <CardHeader>
        <CardTitle as="h3">{title}</CardTitle>
      </CardHeader>
      <CardBody>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item} className="type-body flex gap-2.5 text-ink">
              <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-ink-faint" />
              {item}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
