import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth/session';
import * as personal from '@/lib/db/repositories/personal-model';
import { recallAll } from '@/lib/memory';
import { Card, CardBody, CardHeader, CardTitle, SectionLabel } from '@/components/ui/card';
import { Badge } from '@/components/ui/feedback';
import { ProvenanceChip } from '@/components/ui/provenance';
import type { SourceKind } from '@/schemas/common';
import { GeneratePlan, ClaimRow, BlindSpotCard } from './insight-client';

export const metadata: Metadata = { title: 'Insight' };

export default async function InsightPage() {
  const user = await requireSession();

  const [plan, blindSpots, values, strengths, constraints, nonNegotiables, patterns, memory] =
    await Promise.all([
      personal.getInsightPlan(user.id),
      personal.listBlindSpots(user.id),
      personal.listValues(user.id),
      personal.listStrengths(user.id),
      personal.listConstraints(user.id),
      personal.listNonNegotiables(user.id),
      personal.listPatterns(user.id),
      recallAll(user.id),
    ]);

  const openBlindSpots = blindSpots.filter((b) => b.userResponse === null);

  return (
    <div className="space-y-8">
      <header>
        <p className="type-label text-ink-faint">Personal insight</p>
        <h1 className="type-statement mt-2 text-ink">What we understand about you.</h1>
        <p className="type-body mt-3 max-w-2xl text-ink-muted">
          Everything here is labelled by where it came from. What you told us outranks what we
          worked out, and you can correct any of it.
        </p>
      </header>

      <GeneratePlan hasPlan={plan !== null} />

      {/* ── Blind spots ───────────────────────────────────────────────── */}
      {openBlindSpots.length > 0 && (
        <section>
          <SectionLabel>Potential blind spots</SectionLabel>
          <p className="type-small mt-1 mb-3 text-ink-muted">
            Hypotheses, not conclusions. Tell us when we have it wrong.
          </p>
          <ul className="space-y-3">
            {openBlindSpots.map((spot) => (
              <li key={spot.id}>
                <BlindSpotCard
                  id={spot.id}
                  hypothesis={spot.hypothesis}
                  detail={spot.detail}
                  confidence={spot.confidence}
                  basedOn={spot.basedOn}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Insight plan ──────────────────────────────────────────────── */}
      {plan && (
        <section>
          <SectionLabel>My personal insight plan</SectionLabel>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {plan.sections.map((section) => (
              <Card key={section.title}>
                <CardHeader>
                  <CardTitle as="h3">{section.title}</CardTitle>
                  <ProvenanceChip
                    source={section.source as SourceKind}
                    confidence={section.confidence}
                  />
                </CardHeader>
                <CardBody>
                  <p className="type-body text-ink">{section.body}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── What we know ──────────────────────────────────────────────── */}
      <section>
        <SectionLabel>What we know about you</SectionLabel>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <ClaimList
            title="Values"
            table="values"
            items={values.map((v) => ({
              id: v.id,
              label: v.label,
              note: v.kind === 'principle' ? 'Principle' : null,
              source: v.source,
              confidence: v.confidence,
              status: v.status,
            }))}
          />
          <ClaimList
            title="Non-negotiables"
            table="non_negotiables"
            items={nonNegotiables.map((n) => ({
              id: n.id,
              label: n.label,
              note: n.hardness,
              source: n.source,
              confidence: n.confidence,
              status: n.status,
            }))}
          />
          <ClaimList
            title="Strengths"
            table="strengths"
            items={strengths.map((s) => ({
              id: s.id,
              label: s.label,
              note: s.kind === 'overdone' ? 'Can be overdone' : null,
              source: s.source,
              confidence: s.confidence,
              status: s.status,
            }))}
          />
          <ClaimList
            title="Constraints"
            table="constraints"
            items={constraints.map((c) => ({
              id: c.id,
              label: c.label,
              note: `${c.category} · ${c.severity}`,
              source: c.source,
              confidence: c.confidence,
              status: c.status,
            }))}
          />
        </div>
      </section>

      {/* ── Patterns ──────────────────────────────────────────────────── */}
      {patterns.length > 0 && (
        <section>
          <SectionLabel>Behavioural tendencies observed</SectionLabel>
          <p className="type-small mt-1 mb-3 text-ink-muted">
            Observations about behaviour, never diagnoses.
          </p>
          <ul className="space-y-3">
            {patterns.map((p) => (
              <li key={p.id}>
                <Card>
                  <CardHeader>
                    <CardTitle as="h3">{p.label}</CardTitle>
                    <ProvenanceChip source={p.source} confidence={p.confidence} />
                  </CardHeader>
                  <CardBody className="space-y-1.5">
                    <p className="type-body text-ink">{p.pattern}</p>
                    {p.trigger && (
                      <p className="type-small text-ink-muted">Trigger: {p.trigger}</p>
                    )}
                    {p.impact && <p className="type-small text-ink-muted">Impact: {p.impact}</p>}
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Memory ────────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Memory</SectionLabel>
        <p className="type-small mt-1 mb-3 text-ink-muted">
          Stable things rarely change. Dynamic things track your current situation. Episodic
          entries are moments worth remembering.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <MemoryCard title="Stable" items={memory.stable} />
          <MemoryCard title="Dynamic" items={memory.dynamic} />
          <MemoryCard title="Episodic" items={memory.episodic} />
        </div>
      </section>
    </div>
  );
}

function ClaimList({
  title,
  table,
  items,
}: {
  title: string;
  table: 'values' | 'strengths' | 'constraints' | 'non_negotiables';
  items: Array<{
    id: string;
    label: string;
    note: string | null;
    source: SourceKind;
    confidence: number;
    status: string;
  }>;
}) {
  const visible = items.filter((i) => i.status !== 'rejected');
  if (visible.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">{title}</CardTitle>
      </CardHeader>
      <CardBody>
        <ul className="space-y-3">
          {visible.map((item) => (
            <li key={item.id}>
              <ClaimRow
                id={item.id}
                table={table}
                label={item.label}
                note={item.note}
                source={item.source}
                confidence={item.confidence}
              />
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function MemoryCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ key: string; value: string; confidence?: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">{title}</CardTitle>
        <Badge tone="neutral">{items.length}</Badge>
      </CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <p className="type-small text-ink-faint">Nothing recorded yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {items.slice(0, 8).map((item) => (
              <li key={item.key}>
                <p className="type-label text-ink-faint">{item.key.replace(/_/g, ' ')}</p>
                <p className="type-small mt-0.5 text-ink">{item.value}</p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
