'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { ChipSelect } from '@/components/ui/suggestions';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, Callout, ErrorState } from '@/components/ui/feedback';
import { ProgressiveStatus, ONBOARDING_STEPS } from '@/components/ui/progressive-status';
import { ProvenanceChip } from '@/components/ui/provenance';
import { MATTERS_SUGGESTIONS, PROTECT_SUGGESTIONS } from '@/lib/copy';
import { confirmSnapshotAction, submitDiscoveryAction } from './actions';
import type { PersonalSnapshot } from '@/schemas/artefacts';

type Stage = 'q1' | 'q2' | 'q3' | 'thinking' | 'snapshot';

/**
 * Three questions, then a snapshot the person corrects.
 *
 * Deliberately not a form: each question is a screen with model-suggested options,
 * and the product's inference is shown back for confirmation rather than assumed.
 */
export function DiscoverFlow({ name }: { name: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('q1');
  const [matters, setMatters] = useState<string[]>([]);
  const [twelveMonths, setTwelveMonths] = useState('');
  const [notSacrificed, setNotSacrificed] = useState<string[]>([]);
  const [snapshot, setSnapshot] = useState<PersonalSnapshot | null>(null);
  const [correction, setCorrection] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function submit() {
    setError(null);
    setStage('thinking');
    startTransition(async () => {
      const result = await submitDiscoveryAction({ matters, twelveMonths, notSacrificed });
      if (!result.ok) {
        setError(result.error);
        setStage('q3');
        return;
      }
      setSnapshot(result.data);
      setStage('snapshot');
    });
  }

  function finish(verdict: 'close' | 'partly' | 'off') {
    startTransition(async () => {
      await confirmSnapshotAction(verdict, correction || undefined);
      router.push('/dashboard');
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Progress stage={stage} />

      {stage === 'q1' && (
        <Question
          eyebrow={`Let’s build your game, ${name}.`}
          title="What feels most important in your life right now?"
          hint="Pick up to four. There is no wrong answer, and you can change these later."
        >
          <ChipSelect
            options={MATTERS_SUGGESTIONS}
            selected={matters}
            onToggle={(v) => toggle(matters, setMatters, v)}
            max={4}
          />
          <div className="mt-8 flex justify-end">
            <Button size="lg" disabled={matters.length === 0} onClick={() => setStage('q2')}>
              Continue
            </Button>
          </div>
        </Question>
      )}

      {stage === 'q2' && (
        <Question
          eyebrow="Question 2 of 3"
          title="If the next 12 months went really well, what would be different?"
          hint="A sentence or two is plenty. Say it however it comes out — we will do the structuring."
        >
          <Textarea
            label="In your own words"
            value={twelveMonths}
            onChange={(e) => setTwelveMonths(e.target.value)}
            rows={5}
            placeholder="I'd be leading a team rather than just delivering, and I wouldn't be working every evening to do it."
            autoFocus
          />
          <div className="mt-8 flex justify-between">
            <Button variant="ghost" onClick={() => setStage('q1')}>
              Back
            </Button>
            <Button
              size="lg"
              disabled={twelveMonths.trim().length < 10}
              onClick={() => setStage('q3')}
            >
              Continue
            </Button>
          </div>
        </Question>
      )}

      {stage === 'q3' && (
        <Question
          eyebrow="Question 3 of 3"
          title="What must NOT be sacrificed while you pursue that?"
          hint="This is the most important question here. It becomes a constraint on every plan we build — not a nice-to-have."
        >
          <ChipSelect
            options={PROTECT_SUGGESTIONS}
            selected={notSacrificed}
            onToggle={(v) => toggle(notSacrificed, setNotSacrificed, v)}
            max={5}
          />
          {error && (
            <div className="mt-5">
              <ErrorState message={error} />
            </div>
          )}
          <div className="mt-8 flex justify-between">
            <Button variant="ghost" onClick={() => setStage('q2')}>
              Back
            </Button>
            <Button size="lg" disabled={notSacrificed.length === 0} onClick={submit}>
              Build my snapshot
            </Button>
          </div>
        </Question>
      )}

      {stage === 'thinking' && (
        <div className="pt-6">
          <ProgressiveStatus steps={ONBOARDING_STEPS} title="Building your snapshot" />
        </div>
      )}

      {stage === 'snapshot' && snapshot && (
        <SnapshotView
          snapshot={snapshot}
          correction={correction}
          onCorrectionChange={setCorrection}
          onFinish={finish}
          pending={pending}
        />
      )}
    </div>
  );
}

function Progress({ stage }: { stage: Stage }) {
  const index = { q1: 0, q2: 1, q3: 2, thinking: 3, snapshot: 3 }[stage];
  return (
    <ol className="mb-10 flex gap-1.5" aria-label="Discovery progress">
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className={`h-1 flex-1 rounded-full ${i <= index ? 'bg-primary' : 'bg-bg-subtle'}`}
          aria-current={i === index ? 'step' : undefined}
        />
      ))}
    </ol>
  );
}

