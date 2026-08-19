import type { DomainScores } from '@/lib/personalization/context-types';

/**
 * Outer Win vs Inner Win — the product's signature insight mechanism.
 *
 * A domain performing strongly on the outside while degrading on the inside is the
 * single most useful signal the system has: it means the strategy is working and is
 * being funded by something nobody has priced.
 */

export interface DomainInput {
  key: string;
  label: string;
  scores: DomainScores;
}

export interface Divergence {
  key: string;
  label: string;
  /** outerResult − innerExperience. Positive: looks better than it feels. */
  divergence: number;
  /** desiredExperience − currentExperience. */
  gap: number;
  kind: DivergenceKind;
  severity: 'low' | 'medium' | 'high';
  statement: string;
}

export type DivergenceKind =
  | 'unsustainable_success' // strong outside, weak inside
  | 'quiet_contentment' // weak outside, strong inside
  | 'neglected_priority' // important, large gap
  | 'aligned';

const SIGNIFICANT = 2;

export function analyseDivergence(domains: DomainInput[]): Divergence[] {
  return domains
    .map((domain) => {
      const { outerResult, innerExperience, desiredExperience, currentExperience, importance } =
        domain.scores;
      const divergence = round(outerResult - innerExperience);
      const gap = round(desiredExperience - currentExperience);

      const kind: DivergenceKind =
        divergence >= SIGNIFICANT && outerResult >= 6
          ? 'unsustainable_success'
          : divergence <= -SIGNIFICANT
            ? 'quiet_contentment'
            : gap >= 3 && importance >= 7
              ? 'neglected_priority'
              : 'aligned';

      return {
        key: domain.key,
        label: domain.label,
        divergence,
        gap,
        kind,
        severity: severityFor(kind, divergence, gap, importance),
        statement: statementFor(domain.label, kind, domain.scores),
      };
    })
    .filter((d) => d.kind !== 'aligned')
    .sort((a, b) => rank(b) - rank(a));
}

function severityFor(
  kind: DivergenceKind,
  divergence: number,
  gap: number,
  importance: number,
): Divergence['severity'] {
  if (kind === 'aligned') return 'low';
  const magnitude = Math.max(Math.abs(divergence), gap);
  const weighted = magnitude * (importance / 10);
  if (weighted >= 3) return 'high';
  if (weighted >= 1.8) return 'medium';
  return 'low';
}

function statementFor(label: string, kind: DivergenceKind, s: DomainScores): string {
  switch (kind) {
    case 'unsustainable_success':
      return `${label} is performing strongly externally (${s.outerResult.toFixed(1)}) but the experience of it is deteriorating (${s.innerExperience.toFixed(1)}). Your current strategy here may be producing results at an unsustainable cost.`;
    case 'quiet_contentment':
      return `${label} feels better (${s.innerExperience.toFixed(1)}) than it looks on paper (${s.outerResult.toFixed(1)}). Worth checking whether the external measure is one you actually care about.`;
    case 'neglected_priority':
      return `You rate ${label} as highly important (${s.importance.toFixed(1)}) and it is currently at ${s.currentExperience.toFixed(1)} against a desired ${s.desiredExperience.toFixed(1)}. This is the largest stated gap between what matters and what is happening.`;
    default:
      return `${label} is broadly aligned.`;
  }
}

function rank(d: Divergence): number {
  const bySeverity = { high: 3, medium: 2, low: 1 }[d.severity];
  const byKind = d.kind === 'unsustainable_success' ? 1.5 : 1;
  return bySeverity * byKind;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
