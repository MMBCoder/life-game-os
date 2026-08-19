import { z } from 'zod';
import {
  confidence,
  decisionVerdict,
  leverageCategory,
  planMode,
  ritualCategory,
  routineSlot,
  score10,
  severity,
  sourceKind,
} from './common';

/* ═══════════════════════════════════════════════════════════════════════════
   Artefact generation contracts.
   These are the structured-output schemas the agents fill. Each one is compiled
   to JSON Schema for the model and re-validated on the way back.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Onboarding ─────────────────────────────────────────────────────────────*/

/**
 * The Personal Snapshot: what the system believes after three questions.
 * Every field is explicitly provisional so the UI can ask "how close did we get?"
 * rather than presenting inference as fact.
 */
export const personalSnapshot = z.object({
  headline: z.string().min(10).max(220),
  likelyPriorities: z
    .array(
      z.object({
        domainKey: z.string().min(2).max(40),
        why: z.string().min(8).max(300),
        confidence,
      }),
    )
    .min(1)
    .max(5),
  likelyGoal: z.object({
    title: z.string().min(5).max(200),
    horizonMonths: z.number().int().min(1).max(60),
    why: z.string().min(8).max(400),
    confidence,
  }),
  likelyConstraints: z
    .array(
      z.object({
        label: z.string().min(3).max(140),
        category: z.enum([
          'time',
          'energy',
          'financial',
          'responsibility',
          'environment',
          'skill',
        ]),
        severity,
        confidence,
      }),
    )
    .max(6)
    .default([]),
  possibleTension: z.object({
    statement: z.string().min(10).max(400),
    confidence,
  }),
  possibleOpportunity: z.object({
    statement: z.string().min(10).max(400),
    confidence,
  }),
  identityShift: z.object({
    from: z.string().min(3).max(160),
    to: z.string().min(3).max(160),
    confidence,
  }),
  nonNegotiables: z
    .array(
      z.object({
        label: z.string().min(3).max(140),
        hardness: z.enum(['firm', 'strong', 'preference']),
        confidence,
      }),
    )
    .max(8)
    .default([]),
});
export type PersonalSnapshot = z.infer<typeof personalSnapshot>;

/* ── Life Map ───────────────────────────────────────────────────────────────*/

/**
 * AI-estimated domain scores. The user confirms with [Lower][About right][Higher]
 * rather than filling in ninety sliders — the minimal-input law applied to data entry.
 */
export const lifeScoreEstimate = z.object({
  domainKey: z.string().min(2).max(40),
  currentExperience: score10,
  desiredExperience: score10,
  outerResult: score10,
  innerExperience: score10,
  importance: score10,
  energy: score10,
  satisfaction: score10,
  risk: score10,
  momentum: score10,
  basis: z.string().min(8).max(400),
  confidence,
});
export type LifeScoreEstimate = z.infer<typeof lifeScoreEstimate>;

export const lifeMapEstimate = z.object({
  scores: z.array(lifeScoreEstimate).min(1).max(16),
  divergences: z
    .array(
      z.object({
        domainKey: z.string().min(2).max(40),
        statement: z.string().min(10).max(500),
        gap: z.number(),
        confidence,
      }),
    )
    .max(10)
    .default([]),
});
export type LifeMapEstimate = z.infer<typeof lifeMapEstimate>;

/* ── Whole Goal ─────────────────────────────────────────────────────────────*/

export const wholeGoalDraft = z.object({
  title: z.string().min(5).max(200),
  result: z.string().min(10).max(700),
  experience: z.string().min(10).max(700),
  impact: z.string().min(10).max(700),
  identity: z.string().min(10).max(700),
  horizonMonths: z.number().int().min(1).max(60),
  domainKey: z.string().min(2).max(40),
  /** Asked only if genuinely undetermined by context. */
  clarifyingQuestion: z.string().max(280).nullable().default(null),
  confidence,
});
export type WholeGoalDraft = z.infer<typeof wholeGoalDraft>;

/* ── Player ─────────────────────────────────────────────────────────────────*/

