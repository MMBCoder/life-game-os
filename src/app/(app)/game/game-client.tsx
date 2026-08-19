'use client';

import { useState, useTransition } from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Badge, Callout, EmptyState, ErrorState } from '@/components/ui/feedback';
import { ProgressiveStatus, GAME_STEPS } from '@/components/ui/progressive-status';
import { SacrificeRadar } from '@/components/game/sacrifice-radar';
import { AGENT_LABEL } from '@/schemas/agent';
import type { AdaptationPlan } from '@/schemas/artefacts';
import { adaptAction, commitGameAction, proposeGameAction, setProgressAction } from './actions';
import type { GameProposalView } from './actions';

/**
 * Designing a game shows the whole deliberation: the draft, the council's verdict,
 * the conflicts it raised, and what the plan costs. Presenting only the finished
 * plan would hide exactly the reasoning that makes it trustworthy.
 */
export function DesignGame({ hasGame }: { hasGame: boolean }) {
  const [proposal, setProposal] = useState<GameProposalView | null>(null);
  const [chosenName, setChosenName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function propose() {
    startTransition(async () => {
      setError(null);
      const result = await proposeGameAction();
      if (!result.ok) setError(result.error);
      else {
        setProposal(result.data);
        setChosenName(result.data.draft.name);
      }
    });
  }

  if (pending && !proposal) {
    return <ProgressiveStatus steps={GAME_STEPS} title="Designing your game" />;
  }

  if (proposal) {
    const { draft, decision, conflicts, sacrifice, alternatives } = proposal;
    return (
      <div className="space-y-6">
        {error && <ErrorState message={error} />}

        <Card tone={decision.verdict === 'reject' ? 'risk' : 'primary'}>
          <CardHeader>
            <div>
              <p className="type-label text-ink-faint">The council</p>
              <CardTitle as="h2" className="type-statement mt-1">
                {decision.headline}
              </CardTitle>
            </div>
            <Badge
              tone={
                decision.verdict === 'approve'
                  ? 'protect'
                  : decision.verdict === 'reject'
                    ? 'risk'
                    : 'watch'
              }
            >
              {decision.verdict.replace(/_/g, ' ')}
            </Badge>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="type-body text-ink">{decision.rationale}</p>

            {decision.tradeOffs.length > 0 && (
              <div>
                <p className="type-label text-ink-faint">Trade-offs accepted</p>
                <ul className="mt-1.5 space-y-1">
                  {decision.tradeOffs.map((t) => (
                    <li key={t} className="type-small text-ink-muted">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>

        {conflicts.length > 0 && (
          <Card tone="watch">
            <CardHeader>
              <div>
                <CardTitle as="h3">Where the council disagreed</CardTitle>
                <p className="type-small mt-1 text-ink-muted">
                  These were resolved before you saw the plan.
                </p>
              </div>
            </CardHeader>
            <CardBody>
              <ul className="space-y-4">
                {conflicts.map((conflict, i) => (
                  <li key={`${conflict.kind}-${i}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="type-label text-ink">
                        {AGENT_LABEL[conflict.raisedBy]}
                        {conflict.against ? ` vs ${AGENT_LABEL[conflict.against]}` : ''}
                      </span>
                      <Badge tone={conflict.severity === 'critical' ? 'risk' : 'watch'}>
                        {conflict.severity}
                      </Badge>
                    </div>
                    <p className="type-small mt-1 text-ink">{conflict.claim}</p>
                    <p className="type-small mt-1 text-ink-muted">→ {conflict.resolution}</p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}

        <SacrificeRadar
          rows={sacrifice.scores.map((s) => ({
            domainKey: s.domainKey,
            label: s.domainKey.replace(/_/g, ' '),
            delta: s.delta,
            why: s.why,
          }))}
          verdict={sacrifice.verdict}
          warning={sacrifice.warning}
          alternatives={alternatives}
        />

        <Card>
          <CardHeader>
            <div>
              <CardTitle as="h2">{chosenName ?? draft.name}</CardTitle>
              <p className="type-small mt-1 text-ink-muted">{draft.purpose}</p>
            </div>
          </CardHeader>
          <CardBody className="space-y-5">
            <div>
              <p className="type-label text-ink-faint">Pick a name</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {draft.nameOptions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setChosenName(name)}
                    className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${
                      chosenName === name
                        ? 'border-primary bg-primary text-primary-ink'
                        : 'border-line-strong text-ink-muted hover:border-ink-faint hover:text-ink'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Panel label="Winning means" body={draft.winningDefinition} />
              <Panel label="Winning does not require" body={draft.nonWinningDefinition} />
            </div>

            <div>
              <p className="type-label text-ink-faint">Three bold results</p>
              <ol className="mt-2 space-y-2">
                {draft.boldResults.map((b) => (
                  <li key={b.dayMarker} className="rounded-[var(--radius-md)] border border-line px-4 py-3">
                    <p className="type-label text-primary">Day {b.dayMarker}</p>
                    <p className="type-body mt-1 font-medium text-ink">{b.title}</p>
                    <p className="type-small mt-1 text-ink-muted">{b.successDefinition}</p>
                  </li>
                ))}
              </ol>
            </div>

            <Callout tone="primary" title="Why this plan?">
              {draft.whyThisPlan}
            </Callout>

            <div>
              <p className="type-label text-ink-faint">What we are not doing</p>
              <ul className="mt-1.5 space-y-1">
                {draft.intentionalOmissions.map((o) => (
                  <li key={o} className="type-small text-ink-muted">
                    {o}
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
                const result = await commitGameAction(draft, chosenName ?? draft.name);
                if (!result.ok) setError(result.error);
                else setProposal(null);
              })
            }
          >
            Commit to this game
          </Button>
          <Button variant="secondary" disabled={pending} onClick={propose}>
            Design a different one
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setProposal(null)}>
            Not now
          </Button>
        </div>
      </div>
    );
  }

  if (!hasGame) {
    return (
      <div className="space-y-4">
        {error && <ErrorState message={error} />}
        <EmptyState
          title="You haven’t created your Game yet"
          description="Tell us what you want to change and we’ll design it — three bold results, the leverage to reach them, and the things we will refuse to spend."
          actionLabel="Design my game"
          onAction={propose}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <ErrorState message={error} />}
      <Button variant="secondary" onClick={propose}>
        Design a new game
      </Button>
      <p className="type-small text-ink-faint">
        Your current game is archived rather than deleted, so the monthly review can still compare
        against it.
      </p>
    </div>
  );
}

function Panel({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-line px-4 py-3.5">
      <p className="type-label text-primary">{label}</p>
      <p className="type-body mt-1.5 text-ink">{body}</p>
    </div>
  );
}

export function ProgressControl({
  boldResultId,
  progress,
}: {
  boldResultId: string;
  progress: number;
}) {
  const [value, setValue] = useState(Math.round(progress * 100));
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={`progress-${boldResultId}`} className="sr-only">
        Progress
      </label>
      <input
        id={`progress-${boldResultId}`}
        type="range"
        min={0}
        max={100}
        step={10}
        value={value}
        disabled={pending}
        onChange={(e) => setValue(Number(e.target.value))}
        onMouseUp={() =>
          startTransition(async () => void (await setProgressAction(boldResultId, value / 100)))
        }
        onTouchEnd={() =>
          startTransition(async () => void (await setProgressAction(boldResultId, value / 100)))
        }
        onKeyUp={() =>
          startTransition(async () => void (await setProgressAction(boldResultId, value / 100)))
        }
        className="accent-[var(--primary)]"
      />
      <span data-numeric className="type-small w-9 text-right text-ink-muted">
        {value}%
      </span>
    </div>
  );
}

/**
 * The adaptive engine's entry point. A plan built for a situation that has changed
 * quietly becomes a plan for nothing, so this is deliberately prominent.
 */
export function AdaptPanel() {
  const [change, setChange] = useState('');
  const [plan, setPlan] = useState<AdaptationPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (pending) {
    return (
      <ProgressiveStatus
        steps={[
          'Reading what changed',
          'Checking the goal still holds',
          'Re-testing the leverage assumptions',
          'Reworking the milestones',
        ]}
        title="Recalibrating"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle as="h3">Something changed?</CardTitle>
          <p className="type-small mt-1 text-ink-muted">
            New job, new constraint, new situation. Tell us and we will check whether this plan
            still fits the life you are actually in.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {error && <ErrorState message={error} />}

        {plan ? (
          <div className="space-y-4">
            <div>
              <Badge tone={plan.recommendation === 'recalibrate' ? 'watch' : 'primary'}>
                {plan.recommendation}
              </Badge>
              <p className="type-h3 mt-2 text-ink">{plan.headline}</p>
              <p className="type-body mt-2 text-ink-muted">{plan.reasoning}</p>
            </div>
            <ul className="space-y-3">
              {plan.changes.map((c) => (
                <li key={c.change} className="rounded-[var(--radius-md)] border border-line px-4 py-3">
                  <p className="type-label text-primary">{c.area}</p>
                  <p className="type-body mt-1 text-ink">{c.change}</p>
                  <p className="type-small mt-0.5 text-ink-muted">{c.why}</p>
                </li>
              ))}
            </ul>
            <Button
              variant="ghost"
              onClick={() => {
                setPlan(null);
                setChange('');
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <>
            <Textarea
              label="What changed?"
              value={change}
              onChange={(e) => setChange(e.target.value)}
              rows={3}
              placeholder="I've moved to a new team and I no longer own the project this plan was built around."
            />
            <Button
              variant="secondary"
              disabled={change.trim().length < 10}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await adaptAction(change);
                  if (!result.ok) setError(result.error);
                  else setPlan(result.data);
                })
              }
            >
              Check the plan
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  );
}
