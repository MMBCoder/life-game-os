'use client';

import { useState, useTransition } from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { ChipSelect } from '@/components/ui/suggestions';
import { Badge, Callout, ErrorState } from '@/components/ui/feedback';
import { ProgressiveStatus } from '@/components/ui/progressive-status';
import { RESET_CAUSES } from '@/lib/copy';
import type { MonthlyReview, ResetOptions, WeeklyIntelligence } from '@/schemas/artefacts';
import { monthlyReviewAction, resetAction, weeklyReviewAction } from './actions';

type Tab = 'weekly' | 'monthly' | 'reset';

export function ReflectionClient({
  suggestions,
  weeklyDone,
  weekLabel,
}: {
  suggestions: string[];
  weeklyDone: boolean;
  weekLabel: string;
}) {
  const [tab, setTab] = useState<Tab>('weekly');

  return (
    <div>
      <div
        role="tablist"
        aria-label="Reflection type"
        className="inline-flex overflow-hidden rounded-[var(--radius-md)] border border-line-strong"
      >
        {(
          [
            ['weekly', 'Weekly'],
            ['monthly', 'Monthly'],
            ['reset', 'Reset'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`border-line-strong px-4 py-2.5 text-sm transition-colors not-last:border-r ${
              tab === key
                ? 'bg-primary text-primary-ink'
                : 'text-ink-muted hover:bg-bg-subtle hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'weekly' && (
          <WeeklyReview suggestions={suggestions} done={weeklyDone} weekLabel={weekLabel} />
        )}
        {tab === 'monthly' && <MonthlyReviewPanel />}
        {tab === 'reset' && <ResetPanel />}
      </div>
    </div>
  );
}

function WeeklyReview({
  suggestions,
  done,
  weekLabel,
}: {
  suggestions: string[];
  done: boolean;
  weekLabel: string;
}) {
  const [moved, setMoved] = useState<string[]>([]);
  const [didntMove, setDidntMove] = useState<string[]>([]);
  const [surprises, setSurprises] = useState('');
  const [feeling, setFeeling] = useState('');
  const [cost, setCost] = useState('');
  const [energy, setEnergy] = useState('');
  const [change, setChange] = useState('');
  const [intelligence, setIntelligence] = useState<WeeklyIntelligence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  if (pending) {
    return (
      <ProgressiveStatus
        steps={[
          'Reading what moved',
          'Comparing against the plan',
          'Looking for a pattern',
          'Checking capacity',
          'Choosing next week’s three moves',
        ]}
        title="Analysing your week"
      />
    );
  }

  if (intelligence) {
    return (
      <div className="space-y-5">
        <Card tone="primary">
          <CardHeader>
            <CardTitle as="h2">Weekly intelligence</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            <Section label="Progress" body={intelligence.progress} />

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="type-label text-ink-faint">Pattern</p>
                <Badge tone="neutral">
                  hypothesis · {Math.round(intelligence.pattern.confidence * 100)}%
                </Badge>
              </div>
              <p className="type-body mt-1.5 text-ink">{intelligence.pattern.statement}</p>
            </div>

            <Section label="Risk" body={intelligence.risk} />
            <Section label="Insight" body={intelligence.insight} />

            <div className="rounded-[var(--radius-md)] bg-bg-subtle px-4 py-3.5">
              <p className="type-label text-ink-faint">Recommended adjustment</p>
              <p className="type-body mt-1 font-medium text-ink">
                {intelligence.recommendedAdjustment.title}
              </p>
              <p className="type-small mt-1 text-ink-muted">
                {intelligence.recommendedAdjustment.detail}
              </p>
              {intelligence.recommendedAdjustment.leverage && (
                <Badge tone="primary" className="mt-2">
                  {intelligence.recommendedAdjustment.leverage}
                </Badge>
              )}
            </div>

            <div>
              <p className="type-label text-ink-faint">Next week’s three moves</p>
              <ol className="mt-1.5 space-y-1.5">
                {intelligence.nextThreeMoves.map((move, i) => (
                  <li key={move} className="type-body flex gap-2.5 text-ink">
                    <span data-numeric className="text-primary">
                      {i + 1}.
                    </span>
                    {move}
                  </li>
                ))}
              </ol>
            </div>
          </CardBody>
        </Card>

        <Button variant="ghost" onClick={() => setIntelligence(null)}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle as="h2">This week</CardTitle>
          <p className="type-small mt-1 text-ink-faint">{weekLabel}</p>
        </div>
        {done && <Badge tone="protect">Already reviewed</Badge>}
      </CardHeader>
      <CardBody className="space-y-6">
        {error && <ErrorState message={error} />}

        <div>
          <p className="type-label mb-2 text-ink-muted">What moved?</p>
          {suggestions.length > 0 ? (
            <ChipSelect
              options={suggestions}
              selected={moved}
              onToggle={(v) => toggle(moved, setMoved, v)}
            />
          ) : (
            <Input
              label="What moved"
              value={moved[0] ?? ''}
              onChange={(e) => setMoved(e.target.value ? [e.target.value] : [])}
            />
          )}
        </div>

        <div>
          <p className="type-label mb-2 text-ink-muted">What didn’t?</p>
          {suggestions.length > 0 ? (
            <ChipSelect
              options={suggestions}
              selected={didntMove}
              onToggle={(v) => toggle(didntMove, setDidntMove, v)}
            />
          ) : (
            <Input
              label="What didn't move"
              value={didntMove[0] ?? ''}
              onChange={(e) => setDidntMove(e.target.value ? [e.target.value] : [])}
            />
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="What surprised you? (optional)"
            value={surprises}
            onChange={(e) => setSurprises(e.target.value)}
          />
          <Input
            label="How did you feel? (optional)"
            value={feeling}
            onChange={(e) => setFeeling(e.target.value)}
            placeholder="Stretched but clear"
          />
          <Input
            label="What cost more than expected? (optional)"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
          <Input
            label="What gave you energy? (optional)"
            value={energy}
            onChange={(e) => setEnergy(e.target.value)}
          />
        </div>

        <Textarea
          label="What should change? (optional)"
          value={change}
          onChange={(e) => setChange(e.target.value)}
          rows={2}
        />

        <Button
          size="lg"
          disabled={moved.length === 0 && didntMove.length === 0}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await weeklyReviewAction({
                moved,
                didntMove,
                surprises,
                feeling,
                costMoreThanExpected: cost,
                gaveEnergy: energy,
                shouldChange: change,
              });
              if (!result.ok) setError(result.error);
              else setIntelligence(result.data);
            })
          }
        >
          Analyse my week
        </Button>
      </CardBody>
    </Card>
  );
}

function MonthlyReviewPanel() {
  const [review, setReview] = useState<MonthlyReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (pending) {
    return (
      <ProgressiveStatus
        steps={[
          'Comparing your life map to last month',
          'Reviewing goal progress',
          'Consulting the guardians',
          'Asking whether this is still the right game',
        ]}
        title="Running your monthly review"
      />
    );
  }

  if (review) {
    const verdictTone =
      review.stillTheRightGame.verdict === 'continue'
        ? 'protect'
        : review.stillTheRightGame.verdict === 'change_game'
          ? 'risk'
          : 'watch';

    return (
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Where you are now</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="type-body text-ink">{review.comparison}</p>
            {review.domainMovement.length > 0 && (
              <ul className="space-y-2">
                {review.domainMovement.map((d) => (
                  <li key={d.domainKey} className="flex items-baseline justify-between gap-3">
                    <span className="type-small text-ink capitalize">
                      {d.domainKey.replace(/_/g, ' ')}
                    </span>
                    <span className="type-small text-right text-ink-muted">
                      <Badge
                        tone={d.direction === 'up' ? 'protect' : d.direction === 'down' ? 'risk' : 'neutral'}
                        className="mr-2"
                      >
                        {d.direction}
                      </Badge>
                      {d.note}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card tone={verdictTone === 'risk' ? 'risk' : verdictTone === 'watch' ? 'watch' : 'protect'}>
          <CardHeader>
            <CardTitle as="h2">Is this still the right game?</CardTitle>
            <Badge tone={verdictTone}>
              {review.stillTheRightGame.verdict.replace(/_/g, ' ')}
            </Badge>
          </CardHeader>
          <CardBody>
            <p className="type-body text-ink">{review.stillTheRightGame.reasoning}</p>
          </CardBody>
        </Card>

        {review.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle as="h2">Recommended</CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="space-y-3">
                {review.recommendations.map((r) => (
                  <li key={r.title}>
                    <p className="type-body font-medium text-ink">{r.title}</p>
                    <p className="type-small mt-0.5 text-ink-muted">{r.detail}</p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}

        <Button variant="ghost" onClick={() => setReview(null)}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle as="h2">Monthly review</CardTitle>
          <p className="type-small mt-1 text-ink-muted">
            No questions. We compare where you started with where you are, and ask the one question
            that stops people pursuing an outdated goal.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {error && <ErrorState message={error} />}
        <Button
          size="lg"
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await monthlyReviewAction();
              if (!result.ok) setError(result.error);
              else setReview(result.data);
            })
          }
        >
          Run my monthly review
        </Button>
      </CardBody>
    </Card>
  );
}

function ResetPanel() {
  const [cause, setCause] = useState<string[]>([]);
  const [detail, setDetail] = useState('');
  const [options, setOptions] = useState<ResetOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (options) {
    return (
      <div className="space-y-5">
        <Callout tone="primary">{options.acknowledgement}</Callout>
        <ul className="space-y-3">
          {options.options.map((option, i) => (
            <li key={option.title}>
              <Card>
                <CardBody className="pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="type-h3 text-ink">
                      <span data-numeric className="mr-2 text-primary">
                        {i + 1}.
                      </span>
                      {option.title}
                    </p>
                    <Badge tone="neutral">{option.effort} effort</Badge>
                  </div>
                  <p className="type-body mt-2 text-ink-muted">{option.detail}</p>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          onClick={() => {
            setOptions(null);
            setCause([]);
            setDetail('');
          }}
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle as="h2">Reset your game</CardTitle>
          <p className="type-small mt-1 text-ink-muted">
            Not a failure — information. Something got in the way, and the plan should absorb it.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        {error && <ErrorState message={error} />}

        <div>
          <p className="type-label mb-2 text-ink-muted">What happened?</p>
          <ChipSelect
            options={RESET_CAUSES}
            selected={cause}
            onToggle={(v) => setCause(cause.includes(v) ? [] : [v])}
            max={1}
          />
        </div>

        <Textarea
          label="Anything else? (optional)"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={2}
        />

        <Button
          disabled={cause.length === 0 && detail.trim().length < 3}
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const text = [cause[0], detail].filter(Boolean).join(' — ');
              const result = await resetAction(text);
              if (!result.ok) setError(result.error);
              else setOptions(result.data);
            })
          }
        >
          Help me reset
        </Button>
      </CardBody>
    </Card>
  );
}

function Section({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="type-label text-ink-faint">{label}</p>
      <p className="type-body mt-1 text-ink">{body}</p>
    </div>
  );
}
