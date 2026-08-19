import { z } from 'zod';

/**
 * Provenance. The product's third law: an inference is never rendered as a fact.
 * These values are the mechanism, not a label — repositories refuse to let an
 * agent overwrite a row whose source is `user_said` or `user_confirmed`.
 */
export const sourceKind = z.enum([
  'user_said',
  'user_confirmed',
  'ai_inferred',
  'ai_suggested',
  'ai_generated',
]);
export type SourceKind = z.infer<typeof sourceKind>;

/** Sources whose authority exceeds any model inference. */
export const USER_AUTHORED: readonly SourceKind[] = ['user_said', 'user_confirmed'];

export const itemStatus = z.enum([
  'draft',
  'suggested',
  'confirmed',
  'rejected',
  'archived',
]);
export type ItemStatus = z.infer<typeof itemStatus>;

export const severity = z.enum(['low', 'medium', 'high', 'critical']);
export type Severity = z.infer<typeof severity>;

export const SEVERITY_RANK: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const memoryLayer = z.enum(['stable', 'dynamic', 'episodic']);
export type MemoryLayer = z.infer<typeof memoryLayer>;

/**
 * Operating State. A dynamic state, never a personality label and never clinical.
 * Ordered from least to most intentional engagement.
 */
export const operatingState = z.enum([
  'drifting',
  'stretched',
  'surviving',
  'stabilising',
  'engaged',
  'focused',
  'flowing',
  'expanding',
]);
export type OperatingState = z.infer<typeof operatingState>;

export const OPERATING_STATE_LABEL: Record<OperatingState, string> = {
  drifting: 'Drifting',
  stretched: 'Stretched',
  surviving: 'Surviving',
  stabilising: 'Stabilising',
  engaged: 'Engaged',
  focused: 'Focused',
  flowing: 'Flowing',
  expanding: 'Expanding',
};

export const planMode = z.enum(['minimum', 'standard', 'expansion']);
export type PlanMode = z.infer<typeof planMode>;

export const goalDimension = z.enum(['result', 'experience', 'impact', 'identity']);
export type GoalDimension = z.infer<typeof goalDimension>;

/**
 * The fifteen leverage categories the Leverage Engine tests before it will accept
 * "more effort" as a strategy.
 */
export const leverageCategory = z.enum([
  'delegation',
  'automation',
  'systems',
  'relationships',
  'visibility',
  'positioning',
  'technology',
  'communication',
  'focus',
  'elimination',
  'sequencing',
  'negotiation',
  'environment',
  'expertise',
  'sponsorship',
]);
export type LeverageCategory = z.infer<typeof leverageCategory>;

export const LEVERAGE_LABEL: Record<LeverageCategory, string> = {
  delegation: 'Delegation',
  automation: 'Automation',
  systems: 'Systems',
  relationships: 'Relationships',
  visibility: 'Visibility',
  positioning: 'Positioning',
  technology: 'Technology',
  communication: 'Communication',
  focus: 'Focus',
  elimination: 'Elimination',
  sequencing: 'Sequencing',
  negotiation: 'Negotiation',
  environment: 'Environment',
  expertise: 'Expertise',
  sponsorship: 'Sponsorship',
};

export const ritualCategory = z.enum([
  'energy',
  'mind',
  'gratitude',
  'support',
  'purpose',
  'creativity',
  'relationships',
]);
export type RitualCategory = z.infer<typeof ritualCategory>;

export const routineSlot = z.enum([
  'morning',
  'work',
  'transition',
  'evening',
  'weekly',
  'monthly',
]);
export type RoutineSlot = z.infer<typeof routineSlot>;

export const decisionVerdict = z.enum([
  'take',
  'decline',
  'delegate',
  'defer',
  'renegotiate',
]);
export type DecisionVerdict = z.infer<typeof decisionVerdict>;

export const actionKind = z.enum(['strategic', 'health', 'relationship', 'admin']);
export type ActionKind = z.infer<typeof actionKind>;

/** A 0–10 self/AI rating, the product's universal scale. */
export const score10 = z.number().min(0).max(10);

/** Model confidence, always shown alongside any inference. */
export const confidence = z.number().min(0).max(1);

/** Where a claim came from, so "Why?" can always be answered. */
export const evidenceRef = z.object({
  kind: z.enum([
    'observation',
    'reflection',
    'life_score',
    'goal',
    'constraint',
    'non_negotiable',
    'memory',
    'decision',
    'game',
    'user_statement',
  ]),
  ref: z.string().min(1),
  note: z.string().max(300).optional(),
});
export type EvidenceRef = z.infer<typeof evidenceRef>;

export const DEFAULT_DOMAINS = [
  { key: 'self', label: 'Self' },
  { key: 'health', label: 'Health' },
  { key: 'family', label: 'Family' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'career', label: 'Career' },
  { key: 'finance', label: 'Financial Freedom' },
  { key: 'growth', label: 'Growth' },
  { key: 'purpose', label: 'Purpose' },
  { key: 'joy', label: 'Joy' },
  { key: 'impact', label: 'Impact' },
] as const;

export type DomainKey = (typeof DEFAULT_DOMAINS)[number]['key'];
