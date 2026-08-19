import type { Metadata } from 'next';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { requireSession } from '@/lib/auth/session';
import { getProfile } from '@/lib/db/repositories/users';
import * as execution from '@/lib/db/repositories/execution';
import * as gameRepo from '@/lib/db/repositories/game';
import { latestSacrifice, latestCouncilRun, listConflicts } from '@/lib/db/repositories/council';
import { greetingFor, todayIn } from '@/lib/date';
import { OPERATING_STATE_LABEL } from '@/schemas/common';
import { MOMENTUM_BAND_LABEL, bandFor } from '@/lib/scoring/momentum';
import { computeIntention, liftLever } from '@/lib/scoring/intention';
import { resolveNextStep } from '@/lib/guidance/next-step';
import { Card, CardBody, CardHeader, CardTitle, SectionLabel } from '@/components/ui/card';
import { Badge, Callout, EmptyState, Meter, Stat } from '@/components/ui/feedback';
import { WhyDisclosure } from '@/components/ui/dialog';
import { IntentionLadder } from '@/components/intention/intention-ladder';
import { TodayMoves } from './today-moves';
import { GenerateDayButton, ModeSwitch, StateOverride, MomentumAccept } from './controls';

export const metadata: Metadata = { title: 'Today' };

const CTA =
  'inline-flex h-12 items-center rounded-[var(--radius-md)] bg-primary px-6 text-base font-medium text-primary-ink shadow-[var(--shadow-soft)] transition-colors hover:bg-primary-hover';

/**
 * The dashboard answers one question before any other: what should I do right now?
 *
 * Everything above the "The read behind it" divider is action. Everything below it is
 * reference, and is there to be consulted rather than processed. The previous layout
 * presented six panels of equal weight, which left the person to work out their own
 * starting point — the exact decision load this product exists to remove.
 */
