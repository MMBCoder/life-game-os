import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Life Game OS — Win big. Live well.',
  description:
    'Build a deeply personal game plan for your career, health, relationships, freedom and future — without sacrificing the things that make winning worthwhile.',
};

const JOURNEY = [
  { step: 'Understand yourself', detail: 'Three questions. Not a questionnaire.' },
  { step: 'Define your game', detail: 'One objective, three results, ninety days.' },
  { step: 'Design your player', detail: 'Who you need to be to play it well.' },
  { step: 'Build your protocol', detail: 'Minimum, standard, expansion — for real weeks.' },
  { step: 'Play', detail: 'Three moves a day. One decision.' },
  { step: 'Adapt', detail: 'When reality moves, the plan moves.' },
];

export default function LandingPage() {
  return (
    <main id="main">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 md:pt-32 md:pb-24">
        <p className="type-label text-primary">A personal strategy operating system</p>
        <h1 className="type-display mt-5 max-w-4xl text-ink">
          Win big.
          <br />
          Live well.
        </h1>
        <p className="type-body mt-7 max-w-2xl text-ink-muted">
          Build a deeply personal game plan for your career, health, relationships, freedom and
          future — without sacrificing the things that make winning worthwhile.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex h-12 items-center rounded-[var(--radius-md)] bg-primary px-7 text-base font-medium text-primary-ink shadow-[var(--shadow-soft)] transition-colors hover:bg-primary-hover"
          >
            Build my game
          </Link>
          <Link
            href="#how"
            className="inline-flex h-12 items-center rounded-[var(--radius-md)] border border-line-strong px-6 text-base text-ink transition-colors hover:border-ink-faint hover:bg-bg-subtle"
          >
            See how it works
          </Link>
        </div>

        <p className="type-small mt-6 text-ink-faint">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-primary underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </section>

      {/* ── The premise ──────────────────────────────────────────────────── */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1fr_1.1fr] md:py-24">
          <div>
            <p className="type-label text-ink-faint">The premise</p>
            <h2 className="type-statement mt-4 text-ink">
              You should not have to choose between doing well and being well.
            </h2>
          </div>
          <div className="space-y-5">
            <p className="type-body text-ink-muted">
              Most tools optimise output. They count habits, track goals, and are entirely
              indifferent to what the output costs. Nothing in a productivity dashboard notices
              that your career score is climbing while your health and your family are paying for
              it.
            </p>
            <p className="type-body text-ink-muted">
              This one is built the other way round. It starts from what you refuse to sacrifice,
              and then finds a strategy that reaches your ambition anyway — through leverage rather
              than more hours.
            </p>
            <p className="type-body font-medium text-ink">
              When a plan would cost too much, we do not lower the ambition. We change the method.
            </p>
          </div>
        </div>
      </section>

      {/* ── Signature mechanisms ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <p className="type-label text-ink-faint">What makes it different</p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <Feature
            title="Outer win vs inner win"
            body="Every part of your life is scored twice — what is happening, and what it feels like. When those two diverge, your strategy is producing results at a cost nobody has priced."
          />
          <Feature
            title="A council that argues"
            body="Thirteen specialists analyse your plan in parallel, then disagree with each other. Health and relationships can veto strategy. You see the whole argument, not a tidy answer."
          />
          <Feature
            title="Sacrifice Radar"
            body="Every plan is scored for what it costs across your life. If it would spend something you named as non-negotiable, it is blocked — and alternatives are generated that keep the ambition."
          />
        </div>
      </section>

      {/* ── The journey ──────────────────────────────────────────────────── */}
      <section id="how" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <p className="type-label text-ink-faint">How it works</p>
          <h2 className="type-statement mt-4 max-w-2xl text-ink">
            Minimal input. The system does the thinking.
          </h2>

          <ol className="mt-12 grid gap-x-8 gap-y-9 md:grid-cols-3">
            {JOURNEY.map((item, index) => (
              <li key={item.step} className="relative">
                <span
                  data-numeric
                  className="type-label text-primary"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="type-h3 mt-2 text-ink">{item.step}</h3>
                <p className="type-small mt-1.5 text-ink-muted">{item.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Two people, one goal ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <p className="type-label text-ink-faint">Personalisation, tested</p>
        <h2 className="type-statement mt-4 max-w-3xl text-ink">
          Two people say “I want to become a senior leader.” They should not get the same plan.
        </h2>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-6">
            <p className="type-label text-ink-faint">High capacity, few commitments</p>
            <p className="type-body mt-3 text-ink">
              Visibility. Strategic projects. Sponsorship. Deliberate exposure. The plan can reach
              further because there is genuine room.
            </p>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-6">
            <p className="type-label text-ink-faint">Family, already at capacity</p>
            <p className="type-body mt-3 text-ink">
              Delegation. Leverage. Executive communication. Positioning. Workload redesign. The
              same ambition, funded by removing work rather than by adding hours.
            </p>
          </div>
        </div>
      </section>

      {/* ── Close ────────────────────────────────────────────────────────── */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center md:py-28">
          <h2 className="type-display text-ink">Build a life worth winning.</h2>
          <p className="type-body mx-auto mt-5 max-w-xl text-ink-muted">
            Your ambition. Your life. One game plan.
          </p>
          <Link
            href="/sign-up"
            className="mt-9 inline-flex h-12 items-center rounded-[var(--radius-md)] bg-primary px-7 text-base font-medium text-primary-ink transition-colors hover:bg-primary-hover"
          >
            Build my game
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <p className="type-small text-ink-faint">Life Game OS</p>
          <p className="type-small max-w-xl text-ink-faint">
            Supports wellness planning and personal strategy. Not medical, psychological, or
            regulated financial advice.
          </p>
        </div>
      </footer>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-6">
      <h3 className="type-h3 text-ink">{title}</h3>
      <p className="type-small mt-2.5 text-ink-muted">{body}</p>
    </div>
  );
}
