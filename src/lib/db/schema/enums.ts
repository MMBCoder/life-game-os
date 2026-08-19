import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Postgres enums mirroring src/schemas/common.ts. The Zod schemas are the app's
 * source of truth; these keep the database from accepting anything the app would
 * reject. Adding a value requires a migration, which is the intent — these are
 * product vocabulary, not free text.
 */

export const sourceKindEnum = pgEnum('source_kind', [
  'user_said',
  'user_confirmed',
  'ai_inferred',
  'ai_suggested',
  'ai_generated',
]);

export const itemStatusEnum = pgEnum('item_status', [
  'draft',
  'suggested',
  'confirmed',
  'rejected',
  'archived',
]);

export const severityEnum = pgEnum('severity', ['low', 'medium', 'high', 'critical']);

export const likelihoodEnum = pgEnum('likelihood', ['low', 'medium', 'high']);

export const magnitudeEnum = pgEnum('magnitude', ['low', 'medium', 'high']);

export const memoryLayerEnum = pgEnum('memory_layer', ['stable', 'dynamic', 'episodic']);

export const operatingStateEnum = pgEnum('operating_state', [
  'drifting',
  'stretched',
  'surviving',
  'stabilising',
  'engaged',
  'focused',
  'flowing',
  'expanding',
]);

export const planModeEnum = pgEnum('plan_mode', ['minimum', 'standard', 'expansion']);

export const goalDimensionEnum = pgEnum('goal_dimension', [
  'result',
  'experience',
  'impact',
  'identity',
]);

export const leverageCategoryEnum = pgEnum('leverage_category', [
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

export const ritualCategoryEnum = pgEnum('ritual_category', [
  'energy',
  'mind',
  'gratitude',
  'support',
  'purpose',
  'creativity',
  'relationships',
]);

export const routineSlotEnum = pgEnum('routine_slot', [
  'morning',
  'work',
  'transition',
  'evening',
  'weekly',
  'monthly',
]);

export const decisionVerdictEnum = pgEnum('decision_verdict', [
  'take',
  'decline',
  'delegate',
  'defer',
  'renegotiate',
]);

export const actionKindEnum = pgEnum('action_kind', [
  'strategic',
  'health',
  'relationship',
  'admin',
]);

export const actionStatusEnum = pgEnum('action_status', [
  'planned',
  'done',
  'skipped',
  'moved',
]);

export const agentIdEnum = pgEnum('agent_id', [
  'orchestrator',
  'identity',
  'reality',
  'goal',
  'player',
  'strategy',
  'health',
  'relationships',
  'capacity',
  'redTeam',
  'execution',
  'reflection',
  'adaptation',
]);

export const councilPurposeEnum = pgEnum('council_purpose', [
  'onboarding_snapshot',
  'life_map_estimate',
  'whole_goal',
  'player_design',
  'game_design',
  'plan_review',
  'decision',
  'protocol_design',
  'daily_plan',
  'daily_reflection',
  'weekly_review',
  'monthly_review',
  'adaptation',
  'insight_plan',
]);

export const runStatusEnum = pgEnum('run_status', [
  'running',
  'succeeded',
  'partial',
  'failed',
]);

export const conflictKindEnum = pgEnum('conflict_kind', [
  'non_negotiable_breach',
  'guardian_veto',
  'capacity_overrun',
  'priority_overload',
  'contradictory_change',
  'red_team_block',
]);

export const councilVerdictEnum = pgEnum('council_verdict', [
  'approve',
  'approve_with_changes',
  'reject',
  'defer',
]);

export const constraintCategoryEnum = pgEnum('constraint_category', [
  'time',
  'energy',
  'financial',
  'responsibility',
  'environment',
  'skill',
]);

export const hardnessEnum = pgEnum('hardness', ['firm', 'strong', 'preference']);

export const reflectionKindEnum = pgEnum('reflection_kind', ['daily', 'weekly', 'monthly']);

export const insightKindEnum = pgEnum('insight_kind', [
  'insight',
  'pattern',
  'opportunity',
  'risk',
]);

export const gameStatusEnum = pgEnum('game_status', [
  'draft',
  'active',
  'completed',
  'recalibrating',
  'abandoned',
]);

export const sacrificeVerdictEnum = pgEnum('sacrifice_verdict', [
  'balanced',
  'watch',
  'warning',
]);

export const recommendationStatusEnum = pgEnum('recommendation_status', [
  'suggested',
  'accepted',
  'rejected',
  'applied',
]);

export const userResponseEnum = pgEnum('user_response', ['accepted', 'rejected', 'unsure']);

export const observationChannelEnum = pgEnum('observation_channel', [
  'conversation',
  'reflection',
  'decision',
  'rating',
  'onboarding',
]);
