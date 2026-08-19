import { GUARDIAN_AGENTS, type AgentId, type CouncilPurpose } from '@/schemas/agent';

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

  // The cap is a cost guard, and cost is never a reason to remove scrutiny. Three
  // groups are exempt from it:
  //
  //   Red Team + Orchestrator   the second pass, which finds how the plan fails and
  //                             then resolves it
  //   Health + Relationship     the guardians, the only agents holding a veto
  //
  // Trimming by list position instead would quietly drop the guardians first on a
  // low cap — removing the veto holders to save a few cents, on the exact runs where
  // a plan is most likely to be overreaching.
  const guardians = firstPass.filter((a) => GUARDIAN_AGENTS.includes(a));
  const trimmable = firstPass.filter((a) => !GUARDIAN_AGENTS.includes(a));

  // At least one non-guardian always runs: a council of only vetoes has nothing to
  // vote on. If that pushes the total past the cap, the cap yields.
  const budget = Math.max(1, maxAgents - secondPass.length - guardians.length);
  const kept = new Set<AgentId>([...trimmable.slice(0, budget), ...guardians]);

  return {
    // Filtered from the original list so ordering stays stable and readable.
    firstPass: firstPass.filter((a) => kept.has(a)),
    secondPass,
    isSignificant: secondPass.includes('redTeam'),
  };
}

export function agentsFor(purpose: CouncilPurpose): AgentId[] {
  return ROUTES[purpose] ?? [];
}
