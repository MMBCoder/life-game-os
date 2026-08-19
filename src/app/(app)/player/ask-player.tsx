'use client';

import { useState, useTransition } from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Badge, Callout, ErrorState } from '@/components/ui/feedback';
import { ProgressiveStatus, COUNCIL_STEPS } from '@/components/ui/progressive-status';
import type { PlayerDecision } from '@/schemas/artefacts';
import { askPlayerAction, recordOutcomeAction } from './actions';

const VERDICT_TONE: Record<PlayerDecision['verdict'], 'protect' | 'risk' | 'watch' | 'neutral'> = {
  take: 'protect',
  decline: 'risk',
  delegate: 'watch',
  defer: 'neutral',
  renegotiate: 'watch',
};

export function AskPlayer({ playerName }: { playerName: string }) {
  const [question, setQuestion] = useState('');
  const [detail, setDetail] = useState('');
  const [result, setResult] = useState<{ verdict: PlayerDecision; decisionId: string } | null>(
    null,
  );
  const [outcome, setOutcome] = useState('');
  const [outcomeSaved, setOutcomeSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (pending) {
    return <ProgressiveStatus steps={COUNCIL_STEPS} />;
  }

  if (result) {
    const { verdict } = result;
    return (
      <div className="space-y-5">
        <Card tone={verdict.verdict === 'decline' ? 'risk' : 'default'}>
          <CardHeader>
            <div>
              <p className="type-label text-ink-faint">{playerName} says</p>
              <CardTitle as="h3" className="type-statement mt-1">
                {verdict.headline}
              </CardTitle>
            </div>
            <Badge tone={VERDICT_TONE[verdict.verdict]}>{verdict.verdict}</Badge>
          </CardHeader>
          <CardBody className="space-y-5">
            <p className="type-body text-ink">{verdict.reasoning}</p>

            {verdict.conflictsWith.length > 0 && (
              <div>
                <p className="type-label text-ink-faint">It conflicts with</p>
                <ul className="mt-1.5 space-y-1">
                  {verdict.conflictsWith.map((c) => (
                    <li key={c} className="type-small flex gap-2 text-ink">
                      <span aria-hidden="true" className="text-risk">
                        ·
                      </span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {verdict.supports.length > 0 && (
              <div>
                <p className="type-label text-ink-faint">It supports</p>
                <ul className="mt-1.5 space-y-1">
                  {verdict.supports.map((s) => (
                    <li key={s} className="type-small flex gap-2 text-ink">
                      <span aria-hidden="true" className="text-protect">
                        ·
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Callout tone="primary" title="Better move">
              {verdict.betterMove}
            </Callout>

            <div>
              <p className="type-label text-ink-faint">Opportunity cost</p>
              <p className="type-small mt-1 text-ink-muted">{verdict.opportunityCost}</p>
            </div>
          </CardBody>
        </Card>

        {/* Closing the loop makes patterns in decisions visible to the Reflection Agent. */}
        <Card>
          <CardHeader>
            <CardTitle as="h3">What did you actually do?</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {outcomeSaved ? (
              <p className="type-small text-ink-muted">Recorded. This feeds your weekly review.</p>
            ) : (
              <>
                <Input
                  label="Optional"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="Declined it, offered an intro instead."
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={outcome.trim().length < 3}
                  onClick={() =>
                    startTransition(async () => {
                      await recordOutcomeAction(result.decisionId, outcome);
                      setOutcomeSaved(true);
                    })
                  }
                >
                  Record it
                </Button>
              </>
            )}
          </CardBody>
        </Card>

        <Button
          variant="ghost"
          onClick={() => {
            setResult(null);
            setQuestion('');
            setDetail('');
            setOutcome('');
            setOutcomeSaved(false);
          }}
        >
          Ask about something else
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-4 pt-5">
        {error && <ErrorState message={error} />}
        <Input
          label="What are you deciding?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Should I take on this extra project?"
        />
        <Textarea
          label="Anything else we should know? (optional)"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={3}
          placeholder="It's high visibility but it would run through Q2 and I'd be the only one on it."
        />
        <Button
          disabled={question.trim().length < 8}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const response = await askPlayerAction(question, detail);
              if (!response.ok) setError(response.error);
              else setResult(response.data);
            })
          }
        >
          Ask {playerName}
        </Button>
      </CardBody>
    </Card>
  );
}
