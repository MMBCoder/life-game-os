import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth/session';
import * as council from '@/lib/db/repositories/council';
import { activeDriver } from '@/lib/db';
import { resolveProviderChoice, MODELS, hasPricing } from '@/lib/ai/config';
import { AGENT_LABEL, type AgentId } from '@/schemas/agent';
import { Card, CardBody, CardHeader, CardTitle, SectionLabel } from '@/components/ui/card';
import { Badge, EmptyState, Stat } from '@/components/ui/feedback';

export const metadata: Metadata = { title: 'Observability' };

/**
 * Developer/operator view. A multi-agent product is very hard to debug without one
 * (spec §63): latency, cost, validation retries, conflicts and failures per run.
 *
 * Scoped to the signed-in user's own runs — this is not a cross-tenant admin panel.
 */
export default async function AdminPage() {
  if (process.env.ENABLE_ADMIN === 'false') notFound();

  const user = await requireSession();
  const [runs, agentRuns, conflicts, recommendations] = await Promise.all([
    council.listCouncilRuns(user.id, 25),
    council.listAgentRuns(user.id, 100),
    council.listConflicts(user.id, 25),
    council.listRecommendations(user.id, 20),
  ]);

  const totalCost = runs.reduce((sum, r) => sum + r.estimatedCostUsd, 0);
  const totalTokens = runs.reduce(
    (sum, r) => sum + r.totalInputTokens + r.totalOutputTokens,
    0,
  );
  // A live provider with no rate for its model would otherwise render real spend as
  // $0.00. Say "unpriced" instead and point at the variable that fixes it.
  const unpricedModels = [
    ...new Set(agentRuns.map((r) => r.model).filter((m) => m && !hasPricing(m))),
  ];
  const costUnknown = totalTokens > 0 && totalCost === 0 && unpricedModels.length > 0;

  const failed = agentRuns.filter((r) => r.status === 'failed');
  const repaired = agentRuns.filter((r) => r.validationAttempts > 1);
  const avgLatency =
    runs.length > 0
      ? runs.reduce((sum, r) => sum + (r.latencyMs ?? 0), 0) / runs.length
      : 0;

  const byAgent = new Map<AgentId, { count: number; latency: number; failures: number }>();
  for (const run of agentRuns) {
    const key = run.agent as AgentId;
    const entry = byAgent.get(key) ?? { count: 0, latency: 0, failures: 0 };
    entry.count += 1;
    entry.latency += run.latencyMs ?? 0;
    if (run.status === 'failed') entry.failures += 1;
    byAgent.set(key, entry);
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="type-label text-ink-faint">Observability</p>
        <h1 className="type-statement mt-2 text-ink">Agent runs, cost and failures.</h1>
        <p className="type-body mt-3 max-w-2xl text-ink-muted">
          Your own runs only. Personal content is never logged — this shows shapes, timings and
          outcomes.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody className="pt-5">
            <Stat label="Council runs" value={runs.length} />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="pt-5">
            <Stat
              label="Estimated cost"
              value={costUnknown ? 'Unpriced' : totalCost === 0 ? '$0.00' : `$${totalCost.toFixed(4)}`}
              sub={
                costUnknown
                  ? `${totalTokens.toLocaleString()} tokens · set AI_PRICING_JSON for ${unpricedModels.join(', ')}`
                  : `${totalTokens.toLocaleString()} tokens`
              }
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="pt-5">
            <Stat
              label="Avg council latency"
              value={avgLatency > 0 ? `${(avgLatency / 1000).toFixed(1)}s` : '—'}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="pt-5">
            <Stat
              label="Agent failures"
              value={failed.length}
              sub={`${repaired.length} needed schema repair`}
              tone={failed.length > 0 ? 'watch' : 'protect'}
            />
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Row label="AI provider" value={resolveProviderChoice()} />
            <Row label="Database driver" value={activeDriver()} />
            <Row label="Deep tier" value={MODELS.deep} />
            <Row label="Standard tier" value={MODELS.standard} />
            <Row label="Light tier" value={MODELS.light} />
            <Row label="Node env" value={process.env.NODE_ENV ?? 'unknown'} />
          </dl>
        </CardBody>
      </Card>

      {byAgent.size > 0 && (
        <section>
          <SectionLabel>Per agent</SectionLabel>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="type-label py-2 pr-4 text-left text-ink-faint">
                    Agent
                  </th>
                  <th scope="col" className="type-label py-2 pr-4 text-right text-ink-faint">
                    Runs
                  </th>
                  <th scope="col" className="type-label py-2 pr-4 text-right text-ink-faint">
                    Avg latency
                  </th>
                  <th scope="col" className="type-label py-2 text-right text-ink-faint">
                    Failures
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...byAgent.entries()].map(([agent, stats]) => (
                  <tr key={agent} className="border-b border-line last:border-0">
                    <th scope="row" className="type-small py-2.5 pr-4 text-left font-normal text-ink">
                      {AGENT_LABEL[agent]}
                    </th>
                    <td data-numeric className="type-small py-2.5 pr-4 text-right text-ink-muted">
                      {stats.count}
                    </td>
                    <td data-numeric className="type-small py-2.5 pr-4 text-right text-ink-muted">
                      {(stats.latency / stats.count / 1000).toFixed(2)}s
                    </td>
                    <td
                      data-numeric
                      className={`type-small py-2.5 text-right ${
                        stats.failures > 0 ? 'text-watch' : 'text-ink-muted'
                      }`}
                    >
                      {stats.failures}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          description="Once the council has convened, every execution appears here with its latency, cost and validation outcome."
          actionLabel="Design my game"
          actionHref="/game"
        />
      ) : (
        <section>
          <SectionLabel>Recent council runs</SectionLabel>
          <ul className="mt-3 space-y-2">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="type-small text-ink capitalize">
                    {run.purpose.replace(/_/g, ' ')}
                  </p>
                  <p className="type-small text-ink-faint">
                    {run.startedAt.toISOString().replace('T', ' ').slice(0, 19)} · {run.provider}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span data-numeric className="type-small text-ink-muted">
                    {run.agentCount} agents
                  </span>
                  <span data-numeric className="type-small text-ink-muted">
                    {run.latencyMs ? `${(run.latencyMs / 1000).toFixed(1)}s` : '—'}
                  </span>
                  <span data-numeric className="type-small text-ink-muted">
                    {(run.totalInputTokens + run.totalOutputTokens).toLocaleString()} tok
                  </span>
                  <span data-numeric className="type-small text-ink-muted">
                    ${run.estimatedCostUsd.toFixed(4)}
                  </span>
                  <Badge
                    tone={
                      run.status === 'succeeded'
                        ? 'protect'
                        : run.status === 'partial'
                          ? 'watch'
                          : 'risk'
                    }
                  >
                    {run.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {conflicts.length > 0 && (
        <section>
          <SectionLabel>Conflicts detected</SectionLabel>
          <ul className="mt-3 space-y-2">
            {conflicts.map((c) => (
              <li key={c.id} className="rounded-[var(--radius-md)] border border-line px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={c.severity === 'critical' ? 'risk' : 'watch'}>{c.kind}</Badge>
                  <span className="type-small text-ink-faint">
                    {AGENT_LABEL[c.raisedBy]}
                    {c.against ? ` → ${AGENT_LABEL[c.against]}` : ''}
                  </span>
                </div>
                <p className="type-small mt-1.5 text-ink">{c.claim}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recommendations.length > 0 && (
        <section>
          <SectionLabel>Recommendations</SectionLabel>
          <ul className="mt-3 space-y-2">
            {recommendations.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="type-small text-ink">{r.title}</p>
                  <p className="type-small text-ink-faint">
                    {r.target} · {r.priority}
                    {r.leverage ? ` · ${r.leverage}` : ''}
                  </p>
                </div>
                <Badge tone={r.status === 'applied' ? 'protect' : 'neutral'}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
      <dt className="type-small text-ink-muted">{label}</dt>
      <dd className="type-small font-medium text-ink">{value}</dd>
    </div>
  );
}