export const playerDraft = z.object({
  name: z.string().min(3).max(60),
  identity: z.string().min(10).max(400),
  intention: z.string().min(10).max(300),
  mantra: z.string().min(5).max(140),
  attitude: z.array(z.string().min(2).max(40)).min(2).max(6),
  actions: z.array(z.string().min(3).max(160)).min(3).max(7),
  agreements: z.array(z.string().min(5).max(220)).min(3).max(7),
  boundaries: z.array(z.string().min(5).max(220)).min(1).max(6),
  strengths: z.array(z.string().min(3).max(120)).min(2).max(6),
  watchOuts: z.array(z.string().min(3).max(200)).min(1).max(5),
  whyThisFits: z.string().min(20).max(700),
  confidence,
});
export type PlayerDraft = z.infer<typeof playerDraft>;

/** Three candidates, because the user chooses their Player — the system proposes. */
export const playerOptions = z.object({
  options: z.array(playerDraft).min(2).max(4),
});
export type PlayerOptions = z.infer<typeof playerOptions>;

/* ── Ask My Player ──────────────────────────────────────────────────────────*/

export const playerDecision = z.object({
  verdict: decisionVerdict,
  headline: z.string().min(5).max(200),
  reasoning: z.string().min(20).max(1200),
  conflictsWith: z.array(z.string().min(3).max(160)).max(6).default([]),
  supports: z.array(z.string().min(3).max(160)).max(6).default([]),
  betterMove: z.string().min(10).max(600),
  opportunityCost: z.string().min(10).max(500),
  confidence,
});
export type PlayerDecision = z.infer<typeof playerDecision>;

/* ── Game ───────────────────────────────────────────────────────────────────*/

export const boldResultDraft = z.object({
  title: z.string().min(5).max(200),
  dayMarker: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  successDefinition: z.string().min(10).max(600),
  evidence: z.array(z.string().min(3).max(200)).min(1).max(5),
  leadingIndicators: z.array(z.string().min(3).max(200)).min(1).max(5),
  dependencies: z.array(z.string().min(3).max(200)).max(5).default([]),
  risks: z.array(z.string().min(3).max(200)).max(5).default([]),
  confidence,
  owner: z.string().min(2).max(80).default('me'),
});
export type BoldResultDraft = z.infer<typeof boldResultDraft>;

export const strategicMoveDraft = z.object({
  title: z.string().min(5).max(200),
  detail: z.string().min(10).max(700),
  leverageCategory: leverageCategory,
  expectedImpact: z.enum(['low', 'medium', 'high']),
  effort: z.enum(['low', 'medium', 'high']),
});
export type StrategicMoveDraft = z.infer<typeof strategicMoveDraft>;

export const gameDraft = z.object({
  /** The Strategy Agent offers names; the user picks one. */
  nameOptions: z.array(z.string().min(3).max(60)).min(3).max(5),
  name: z.string().min(3).max(60),
  purpose: z.string().min(20).max(700),
  winningDefinition: z.string().min(20).max(700),
  /** The differentiator: what winning explicitly does NOT require. */
  nonWinningDefinition: z.string().min(20).max(700),
  strategicObjective: z.string().min(20).max(700),
  boldResults: z.array(boldResultDraft).length(3),
  strategicMoves: z.array(strategicMoveDraft).min(2).max(6),
  stopList: z
    .array(
      z.object({
        text: z.string().min(8).max(240),
        reason: z.string().min(8).max(400),
      }),
    )
    .min(2)
    .max(7),
  protectList: z
    .array(
      z.object({
        text: z.string().min(5).max(240),
        reason: z.string().min(8).max(400),
      }),
    )
    .min(1)
    .max(7),
  risks: z
    .array(
      z.object({
        title: z.string().min(5).max(200),
        detail: z.string().min(10).max(500),
        severity,
        likelihood: z.enum(['low', 'medium', 'high']),
        mitigation: z.string().min(8).max(400),
      }),
    )
    .max(6)
    .default([]),
  squad: z
    .array(
      z.object({
        role: z.string().min(3).max(100),
        canHelpWith: z.string().min(5).max(300),
        askDraft: z.string().min(10).max(400),
      }),
    )
    .max(5)
    .default([]),
  /** "Why this plan?" — required, never empty. */
  whyThisPlan: z.string().min(40).max(1600),
  /** "What we are not doing." — required, never empty. */
  intentionalOmissions: z.array(z.string().min(8).max(300)).min(2).max(8),
  confidence,
});
export type GameDraft = z.infer<typeof gameDraft>;

