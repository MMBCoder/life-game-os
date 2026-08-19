'use client';

import { useState, useTransition } from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Badge, Callout, EmptyState, ErrorState } from '@/components/ui/feedback';
import { ProvenanceChip } from '@/components/ui/provenance';
import { ProgressiveStatus } from '@/components/ui/progressive-status';
import type { SourceKind, GoalDimension } from '@/schemas/common';
import type { WholeGoalDraft } from '@/schemas/artefacts';
import { draftGoalAction, saveGoalAction, setDimensionAction } from './actions';

interface ExistingGoal {
  goalId: string;
  title: string;
  rawInput: string | null;
  horizonMonths: number;
  result: string;
  experience: string;
  impact: string;
  identity: string;
  mostImportantDimension: GoalDimension | null;
  source: SourceKind;
  confidence: number;
}

const DIMENSIONS: Array<{ key: GoalDimension; label: string; question: string }> = [
  { key: 'result', label: 'Result', question: 'What will physically exist?' },
  {
    key: 'experience',
    label: 'Experience',
    question: 'How do I want to experience myself while achieving it?',
  },
  { key: 'impact', label: 'Impact', question: 'What changes for other people?' },
  { key: 'identity', label: 'Identity', question: 'Who am I becoming?' },
];

export function GoalClient({ existing }: { existing: ExistingGoal | null }) {
  const [raw, setRaw] = useState('');
  const [draft, setDraft] = useState<WholeGoalDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (existing && !draft) {
    return (
      <WholeGoalView
        goal={existing}
        onReplace={() => {
          setRaw(existing.rawInput ?? existing.title);
          setDraft(null);
          startTransition(() => {});
        }}
      />
    );
  }

  if (draft) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle as="h2">{draft.title}</CardTitle>
              <p className="type-small mt-1 text-ink-muted">
                Built from: “{raw}”
              </p>
            </div>
            <ProvenanceChip source="ai_suggested" confidence={draft.confidence} />
          </CardHeader>
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2">
              {DIMENSIONS.map((dim) => (
                <div
                  key={dim.key}
                  className="rounded-[var(--radius-md)] border border-line px-4 py-3.5"
                >
                  <p className="type-label text-primary">{dim.label}</p>
                  <p className="type-small mt-0.5 text-ink-faint">{dim.question}</p>
                  <p className="type-body mt-2 text-ink">{draft[dim.key]}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {draft.clarifyingQuestion && (
          <Callout tone="primary" title="One question before we go further">
            {draft.clarifyingQuestion}
          </Callout>
        )}

        {error && <ErrorState message={error} />}

        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await saveGoalAction(draft, raw);
                if (!result.ok) setError(result.error);
                else setDraft(null);
              })
            }
          >
            That’s it — save this goal
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => setDraft(null)}>
            Rewrite it
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pending && (
        <ProgressiveStatus
          steps={[
            'Reading what you said',
            'Inferring the result',
            'Inferring the experience',
            'Inferring impact and identity',
          ]}
          title="Building your whole goal"
        />
      )}

      {!pending && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle as="h2">What do you want to change?</CardTitle>
              <p className="type-small mt-1 text-ink-muted">
                Say it however it comes out. “I want a promotion” is enough — we will do the rest.
              </p>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <Textarea
              label="In your own words"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={4}
              placeholder="I want to move into a leadership role without working every evening to get there."
            />
            {error && <ErrorState message={error} />}
            <Button
              size="lg"
              disabled={raw.trim().length < 5}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await draftGoalAction(raw);
                  if (!result.ok) setError(result.error);
                  else setDraft(result.data);
                })
              }
            >
              Build my whole goal
            </Button>
          </CardBody>
        </Card>
      )}

      {!existing && !pending && (
        <EmptyState
          title="Why four dimensions?"
          description="A promotion reached by burning yourself out is not the same promotion. Naming the experience, the impact and the identity up front is what lets the plan protect them."
          actionLabel=""
        />
      )}
    </div>
  );
}

function WholeGoalView({ goal, onReplace }: { goal: ExistingGoal; onReplace: () => void }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle as="h2">{goal.title}</CardTitle>
            <p className="type-small mt-1 text-ink-muted">
              {goal.horizonMonths}-month horizon
              {goal.rawInput ? ` · from “${goal.rawInput}”` : ''}
            </p>
          </div>
          <ProvenanceChip source={goal.source} confidence={goal.confidence} />
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            {DIMENSIONS.map((dim) => {
              const isPriority = goal.mostImportantDimension === dim.key;
              return (
                <div
                  key={dim.key}
                  className={`rounded-[var(--radius-md)] border px-4 py-3.5 ${
                    isPriority ? 'border-primary bg-primary-soft/30' : 'border-line'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="type-label text-primary">{dim.label}</p>
                    {isPriority && <Badge tone="primary">Most important</Badge>}
                  </div>
                  <p className="type-small mt-0.5 text-ink-faint">{dim.question}</p>
                  <p className="type-body mt-2 text-ink">{goal[dim.key]}</p>

                  {!isPriority && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await setDimensionAction(goal.goalId, dim.key);
                        })
                      }
                      className="type-small mt-3 text-primary underline underline-offset-4"
                    >
                      This one matters most
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Button variant="secondary" onClick={onReplace}>
        Replace this goal
      </Button>
    </div>
  );
}
