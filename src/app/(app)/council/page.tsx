import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth/session';
import * as council from '@/lib/db/repositories/council';
import { AGENT_LABEL, type AgentId } from '@/schemas/agent';
import { Card, CardBody, CardHeader, CardTitle, SectionLabel } from '@/components/ui/card';
import { Badge, EmptyState } from '@/components/ui/feedback';
import { WhyDisclosure } from '@/components/ui/dialog';
import { CouncilGraph } from '@/components/council/council-graph';

export const metadata: Metadata = { title: 'Council Room' };

export default async function CouncilPage() {
  const user = await requireSession();
  const latest = await council.latestCouncilRun(user.id);

  if (!latest) {
    return (
      <div className="space-y-8">
        <header>
          <p className="type-label text-ink-faint">Council room</p>
          <h1 className="type-statement mt-2 text-ink">Thirteen specialists. One decision.</h1>
        </header>
        <EmptyState
          title="The council has not convened yet"
          description="Design a game or ask your Player a real decision, and you will see the whole argument here — including who objected and why."
          actionLabel="Design my game"
          actionHref="/game"
        />
      </div>
    );
  }

  const [detail, recentRuns] = await Promise.all([
    council.getCouncilRun(user.id, latest.id),
    council.listCouncilRuns(user.id, 8),
  ]);

  if (!detail) return null;

  const outputByRun = new Map(detail.outputs.map((o) => [o.agentRunId, o]));

  return (
    <div className="space-y-8">
      <header>
        <p className="type-label text-ink-faint">Council room</p>
        <h1 className="type-statement mt-2 text-ink">
          {detail.decision?.headline ?? 'The council’s latest session'}
        </h1>
        <p className="type-small mt-2 text-ink-faint">
          {detail.run.purpose.replace(/_/g, ' ')} · {detail.run.agentCount} agents ·{' '}
          {detail.run.latencyMs ? `${(detail.run.latencyMs / 1000).toFixed(1)}s` : '—'}
        </p>
      </header>

      {/* ── The graph ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Who was consulted</CardTitle>
            <p className="type-small mt-1 text-ink-muted">
              Analysis runs in parallel. Guardians can veto. Red Team attacks whatever survives.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <CouncilGraph
            nodes={detail.agentRuns.map((run) => ({
              agent: run.agent,
              status: run.status === 'succeeded' ? 'succeeded' : 'failed',
              confidence: run.confidence,
              summary: outputByRun.get(run.id)?.summary,
            }))}
          />
        </CardBody>
      </Card>

      {/* ── The decision ──────────────────────────────────────────────── */}
      {detail.decision && (
        <Card tone="primary">
          <CardHeader>
            <div>
              <p className="type-label text-ink-faint">Final decision</p>
              <CardTitle as="h2" className="type-statement mt-1">
                {detail.decision.headline}
              </CardTitle>
            </div>
            <Badge
              tone={
                detail.decision.verdict === 'approve'
                  ? 'protect'
                  : detail.decision.verdict === 'reject'
                    ? 'risk'
                    : 'watch'
              }
            >
              {detail.decision.verdict.replace(/_/g, ' ')}
            </Badge>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="type-body text-ink">{detail.decision.rationale}</p>

            {detail.decision.tradeOffs.length > 0 && (
              <div>
                <p className="type-label text-ink-faint">Trade-offs</p>
                <ul className="mt-1.5 space-y-1">
                  {detail.decision.tradeOffs.map((t) => (
                    <li key={t} className="type-small text-ink-muted">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.decision.omissions.length > 0 && (
              <div>
                <p className="type-label text-ink-faint">What we deliberately did not do</p>
                <ul className="mt-1.5 space-y-1">
                  {detail.decision.omissions.map((o) => (
                    <li key={o} className="type-small text-ink-muted">
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="type-small text-ink-faint">
              Confidence {Math.round(detail.decision.confidence * 100)}%
            </p>
          </CardBody>
        </Card>
      )}

      {/* ── Conflicts ─────────────────────────────────────────────────── */}
      {detail.conflicts.length > 0 && (
        <section>
          <SectionLabel>Where they disagreed</SectionLabel>
          <p className="type-small mt-1 mb-3 text-ink-muted">
            Disagreement is the point. These were resolved under a fixed precedence: a firm
            non-negotiable beats a guardian veto, which beats capacity, which beats strategy.
          </p>
          <ul className="space-y-3">
            {detail.conflicts.map((conflict) => (
              <li key={conflict.id}>
                <Card tone={conflict.severity === 'critical' ? 'risk' : 'watch'}>
                  <CardBody className="pt-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="type-label text-ink">
                        {AGENT_LABEL[conflict.raisedBy]}
                        {conflict.against ? ` vs ${AGENT_LABEL[conflict.against]}` : ''}
                      </span>
                      <Badge tone={conflict.severity === 'critical' ? 'risk' : 'watch'}>
                        {conflict.severity}
                      </Badge>
                      <Badge tone="neutral">{conflict.kind.replace(/_/g, ' ')}</Badge>
                    </div>
                    <p className="type-body mt-2 text-ink">{conflict.claim}</p>
                    <p className="type-small mt-2 text-ink-muted">
                      <strong className="text-ink">Resolution:</strong> {conflict.resolution}
                      {conflict.resolvedInFavourOf &&
                        ` (in favour of ${AGENT_LABEL[conflict.resolvedInFavourOf]})`}
                    </p>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Each agent ────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>What each agent said</SectionLabel>
        <ul className="mt-3 space-y-3">
          {detail.agentRuns.map((run) => {
            const output = outputByRun.get(run.id);
            return (
              <li key={run.id}>
                <Card>
                  <CardHeader>
                    <div className="min-w-0">
                      <CardTitle as="h3">{AGENT_LABEL[run.agent as AgentId]}</CardTitle>
                      {output && (
                        <p className="type-body mt-1.5 text-ink">{output.summary}</p>
                      )}
                    </div>
                    {run.status === 'failed' ? (
                      <Badge tone="neutral">unavailable</Badge>
                    ) : (
                      run.confidence !== null && (
                        <Badge tone="neutral">{Math.round(run.confidence * 100)}%</Badge>
                      )
                    )}
                  </CardHeader>
                  {output && (
                    <CardBody className="space-y-3">
                      {output.reasoning.length > 0 && (
                        <WhyDisclosure label="Why?">
                          <ul className="list-inside list-disc space-y-1">
                            {output.reasoning.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        </WhyDisclosure>
                      )}
                      {output.evidence.length > 0 && (
                        <WhyDisclosure label="What it used">
                          <ul className="space-y-1">
                            {output.evidence.map((e, i) => (
                              <li key={`${e.ref}-${i}`}>
                                <span className="type-label mr-2 text-ink-faint">{e.kind}</span>
                                {e.ref}
                                {e.note ? ` — ${e.note}` : ''}
                              </li>
                            ))}
                          </ul>
                        </WhyDisclosure>
                      )}
                    </CardBody>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── History ───────────────────────────────────────────────────── */}
      {recentRuns.length > 1 && (
        <section>
          <SectionLabel>Recent sessions</SectionLabel>
          <ul className="mt-3 space-y-2">
            {recentRuns.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line px-4 py-3"
              >
                <span className="type-small text-ink capitalize">
                  {run.purpose.replace(/_/g, ' ')}
                </span>
                <span className="type-small flex items-center gap-3 text-ink-faint">
                  <span>{run.agentCount} agents</span>
                  {run.latencyMs && <span data-numeric>{(run.latencyMs / 1000).toFixed(1)}s</span>}
                  <Badge tone={run.status === 'succeeded' ? 'protect' : 'watch'}>
                    {run.status}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