/* ── Sacrifice Radar ────────────────────────────────────────────────────────*/

/**
 * Cost of a plan across domains, −3 (severe cost) to +3 (strong gain).
 * `verdict` is computed deterministically in src/lib/scoring, not by the model —
 * protection must be reliable, not probabilistic.
 */
export const sacrificeAssessment = z.object({
  scores: z.array(
    z.object({
      domainKey: z.string().min(2).max(40),
      delta: z.number().int().min(-3).max(3),
      why: z.string().min(8).max(400),
    }),
  ),
  alternatives: z
    .array(
      z.object({
        title: z.string().min(5).max(200),
        detail: z.string().min(10).max(600),
        leverage: leverageCategory,
        /** Ambition is never lowered; only the method changes. */
        preservesAmbition: z.literal(true),
      }),
    )
    .max(4)
    .default([]),
  confidence,
});
export type SacrificeAssessment = z.infer<typeof sacrificeAssessment>;

/* ── Protocol ───────────────────────────────────────────────────────────────*/

export const protocolDraft = z.object({
  items: z
    .array(
      z.object({
        domainKey: z.string().min(2).max(40),
        label: z.string().min(3).max(120),
        minimum: z.string().min(3).max(240),
        standard: z.string().min(3).max(240),
        expansion: z.string().min(3).max(240),
      }),
    )
    .min(3)
    .max(8),
  rituals: z
    .array(
      z.object({
        category: ritualCategory,
        name: z.string().min(3).max(120),
        detail: z.string().min(10).max(500),
        cadence: z.string().min(3).max(80),
        /** Personalised justification — never a generic ritual list. */
        whyThisFits: z.string().min(15).max(500),
      }),
    )
    .min(2)
    .max(6),
  routines: z
    .array(
      z.object({
        slot: routineSlot,
        name: z.string().min(3).max(120),
        steps: z.array(z.string().min(3).max(160)).min(2).max(7),
        durationMinutes: z.number().int().min(2).max(240),
      }),
    )
    .min(2)
    .max(6),
  confidence,
});
export type ProtocolDraft = z.infer<typeof protocolDraft>;

/* ── Daily Play ─────────────────────────────────────────────────────────────*/

export const dailyPlan = z.object({
  /** Exactly three: one strategic, one self/health, one relationship. */
  moves: z
    .array(
      z.object({
        title: z.string().min(5).max(180),
        kind: z.enum(['strategic', 'health', 'relationship']),
        why: z.string().min(8).max(300),
        timeMinutes: z.number().int().min(5).max(240),
        energyCost: z.enum(['low', 'medium', 'high']),
      }),
    )
    .length(3),
  councilNote: z.string().min(20).max(500),
  suggestedMode: planMode,
  oneDecision: z.string().min(10).max(300),
  confidence,
});
export type DailyPlan = z.infer<typeof dailyPlan>;

/* ── State & Momentum ───────────────────────────────────────────────────────*/

export const stateAssessment = z.object({
  state: z.enum([
    'drifting',
    'stretched',
    'surviving',
    'stabilising',
    'engaged',
    'focused',
    'flowing',
    'expanding',
  ]),
  confidence,
  drivers: z.array(z.string().min(3).max(200)).min(2).max(6),
  focus: score10,
  energy: score10,
  alignment: score10,
  capacity: score10,
});
export type StateAssessment = z.infer<typeof stateAssessment>;

/* ── Reflection ─────────────────────────────────────────────────────────────*/

export const weeklyIntelligence = z.object({
  progress: z.string().min(20).max(800),
  pattern: z.object({
    statement: z.string().min(15).max(500),
    confidence,
    hypothesis: z.literal(true),
  }),
  risk: z.string().min(15).max(500),
  insight: z.string().min(15).max(600),
  recommendedAdjustment: z.object({
    title: z.string().min(5).max(200),
    detail: z.string().min(15).max(700),
    leverage: leverageCategory.optional(),
  }),
  nextThreeMoves: z.array(z.string().min(8).max(200)).length(3),
  confidence,
});
export type WeeklyIntelligence = z.infer<typeof weeklyIntelligence>;

