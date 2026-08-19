'use client';

import { useState, useTransition } from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, ErrorState } from '@/components/ui/feedback';
import { ProgressiveStatus } from '@/components/ui/progressive-status';
import type { ProtocolDraft } from '@/schemas/artefacts';
import { draftProtocolAction, saveProtocolAction } from './actions';

export function ProtocolClient({ hasProtocol }: { hasProtocol: boolean }) {
  const [draft, setDraft] = useState<ProtocolDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      setError(null);
      const result = await draftProtocolAction();
      if (!result.ok) setError(result.error);
      else setDraft(result.data);
    });
  }

  if (pending && !draft) {
    return (
      <ProgressiveStatus
        steps={[
          'Reading your capacity and energy',
          'Checking what you have protected',
          'Designing a minimum that survives a bad day',
          'Choosing rituals that fit your actual life',
        ]}
        title="Building your protocol"
      />
    );
  }

  if (draft) {
    return (
      <div className="space-y-5">
        {error && <ErrorState message={error} />}

        <Card>
          <CardHeader>
            <div>
              <CardTitle as="h2">Proposed protocol</CardTitle>
              <p className="type-small mt-1 text-ink-muted">
                Adopting this replaces your current rituals and routines.
              </p>
            </div>
          </CardHeader>
          <CardBody className="space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="type-label py-2 pr-4 text-left text-ink-faint">
                      Area
                    </th>
                    <th scope="col" className="type-label py-2 pr-4 text-left text-watch">
                      Minimum
                    </th>
                    <th scope="col" className="type-label py-2 pr-4 text-left text-primary">
                      Standard
                    </th>
                    <th scope="col" className="type-label py-2 text-left text-protect">
                      Expansion
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {draft.items.map((item) => (
                    <tr key={item.label} className="border-b border-line last:border-0">
                      <th scope="row" className="type-small py-3 pr-4 text-left font-medium text-ink">
                        {item.label}
                      </th>
                      <td className="type-small py-3 pr-4 text-ink-muted">{item.minimum}</td>
                      <td className="type-small py-3 pr-4 text-ink">{item.standard}</td>
                      <td className="type-small py-3 text-ink-muted">{item.expansion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <p className="type-label text-ink-faint">Rituals</p>
              <ul className="mt-2 space-y-3">
                {draft.rituals.map((ritual) => (
                  <li key={ritual.name} className="rounded-[var(--radius-md)] border border-line px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="type-body font-medium text-ink">{ritual.name}</p>
                      <Badge tone="neutral">{ritual.cadence}</Badge>
                    </div>
                    <p className="type-small mt-1 text-ink-muted">{ritual.detail}</p>
                    <p className="type-small mt-1 text-ink-faint">{ritual.whyThisFits}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="type-label text-ink-faint">Routines</p>
              <ul className="mt-2 space-y-3">
                {draft.routines.map((routine) => (
                  <li key={routine.name} className="rounded-[var(--radius-md)] border border-line px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="type-body font-medium text-ink">{routine.name}</p>
                      <span data-numeric className="type-small text-ink-faint">
                        {routine.durationMinutes} min · {routine.slot}
                      </span>
                    </div>
                    <ol className="mt-1.5 space-y-1">
                      {routine.steps.map((step, i) => (
                        <li key={step} className="type-small text-ink-muted">
                          {i + 1}. {step}
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ul>
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await saveProtocolAction(draft);
                if (!result.ok) setError(result.error);
                else setDraft(null);
              })
            }
          >
            Adopt this protocol
          </Button>
          <Button variant="secondary" disabled={pending} onClick={generate}>
            Try another
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setDraft(null)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (!hasProtocol) {
    return (
      <div className="space-y-4">
        {error && <ErrorState message={error} />}
        <EmptyState
          title="No protocol yet"
          description="We will design three modes around your real capacity — including a minimum that still counts on the days when nothing else does."
          actionLabel="Build my protocol"
          onAction={generate}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <ErrorState message={error} />}
      <Button variant="secondary" onClick={generate}>
        Redesign my protocol
      </Button>
    </div>
  );
}
