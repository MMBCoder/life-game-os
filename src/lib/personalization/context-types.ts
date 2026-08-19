import type { AgentId, CouncilPurpose } from '@/schemas/agent';
import type { OperatingState } from '@/schemas/common';

/**
 * Everything an agent is allowed to see. Assembled once per council run and shared
 * by every agent in it, so they argue about the same facts.
 *
 * Serialised as JSON into the prompt. That serialisation is also what the
 * deterministic mock provider reads, which is why the shape is explicit rather than
 * prose — it makes the offline provider genuinely personalised (decisions.md D5).
 */
export interface CouncilContext {
  purpose: CouncilPurpose;
  user: {
    name: string;
    timezone: string;
    /** Resolved server-side from the user's zone — see decisions.md D11. */
    today: string;
  };
  profile: {
    role: string | null;
    lifeStage: string | null;
    onboardingStage: string;
  };
  identity: {
    current: string | null;
    emerging: string | null;
    desired: string | null;
    tensions: string[];
    motivators: string[];
    fears: string[];
    tendencies: string[];
  } | null;
  values: Array<{ label: string; kind: 'value' | 'principle'; importance: number; source: string }>;
  strengths: Array<{ label: string; kind: 'strength' | 'overdone' }>;
  constraints: Array<{ label: string; category: string; severity: string }>;
  nonNegotiables: Array<{
    label: string;
    domainKey: string | null;
    hardness: 'firm' | 'strong' | 'preference';
  }>;
  patterns: Array<{
    label: string;
    pattern: string;
    trigger: string | null;
    impact: string | null;
    confidence: number;
  }>;
  domains: Array<{
    key: string;
    label: string;
    scores: DomainScores | null;
  }>;
  goal: {
    title: string;
    rawInput: string | null;
    horizonMonths: number;
    domainKey: string | null;
    wholeGoal: {
      result: string;
      experience: string;
      impact: string;
      identity: string;
    } | null;
  } | null;
  player: {
    name: string;
    identity: string;
    intention: string;
    mantra: string;
    agreements: string[];
    boundaries: string[];
  } | null;
  game: {
    name: string;
    purpose: string;
    winningDefinition: string;
    nonWinningDefinition: string;
    strategicObjective: string;
    startDate: string;
    endDate: string;
    boldResults: Array<{ title: string; dayMarker: number; progress: number }>;
    strategicMoves: Array<{ title: string; leverageCategory: string | null }>;
    stopList: string[];
    protectList: string[];
    healthScore: number | null;
  } | null;
  protocol: {
    items: Array<{
      domainKey: string | null;
      label: string;
      minimum: string;
      standard: string;
      expansion: string;
    }>;
    ritualCount: number;
    routineCount: number;
  } | null;
  /**
   * Time and energy are tracked separately and deliberately. Two free hours with no
   * mental capacity is not two hours of capacity (spec §28).
   */
  capacity: {
    availableHoursPerWeek: number;
    committedHoursPerWeek: number;
    load: number;
    energyLevel: number;
    /** Deterministically computed; agents may argue about it but not invent it. */
    verdict: 'headroom' | 'balanced' | 'tight' | 'overloaded';
  };
  state: {
    operatingState: OperatingState;
    momentum: number;
    focus: number;
    energy: number;
    alignment: number;
  } | null;
  recentReflections: Array<{
    kind: string;
    periodEnd: string;
    moved: string[];
    didntMove: string[];
    feeling: string | null;
    costMoreThanExpected: string | null;
    gaveEnergy: string | null;
  }>;
  recentDecisions: Array<{ question: string; verdict: string; decidedAt: string }>;
  memory: {
    stable: Array<{ key: string; value: string; confidence: number }>;
    dynamic: Array<{ key: string; value: string; confidence: number }>;
    episodic: Array<{ key: string; value: string; episodeAt: string | null }>;
  };
  /** Run-specific input: the decision being asked about, onboarding answers, etc. */
  ask: {
    question: string | null;
    detail: string | null;
    payload: Record<string, unknown>;
  };
  /**
   * Populated for the Red Team and the Orchestrator only. Without peer output there
   * is nothing to attack or reconcile, and the council would be thirteen monologues.
   */
  peerOutputs: Array<{
    agent: AgentId;
    summary: string;
    confidence: number;
    recommendations: string[];
    risks: string[];
    objections: Array<{ against: AgentId; claim: string; severity: string }>;
  }>;
}

export interface DomainScores {
  currentExperience: number;
  desiredExperience: number;
  outerResult: number;
  innerExperience: number;
  importance: number;
  energy: number;
  satisfaction: number;
  risk: number;
  momentum: number;
}

export const CONTEXT_OPEN = '<<<CONTEXT_JSON>>>';
export const CONTEXT_CLOSE = '<<<END_CONTEXT_JSON>>>';

/** Embeds the context in a prompt in a form both a model and the mock can read. */
export function serialiseContext(ctx: CouncilContext): string {
  return `${CONTEXT_OPEN}\n${JSON.stringify(ctx, null, 2)}\n${CONTEXT_CLOSE}`;
}

/** Recovers the context from a prompt. Used by the deterministic mock provider. */
export function parseContext(prompt: string): CouncilContext | null {
  const start = prompt.indexOf(CONTEXT_OPEN);
  const end = prompt.indexOf(CONTEXT_CLOSE);
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(prompt.slice(start + CONTEXT_OPEN.length, end)) as CouncilContext;
  } catch {
    return null;
  }
}
