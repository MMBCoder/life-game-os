import type { AgentId, CouncilPurpose } from '@/schemas/agent';

/**
 * Agent routing. The orchestrator never runs all thirteen agents — routing is the
 * primary cost control (spec §56).
 *
 * Purely computational work (a slider change, a momentum recompute, a capacity
 * meter) is absent from this table entirely: it runs no agents at all and is handled
 * by src/lib/scoring.
 */
const ROUTES: Record<CouncilPurpose, AgentId[]> = {
  onboarding_snapshot: ['identity', 'reality', 'goal'],
  life_map_estimate: ['reality', 'identity'],
  whole_goal: ['goal', 'identity', 'capacity'],
  player_design: ['player', 'identity', 'strategy'],
  game_design: ['strategy', 'capacity', 'health', 'relationships', 'redTeam', 'orchestrator'],
  plan_review: ['strategy', 'capacity', 'health', 'relationships', 'redTeam', 'orchestrator'],
  decision: ['strategy', 'capacity', 'health', 'relationships', 'redTeam', 'orchestrator'],
  protocol_design: ['execution', 'health', 'capacity'],
  daily_plan: ['execution', 'capacity'],
  daily_reflection: ['reflection', 'adaptation'],
  weekly_review: ['reflection', 'capacity', 'strategy', 'adaptation'],
  monthly_review: [
    'reflection',
    'strategy',
    'health',
    'relationships',
    'adaptation',
    'orchestrator',
  ],
  adaptation: ['adaptation', 'strategy', 'capacity', 'orchestrator'],
  insight_plan: ['identity', 'reality', 'reflection'],
};

/**
 * Agents that only make sense once their peers have produced something to react to.
 * They run in a second pass, with the first pass's outputs in their context.
 */
export const SECOND_PASS: readonly AgentId[] = ['redTeam', 'orchestrator'];

export interface RoutePlan {
  firstPass: AgentId[];
  secondPass: AgentId[];
  /** True when the run warrants full council treatment rather than a light pass. */
  isSignificant: boolean;
}

export function route(purpose: CouncilPurpose, maxAgents: number): RoutePlan {
  const all = ROUTES[purpose] ?? ['orchestrator'];
  const firstPass = all.filter((a) => !SECOND_PASS.includes(a));
  const secondPass = all.filter((a) => SECOND_PASS.includes(a));

  // The cap trims the first pass only. Dropping the Red Team or the Orchestrator to
  // save cost would remove exactly the scrutiny that makes the recommendation safe.
  const budget = Math.max(1, maxAgents - secondPass.length);

  return {
    firstPass: firstPass.slice(0, budget),
    secondPass,
    isSignificant: secondPass.includes('redTeam'),
  };
}

export function agentsFor(purpose: CouncilPurpose): AgentId[] {
  return ROUTES[purpose] ?? [];
}