function Question({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow: string;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-rise">
      <p className="type-label text-primary">{eyebrow}</p>
      <h1 className="type-statement mt-3 text-ink">{title}</h1>
      <p className="type-body mt-3 text-ink-muted">{hint}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function SnapshotView({
  snapshot,
  correction,
  onCorrectionChange,
  onFinish,
  pending,
}: {
  snapshot: PersonalSnapshot;
  correction: string;
  onCorrectionChange: (v: string) => void;
  onFinish: (verdict: 'close' | 'partly' | 'off') => void;
  pending: boolean;
}) {
  return (
    <div className="animate-rise space-y-6">
      <div>
        <p className="type-label text-primary">Your personal snapshot</p>
        <h1 className="type-statement mt-3 text-ink">{snapshot.headline}</h1>
        <p className="type-small mt-3 text-ink-muted">
          Everything below is our reading of what you said, not a conclusion. Correct anything that
          is off — your version always wins.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Likely priorities</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="space-y-3">
            {snapshot.likelyPriorities.map((p) => (
              <li key={p.domainKey} className="flex items-start justify-between gap-4">
                <div>
                  <p className="type-body font-medium text-ink capitalize">
                    {p.domainKey.replace(/_/g, ' ')}
                  </p>
                  <p className="type-small mt-0.5 text-ink-muted">{p.why}</p>
                </div>
                <ProvenanceChip source="ai_inferred" confidence={p.confidence} />
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Likely goal</CardTitle>
          </div>
          <ProvenanceChip source="ai_inferred" confidence={snapshot.likelyGoal.confidence} />
        </CardHeader>
        <CardBody>
          <p className="type-h3 text-ink">{snapshot.likelyGoal.title}</p>
          <p className="type-small mt-2 text-ink-muted">{snapshot.likelyGoal.why}</p>
          <Badge tone="neutral" className="mt-3">
            {snapshot.likelyGoal.horizonMonths} months
          </Badge>
        </CardBody>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card tone="watch">
          <CardHeader>
            <CardTitle>Possible tension</CardTitle>
            <ProvenanceChip
              source="ai_inferred"
              confidence={snapshot.possibleTension.confidence}
            />
          </CardHeader>
          <CardBody>
            <p className="type-body text-ink">{snapshot.possibleTension.statement}</p>
          </CardBody>
        </Card>

        <Card tone="primary">
          <CardHeader>
            <CardTitle>Possible opportunity</CardTitle>
            <ProvenanceChip
              source="ai_inferred"
              confidence={snapshot.possibleOpportunity.confidence}
            />
          </CardHeader>
          <CardBody>
            <p className="type-body text-ink">{snapshot.possibleOpportunity.statement}</p>
          </CardBody>
        </Card>
      </div>

      {snapshot.likelyConstraints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Likely constraints</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2">
              {snapshot.likelyConstraints.map((c) => (
                <li key={c.label} className="flex items-center justify-between gap-3">
                  <span className="type-body text-ink">{c.label}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone={c.severity === 'high' || c.severity === 'critical' ? 'watch' : 'neutral'}>
                      {c.category}
                    </Badge>
                    <ProvenanceChip source="ai_inferred" confidence={c.confidence} />
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card tone="protect">
        <CardHeader>
          <div>
            <CardTitle>What we will protect</CardTitle>
            <p className="type-small mt-1 text-ink-muted">
              These become hard constraints on every plan we build.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <ul className="space-y-2">
            {snapshot.nonNegotiables.map((n) => (
              <li key={n.label} className="flex items-center justify-between gap-3">
                <span className="type-body text-ink">{n.label}</span>
                <Badge tone={n.hardness === 'firm' ? 'protect' : 'neutral'}>{n.hardness}</Badge>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Callout tone="primary" title="Identity shift we think is underway">
        From <strong>{snapshot.identityShift.from}</strong> toward{' '}
        <strong>{snapshot.identityShift.to}</strong>.
      </Callout>

      <Card>
        <CardHeader>
          <CardTitle>How close did we get?</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <Textarea
            label="Anything we got wrong? (optional)"
            value={correction}
            onChange={(e) => onCorrectionChange(e.target.value)}
            rows={3}
            placeholder="The career part is right but it's less about the title than you think."
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onFinish('close')} loading={pending}>
              That’s close
            </Button>
            <Button variant="secondary" onClick={() => onFinish('partly')} disabled={pending}>
              Partly right
            </Button>
            <Button variant="ghost" onClick={() => onFinish('off')} disabled={pending}>
              Not really
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
