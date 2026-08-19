import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth/session';
import * as gameRepo from '@/lib/db/repositories/game';
import * as life from '@/lib/db/repositories/life';
import { latestSacrifice } from '@/lib/db/repositories/council';
import { getGameHealthDetail } from '@/services/game';
import { todayIn } from '@/lib/date';
import { GAME_HEALTH_BAND_LABEL } from '@/lib/scoring/game-health';
import { LEVERAGE_LABEL, type LeverageCategory } from '@/schemas/common';
import { Card, CardBody, CardHeader, CardTitle, SectionLabel } from '@/components/ui/card';
import { Badge, Callout, Stat } from '@/components/ui/feedback';
import { WhyDisclosure } from '@/components/ui/dialog';
import { GameTimeline } from '@/components/game/game-timeline';
import { SacrificeRadar } from '@/components/game/sacrifice-radar';
import { DesignGame, ProgressControl, AdaptPanel } from './game-client';

export const metadata: Metadata = { title: 'Game' };

export default async function GamePage() {
  const user = await requireSession();
  const [full, sacrifice, health, domains] = await Promise.all([
    gameRepo.getFullGame(user.id),
    latestSacrifice(user.id),
    getGameHealthDetail(user),
    life.listDomains(user.id),
  ]);

  if (!full) {
    return (
      <div className="space-y-8">
        <header>
          <p className="type-label text-ink-faint">Your game</p>
          <h1 className="type-statement mt-2 text-ink">Ninety days, one objective.</h1>
        </header>
        <DesignGame hasGame={false} />
      </div>
    );
  }

  const { game, boldResults, strategicMoves, stopList, protectList, risks, squad } = full;
  const labelByKey = new Map(domains.map((d) => [d.key, d.label]));
  const today = todayIn(user.timezone);

  return (
    <div className="space-y-8">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <p className="type-label text-ink-faint">Your game</p>
          {game.status === 'recalibrating' && <Badge tone="watch">Needs recalibrating</Badge>}
          {game.status === 'draft' && <Badge tone="neutral">Draft</Badge>}
        </div>
        <h1 className="type-display mt-2 text-ink">{game.name}</h1>
        <p className="type-body mt-4 max-w-2xl text-ink-muted">{game.purpose}</p>
      </header>

      {/* ── Winning / not winning ─────────────────────────────────────── */}
      <section className="grid gap-5 md:grid-cols-2">
        <Card tone="primary">
          <CardHeader>
            <CardTitle>Winning means</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="type-body text-ink">{game.winningDefinition}</p>
          </CardBody>
        </Card>
        <Card tone="protect">
          <CardHeader>
            <CardTitle>Winning does not require</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="type-body text-ink">{game.nonWinningDefinition}</p>
          </CardBody>
        </Card>
      </section>

      {/* ── Game health ───────────────────────────────────────────────── */}
      {health && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Game health</CardTitle>
              <p className="type-small mt-1 text-ink-muted">
                This scores the plan, not you.
              </p>
            </div>
            <Badge
              tone={
                health.band === 'strong'
                  ? 'protect'
                  : health.band === 'solid'
                    ? 'primary'
                    : health.band === 'developing'
                      ? 'watch'
                      : 'risk'
              }
            >
              {GAME_HEALTH_BAND_LABEL[health.band]}
            </Badge>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-end gap-8">
              <Stat label="Score" value={health.score} tone="primary" />
              {health.strong.length > 0 && (
                <div>
                  <p className="type-label text-ink-faint">Strong</p>
                  <p className="type-small mt-1 text-ink">{health.strong.join(' · ')}</p>
                </div>
              )}
              {health.watch.length > 0 && (
                <div>
                  <p className="type-label text-ink-faint">Watch</p>
                  <p className="type-small mt-1 text-watch">{health.watch.join(' · ')}</p>
                </div>
              )}
            </div>
            <WhyDisclosure label="Show the breakdown">
              <ul className="space-y-1.5">
                {health.contributions.map((c) => (
                  <li key={c.factor} className="flex justify-between gap-4">
                    <span>{c.factor}</span>
                    <span data-numeric>
                      {c.score.toFixed(1)}/10 · weight {Math.round(c.weight * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </WhyDisclosure>
          </CardBody>
        </Card>
      )}

      {/* ── Timeline ──────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Three bold results</SectionLabel>
        <div className="mt-3">
          <GameTimeline
            results={boldResults.map((b) => ({
              id: b.id,
              title: b.title,
              dayMarker: b.dayMarker,
              targetDate: b.targetDate,
              progress: b.progress,
              successDefinition: b.successDefinition,
            }))}
            startDate={game.startDate}
            endDate={game.endDate}
            today={today}
          />
        </div>

        <ul className="mt-5 space-y-4">
          {boldResults.map((b) => (
            <li key={b.id}>
              <Card>
                <CardHeader>
                  <div>
                    <p className="type-label text-ink-faint">Day {b.dayMarker}</p>
                    <CardTitle as="h3" className="mt-1">
                      {b.title}
                    </CardTitle>
                  </div>
                  <ProgressControl boldResultId={b.id} progress={b.progress} />
                </CardHeader>
                <CardBody className="space-y-4">
                  <p className="type-body text-ink">{b.successDefinition}</p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <MiniList label="Evidence" items={b.evidence} />
                    <MiniList label="Leading indicators" items={b.leadingIndicators} />
                    {b.dependencies.length > 0 && (
                      <MiniList label="Depends on" items={b.dependencies} />
                    )}
                    {b.riskNotes.length > 0 && <MiniList label="Risks" items={b.riskNotes} />}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="type-label text-ink-faint">Confidence</span>
                    <span data-numeric className="type-small text-ink">
                      {Math.round(b.confidence * 100)}%
                    </span>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Strategic moves ───────────────────────────────────────────── */}
      <section>
        <SectionLabel>Strategic moves</SectionLabel>
        <p className="type-small mt-1 mb-3 text-ink-muted">
          How we win — not a task list. Each one names the leverage it uses.
        </p>
        <ul className="space-y-3">
          {strategicMoves.map((move) => (
            <li key={move.id}>
              <Card>
                <CardBody className="pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="type-h3 text-ink">{move.title}</p>
                    {move.leverageCategory && (
                      <Badge tone="primary">
                        {LEVERAGE_LABEL[move.leverageCategory as LeverageCategory] ??
                          move.leverageCategory}
                      </Badge>
                    )}
                  </div>
                  <p className="type-body mt-2 text-ink-muted">{move.detail}</p>
                  <div className="mt-3 flex gap-4">
                    <span className="type-label text-ink-faint">
                      Impact: <span className="text-ink">{move.expectedImpact}</span>
                    </span>
                    <span className="type-label text-ink-faint">
                      Effort: <span className="text-ink">{move.effort}</span>
                    </span>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Stop / protect ────────────────────────────────────────────── */}
      <section className="grid gap-5 md:grid-cols-2">
        <Card tone="risk">
          <CardHeader>
            <div>
              <CardTitle>Stop doing</CardTitle>
              <p className="type-small mt-1 text-ink-muted">
                Capacity has to be created before it can be spent.
              </p>
            </div>
          </CardHeader>
          <CardBody>
            <ul className="space-y-3">
              {stopList.map((item) => (
                <li key={item.id}>
                  <p className="type-body font-medium text-ink">{item.text}</p>
                  <p className="type-small mt-0.5 text-ink-muted">{item.reason}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card tone="protect">
          <CardHeader>
            <div>
              <CardTitle>Never sacrifice</CardTitle>
              <p className="type-small mt-1 text-ink-muted">
                Hard constraints on the strategy, not preferences.
              </p>
            </div>
          </CardHeader>
          <CardBody>
            <ul className="space-y-3">
              {protectList.map((item) => (
                <li key={item.id}>
                  <p className="type-body font-medium text-ink">{item.text}</p>
                  <p className="type-small mt-0.5 text-ink-muted">{item.reason}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>

      {/* ── Sacrifice radar ───────────────────────────────────────────── */}
      {sacrifice && (
        <SacrificeRadar
          rows={sacrifice.scores.map((s) => ({
            domainKey: s.domainKey,
            label: labelByKey.get(s.domainKey) ?? s.domainKey,
            delta: s.delta,
            why: s.why,
          }))}
          verdict={sacrifice.verdict}
          warning={sacrifice.warning}
          alternatives={sacrifice.alternatives}
        />
      )}

      {/* ── Why this plan / omissions ─────────────────────────────────── */}
      <section className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Why this plan?</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="type-body text-ink">{game.whyThisPlan}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What we are not doing</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2">
              {game.intentionalOmissions.map((omission) => (
                <li key={omission} className="type-body flex gap-2.5 text-ink">
                  <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-ink-faint" />
                  {omission}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>

      {/* ── Risks & squad ─────────────────────────────────────────────── */}
      {risks.length > 0 && (
        <section>
          <SectionLabel>Risks</SectionLabel>
          <ul className="mt-3 space-y-3">
            {risks.map((risk) => (
              <li key={risk.id}>
                <Card tone={risk.severity === 'critical' || risk.severity === 'high' ? 'watch' : 'default'}>
                  <CardBody className="pt-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="type-h3 text-ink">{risk.title}</p>
                      <div className="flex gap-1.5">
                        <Badge tone={risk.severity === 'critical' ? 'risk' : 'watch'}>
                          {risk.severity}
                        </Badge>
                        <Badge tone="neutral">{risk.likelihood} likelihood</Badge>
                      </div>
                    </div>
                    <p className="type-body mt-2 text-ink-muted">{risk.detail}</p>
                    <p className="type-small mt-2.5 text-ink">
                      <strong>Mitigation:</strong> {risk.mitigation}
                    </p>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {squad.length > 0 && (
        <section>
          <SectionLabel>Your squad</SectionLabel>
          <ul className="mt-3 grid gap-4 md:grid-cols-2">
            {squad.map((member) => (
              <li key={member.id}>
                <Card>
                  <CardBody className="pt-5">
                    <p className="type-h3 text-ink">{member.name}</p>
                    <p className="type-small mt-1 text-ink-muted">{member.canHelpWith}</p>
                    {member.askDraft && (
                      <blockquote className="type-small mt-3 border-l-2 border-line-strong pl-3 text-ink italic">
                        “{member.askDraft}”
                      </blockquote>
                    )}
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Adapt / redesign ──────────────────────────────────────────── */}
      <section className="space-y-5">
        <AdaptPanel />
        <DesignGame hasGame />
      </section>

      <Callout tone="neutral">
        Want to see the council&rsquo;s full argument about this plan?{' '}
        <Link href="/council" className="underline underline-offset-4">
          Open the Council Room
        </Link>
        .
      </Callout>
    </div>
  );
}

function MiniList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="type-label text-ink-faint">{label}</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item} className="type-small text-ink-muted">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
