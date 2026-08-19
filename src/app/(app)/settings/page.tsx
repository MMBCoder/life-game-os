import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth/session';
import { activeDriver } from '@/lib/db';
import { resolveProviderChoice } from '@/lib/ai/config';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/feedback';
import { TimezoneSetting, DangerZone } from './settings-client';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requireSession();
  const provider = resolveProviderChoice();

  return (
    <div className="space-y-8">
      <header>
        <p className="type-label text-ink-faint">Settings</p>
        <h1 className="type-statement mt-2 text-ink">Your account and your data.</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="space-y-3">
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
              <dt className="type-small text-ink-muted">Name</dt>
              <dd className="type-small text-ink">{user.name}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
              <dt className="type-small text-ink-muted">Email</dt>
              <dd className="type-small text-ink">{user.email}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="type-small text-ink-muted">Account type</dt>
              <dd>
                <Badge tone={user.isDemo ? 'neutral' : 'primary'}>
                  {user.isDemo ? 'Demo' : 'Personal'}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <TimezoneSetting current={user.timezone} />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Your data</CardTitle>
            <p className="type-small mt-1 text-ink-muted">
              This product holds a detailed picture of your life and work. You can take all of it
              with you, or remove all of it, at any time.
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <p className="type-body text-ink">Export everything</p>
            <p className="type-small mt-1 text-ink-muted">
              A complete JSON file: your Personal Model, life map history, goals, games, player,
              protocol, reflections, memory and every council run. Credentials are excluded.
            </p>
            <a
              href="/api/export"
              className="type-small mt-3 inline-flex h-9 items-center rounded-[var(--radius-md)] border border-line-strong px-3.5 text-ink transition-colors hover:border-ink-faint hover:bg-bg-subtle"
            >
              Download my data
            </a>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How this deployment is configured</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="space-y-3">
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
              <dt className="type-small text-ink-muted">AI provider</dt>
              <dd className="type-small text-ink">
                {provider === 'mock' ? 'Deterministic (offline)' : 'Anthropic'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="type-small text-ink-muted">Database</dt>
              <dd className="type-small text-ink">
                {activeDriver() === 'pglite' ? 'Embedded Postgres (local)' : 'PostgreSQL'}
              </dd>
            </div>
          </dl>
          {provider === 'mock' && (
            <p className="type-small mt-4 text-ink-faint">
              No API key is configured, so the deterministic provider is generating your plans. The
              whole product works; the reasoning is drawn from a built-in strategy library rather
              than a model. Set <code>ANTHROPIC_API_KEY</code> to switch.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What this product is not</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          <p className="type-small text-ink-muted">
            It supports wellness planning — sustainable routines, recovery, workload, energy. It
            does not diagnose conditions, prescribe treatment, or replace professional care. If
            something feels beyond planning, it is worth discussing with a qualified professional.
          </p>
          <p className="type-small text-ink-muted">
            It helps with financial goals, behaviour and trade-offs. It does not provide regulated
            financial advice.
          </p>
          <p className="type-small text-ink-muted">
            Its scores evaluate plans and moments, never your worth.
          </p>
        </CardBody>
      </Card>

      <DangerZone />

      <p className="type-small text-ink-faint">
        <Link href="/insight" className="underline underline-offset-4">
          See everything we know about you
        </Link>
      </p>
    </div>
  );
}