export const monthlyReview = z.object({
  comparison: z.string().min(30).max(1200),
  domainMovement: z
    .array(
      z.object({
        domainKey: z.string().min(2).max(40),
        direction: z.enum(['up', 'flat', 'down']),
        note: z.string().min(8).max(400),
      }),
    )
    .max(12)
    .default([]),
  /** The question that stops users pursuing an outdated goal. */
  stillTheRightGame: z.object({
    verdict: z.enum(['continue', 'adjust', 'simplify', 'change_game']),
    reasoning: z.string().min(30).max(1200),
    confidence,
  }),
  recommendations: z
    .array(
      z.object({
        title: z.string().min(5).max(200),
        detail: z.string().min(10).max(700),
      }),
    )
    .max(5)
    .default([]),
});
export type MonthlyReview = z.infer<typeof monthlyReview>;

/* ── Insight plan & blind spots ─────────────────────────────────────────────*/

export const INSIGHT_SECTIONS = [
  'Who I Am',
  'What Matters to Me',
  'What Gives Me Energy',
  'What Drains Me',
  'What I Naturally Do Well',
  'What I Tend To Overdo',
  'What I Avoid',
  'My Current Reality',
  'My Biggest Opportunity',
  'My Biggest Risk',
  'My Identity Shift',
  'What I Need To Stop',
  'What I Need To Start',
  'What I Need To Protect',
  'What I Need To Practise',
  'What I Need To Learn',
  'What I Need To Delegate',
  'What I Need To Say No To',
] as const;

export const insightPlanDraft = z.object({
  sections: z
    .array(
      z.object({
        title: z.string().min(3).max(80),
        body: z.string().min(20).max(1200),
        source: sourceKind,
        confidence,
      }),
    )
    .min(6)
    .max(20),
});
export type InsightPlanDraft = z.infer<typeof insightPlanDraft>;

export const blindSpotDraft = z.object({
  blindSpots: z
    .array(
      z.object({
        /** Always framed as a hypothesis. Never a diagnosis. */
        hypothesis: z.string().min(15).max(400),
        detail: z.string().min(20).max(800),
        confidence,
        basedOn: z.array(z.string().min(5).max(240)).min(1).max(5),
      }),
    )
    .max(5),
});
export type BlindSpotDraft = z.infer<typeof blindSpotDraft>;

/* ── Adaptation ─────────────────────────────────────────────────────────────*/

export const adaptationPlan = z.object({
  trigger: z.string().min(10).max(400),
  affected: z
    .array(z.enum(['goal', 'strategy', 'player', 'protocol', 'milestones', 'priorities']))
    .min(1),
  recommendation: z.enum(['continue', 'adjust', 'simplify', 'recalibrate']),
  headline: z.string().min(10).max(240),
  reasoning: z.string().min(30).max(1200),
  changes: z
    .array(
      z.object({
        area: z.enum(['goal', 'strategy', 'player', 'protocol', 'milestones', 'priorities']),
        change: z.string().min(10).max(500),
        why: z.string().min(10).max(500),
      }),
    )
    .min(1)
    .max(8),
  confidence,
});
export type AdaptationPlan = z.infer<typeof adaptationPlan>;

/* ── Reset ──────────────────────────────────────────────────────────────────*/

export const resetOptions = z.object({
  acknowledgement: z.string().min(15).max(400),
  options: z
    .array(
      z.object({
        title: z.string().min(5).max(160),
        detail: z.string().min(10).max(500),
        effort: z.enum(['low', 'medium', 'high']),
      }),
    )
    .length(3),
});
export type ResetOptions = z.infer<typeof resetOptions>;

/* ── Suggestion engine ──────────────────────────────────────────────────────*/

/**
 * Law 2: no bare empty field. Every input can request contextual suggestions
 * that reference the user's actual model, not generic advice.
 */
export const suggestionSet = z.object({
  suggestions: z
    .array(
      z.object({
        text: z.string().min(3).max(300),
        /** Why this fits *this* person — the difference between "Exercise" and a real suggestion. */
        because: z.string().min(10).max(400),
      }),
    )
    .min(1)
    .max(6),
});
export type SuggestionSet = z.infer<typeof suggestionSet>;