export default async function DashboardPage() {
  const user = await requireSession();
  const today = todayIn(user.timezone);

  const [profile, dayLog, actions, state, momentum, full, sacrifice, protocol, lastRun, weekly] =
    await Promise.all([
      getProfile(user.id),
      execution.getDayLog(user.id, today),
      execution.getTodayActions(user.id, today),
      execution.latestState(user.id),
      execution.latestMomentum(user.id),
      gameRepo.getFullGame(user.id),
      latestSacrifice(user.id),
      execution.getActiveProtocol(user.id),
      latestCouncilRun(user.id),
      execution.listReflections(user.id, 'weekly', 1),
    ]);

  if (profile?.onboardingStage !== 'complete') {
    return (
      <EmptyState
        title="Let’s build your game."
        description="Three questions, and we will draft a personal snapshot you can correct. It takes about two minutes."
        actionLabel="Start discovery"
        actionHref="/discover"
      />
    );
  }

  const moves = actions.filter((a) => a.isTodayMove);
  const movesDone = moves.filter((m) => m.status === 'done').length;
  const mode = dayLog?.mode ?? 'standard';

  // Only an outright breach of something the person protected counts as urgent here.
  // The broader `isBlocking` set fires on most runs by design; using it to drive a
  // dashboard interrupt would cry wolf until the interrupt stopped meaning anything.
  const conflicts = lastRun ? await listConflicts(user.id, 50) : [];
  const breaches = conflicts.filter(
    (c) => c.councilRunId === lastRun?.id && c.kind === 'non_negotiable_breach',
  ).length;

  const daysSinceReview = weekly[0]?.periodEnd
    ? Math.floor((Date.parse(today) - Date.parse(weekly[0].periodEnd)) / 86_400_000)
    : null;

  const intentionInputs = {
    alignment: state?.alignment ?? 5,
    momentum: momentum?.level ?? 0,
    followThrough: moves.length > 0 ? movesDone / moves.length : 0,
    energy: state?.energy ?? 5,
    capacity: state?.capacity ?? 5,
    sacrificeVerdict: sacrifice?.verdict ?? null,
    blockingConflicts: breaches,
    hasGame: full !== null,
    confirmed: full?.game.status === 'active',
  };
  const intention = computeIntention(intentionInputs);
  const lever = liftLever(intention, intentionInputs);

  const next = resolveNextStep({
    onboardingComplete: true,
    hasGame: full !== null,
    gameConfirmed: full?.game.status === 'active',
    blockingConflicts: breaches,
    sacrificeVerdict: sacrifice?.verdict ?? null,
    hasProtocol: protocol !== null,
    plannedToday: moves.length > 0,
    movesTotal: moves.length,
    movesDone,
    daysSinceWeeklyReview: daysSinceReview,
  });

  const eyebrow = next.urgent
    ? 'Needs you first'
    : next.kind === 'current'
      ? 'Nothing outstanding'
      : 'Start here';

  return (
    <div className="space-y-6">
      {/* ── Identity strip ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <p className="type-label text-ink-faint">
            {greetingFor(user.timezone)}, {user.name}
          </p>
          <h1 className="type-h1 mt-1.5 text-ink">{full ? full.game.name : 'No game yet'}</h1>
        </div>
        {full && (
          <p className="type-small max-w-md text-ink-muted">{full.game.strategicObjective}</p>
        )}
      </header>

      {/* ── The next move. One thing. ──────────────────────────────────── */}
      <Card
        as="section"
        tone={next.urgent ? 'risk' : 'default'}
        className={cn(
          'edge-light overflow-hidden',
          next.urgent ? 'wash-risk' : next.kind === 'current' ? 'wash-quiet' : 'wash-primary',
        )}
      >
        <div className="px-6 py-7 sm:px-8 sm:py-9">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                'inline-block size-2 rounded-full',
                next.urgent ? 'bg-risk' : next.kind === 'current' ? 'bg-protect' : 'bg-primary',
              )}
            />
            <p className="type-label text-ink-muted">{eyebrow}</p>
          </div>

          <h2 className="type-statement mt-3 max-w-2xl text-ink">{next.label}</h2>
          <p className="type-body mt-2.5 max-w-2xl text-ink-muted">{next.why}</p>

          <div className="mt-6">
            {next.kind === 'plan_today' ? (
              <GenerateDayButton hasPlan={false} size="lg" label="Plan today" />
            ) : next.href ? (
              <Link href={next.href} className={CTA}>
                {next.label}
              </Link>
            ) : next.kind === 'run_moves' ? (
              <a href="#today" className={CTA}>
                Go to today’s moves
              </a>
            ) : null}
          </div>
        </div>
      </Card>

      {/* ── Intention and today: the two things that move hour to hour ─── */}
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lift lg:col-span-7">
          <CardBody className="pt-6">
            <IntentionLadder reading={intention} />

            <div className="mt-6 rounded-[var(--radius-md)] border border-line bg-bg-subtle/60 px-4 py-3.5">
              <p className="type-label text-ink-faint">One level up</p>
              <p className="type-small mt-1 text-ink">{lever}</p>
            </div>

            <div className="mt-4">
              <WhyDisclosure label="How this level was read">
                <p className="mb-3">{intention.explanation}</p>
                {intention.raising.length > 0 && (
                  <>
                    <p className="type-label mb-1 text-ink-faint">Raising it</p>
                    <ul className="mb-3 list-inside list-disc space-y-1">
                      {intention.raising.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </>
                )}
                {intention.lowering.length > 0 && (
                  <>
                    <p className="type-label mb-1 text-ink-faint">Lowering it</p>
                    <ul className="list-inside list-disc space-y-1">
                      {intention.lowering.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="mt-3 text-ink-faint">
                  This describes the stance you are operating from right now, which changes hour to
                  hour. It is not a measure of you, and it is not a clinical assessment.
                </p>
              </WhyDisclosure>
            </div>
          </CardBody>
        </Card>

        <Card id="today" className="lift lg:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>Today’s three moves</CardTitle>
              <p className="type-small mt-1 text-ink-muted">
                One strategic, one for you, one for someone who matters.
              </p>
            </div>
            {moves.length > 0 && (
              <span data-numeric className="type-label shrink-0 text-ink-faint">
                {movesDone}/{moves.length}
              </span>
            )}
          </CardHeader>
          <CardBody>
            {moves.length === 0 ? (
              <div className="rounded-[var(--radius-md)] border border-dashed border-line-strong px-4 py-8 text-center">
                <p className="type-small text-ink-muted">
                  Today has not been planned yet. Use{' '}
                  <strong className="text-ink">Plan today</strong> above and we will size three
                  moves to the capacity you actually have.
                </p>
              </div>
            ) : (
              <>
                <TodayMoves
                  moves={moves.map((m) => ({
                    id: m.id,
                    title: m.title,
                    kind: m.kind,
                    why: m.why,
                    timeMinutes: m.timeMinutes,
                    status: m.status,
                  }))}
                />
                <div className="mt-4">
                  <GenerateDayButton hasPlan />
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Warnings, only when there is one ───────────────────────────── */}
      {dayLog?.councilNote && (
        <Callout tone="primary" title="Council note">
          {dayLog.councilNote}
        </Callout>
      )}

      {sacrifice && sacrifice.verdict !== 'balanced' && sacrifice.warning && (
        <Callout tone={sacrifice.verdict === 'warning' ? 'risk' : 'watch'} title="Strategy warning">
          {sacrifice.warning}{' '}
          <Link href="/game" className="underline underline-offset-4">
            Review the plan
          </Link>
        </Callout>
      )}

      {/* ── Reference. Consulted, not processed. ───────────────────────── */}
      <div className="pt-2">
        <SectionLabel>The read behind it</SectionLabel>
        <div className="mt-3 grid gap-5 lg:grid-cols-12">
          <Card className="lift lg:col-span-4">
            <CardHeader>
              <div>
                <CardTitle>Operating state</CardTitle>
                <p className="type-small mt-1 text-ink-muted">
                  A state, not a label. Change it if we read it wrong.
                </p>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {state ? (
                <>
                  <div className="flex items-baseline gap-3">
                    <p className="type-h2 text-ink">
                      {OPERATING_STATE_LABEL[state.operatingState]}
                    </p>
                    <span data-numeric className="type-small text-ink-faint">
                      {Math.round(state.confidence * 100)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Meter label="Focus" value={state.focus} />
                    <Meter
                      label="Energy"
                      value={state.energy}
                      tone={state.energy <= 4 ? 'watch' : 'primary'}
                    />
                    <Meter label="Alignment" value={state.alignment} />
                    <Meter
                      label="Capacity"
                      value={state.capacity}
                      tone={
                        state.capacity <= 3 ? 'risk' : state.capacity <= 5 ? 'watch' : 'protect'
                      }
                    />
                  </div>

                  <WhyDisclosure label="Why this state?">
                    <ul className="list-inside list-disc space-y-1">
                      {state.drivers.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </WhyDisclosure>

                  <StateOverride current={state.operatingState} />
                </>
              ) : (
                <p className="type-small text-ink-muted">
                  No reading yet. Plan today and we will assess it.
                </p>
              )}
            </CardBody>
          </Card>

          <Card className="lift lg:col-span-4">
            <CardHeader>
              <div>
                <CardTitle>Intentional momentum</CardTitle>
                <p className="type-small mt-1 text-ink-muted">
                  How intentionally you are operating toward this game.
                </p>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {momentum ? (
                <>
                  <div className="flex items-end gap-3">
                    <Stat label="Level" value={`${momentum.level}/10`} tone="primary" />
                    <Badge tone="neutral" className="mb-1">
                      {MOMENTUM_BAND_LABEL[bandFor(momentum.level)]}
                    </Badge>
                  </div>
                  <p className="type-small text-ink-muted">{momentum.explanation}</p>

                  <WhyDisclosure label="Show the calculation">
                    <ul className="space-y-1.5">
                      {Object.entries(momentum.components).map(([key, value]) => (
                        <li key={key} className="flex justify-between">
                          <span className="capitalize">{key}</span>
                          <span data-numeric>{Number(value).toFixed(1)}/10</span>
                        </li>
                      ))}
                    </ul>
                  </WhyDisclosure>

                  <MomentumAccept computed={momentum.computed} accepted={momentum.accepted} />
                </>
              ) : (
                <p className="type-small text-ink-muted">
                  Calculated once you have a game and a few days of play.
                </p>
              )}
            </CardBody>
          </Card>

          <div className="grid content-start gap-5 lg:col-span-4">
            <Card className="lift">
              <CardHeader>
                <CardTitle>Today’s protocol</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <ModeSwitch current={mode} />
                {protocol ? (
                  <ul className="space-y-2.5">
                    {protocol.items.slice(0, 4).map((item) => (
                      <li key={item.id} className="flex items-baseline justify-between gap-3">
                        <span className="type-small text-ink-muted">{item.label}</span>
                        <span className="type-small text-right font-medium text-ink">
                          {mode === 'minimum'
                            ? item.minimum
                            : mode === 'expansion'
                              ? item.expansion
                              : item.standard}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="type-small text-ink-muted">
                    No protocol yet.{' '}
                    <Link href="/protocol" className="text-primary underline underline-offset-4">
                      Build one
                    </Link>
                    .
                  </p>
                )}
              </CardBody>
            </Card>

            <Card tone="primary" className="lift">
              <CardHeader>
                <CardTitle>One decision</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                <p className="type-body text-ink">
                  {dayLog?.oneDecision ??
                    'What is the highest-leverage decision you need to make today?'}
                </p>
                <Link
                  href="/player"
                  className="type-small inline-flex text-primary underline underline-offset-4"
                >
                  Ask my Player →
                </Link>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
