CREATE TYPE "public"."action_kind" AS ENUM('strategic', 'health', 'relationship', 'admin');--> statement-breakpoint
CREATE TYPE "public"."action_status" AS ENUM('planned', 'done', 'skipped', 'moved');--> statement-breakpoint
CREATE TYPE "public"."agent_id" AS ENUM('orchestrator', 'identity', 'reality', 'goal', 'player', 'strategy', 'health', 'relationships', 'capacity', 'redTeam', 'execution', 'reflection', 'adaptation');--> statement-breakpoint
CREATE TYPE "public"."conflict_kind" AS ENUM('non_negotiable_breach', 'guardian_veto', 'capacity_overrun', 'priority_overload', 'contradictory_change', 'red_team_block');--> statement-breakpoint
CREATE TYPE "public"."constraint_category" AS ENUM('time', 'energy', 'financial', 'responsibility', 'environment', 'skill');--> statement-breakpoint
CREATE TYPE "public"."council_purpose" AS ENUM('onboarding_snapshot', 'life_map_estimate', 'whole_goal', 'player_design', 'game_design', 'plan_review', 'decision', 'protocol_design', 'daily_plan', 'daily_reflection', 'weekly_review', 'monthly_review', 'adaptation', 'insight_plan');--> statement-breakpoint
CREATE TYPE "public"."council_verdict" AS ENUM('approve', 'approve_with_changes', 'reject', 'defer');--> statement-breakpoint
CREATE TYPE "public"."decision_verdict" AS ENUM('take', 'decline', 'delegate', 'defer', 'renegotiate');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('draft', 'active', 'completed', 'recalibrating', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."goal_dimension" AS ENUM('result', 'experience', 'impact', 'identity');--> statement-breakpoint
CREATE TYPE "public"."hardness" AS ENUM('firm', 'strong', 'preference');--> statement-breakpoint
CREATE TYPE "public"."insight_kind" AS ENUM('insight', 'pattern', 'opportunity', 'risk');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('draft', 'suggested', 'confirmed', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."leverage_category" AS ENUM('delegation', 'automation', 'systems', 'relationships', 'visibility', 'positioning', 'technology', 'communication', 'focus', 'elimination', 'sequencing', 'negotiation', 'environment', 'expertise', 'sponsorship');--> statement-breakpoint
CREATE TYPE "public"."likelihood" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."magnitude" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."memory_layer" AS ENUM('stable', 'dynamic', 'episodic');--> statement-breakpoint
CREATE TYPE "public"."observation_channel" AS ENUM('conversation', 'reflection', 'decision', 'rating', 'onboarding');--> statement-breakpoint
CREATE TYPE "public"."operating_state" AS ENUM('drifting', 'stretched', 'surviving', 'stabilising', 'engaged', 'focused', 'flowing', 'expanding');--> statement-breakpoint
CREATE TYPE "public"."plan_mode" AS ENUM('minimum', 'standard', 'expansion');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('suggested', 'accepted', 'rejected', 'applied');--> statement-breakpoint
CREATE TYPE "public"."reflection_kind" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."ritual_category" AS ENUM('energy', 'mind', 'gratitude', 'support', 'purpose', 'creativity', 'relationships');--> statement-breakpoint
CREATE TYPE "public"."routine_slot" AS ENUM('morning', 'work', 'transition', 'evening', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'succeeded', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sacrifice_verdict" AS ENUM('balanced', 'watch', 'warning');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('user_said', 'user_confirmed', 'ai_inferred', 'ai_suggested', 'ai_generated');--> statement-breakpoint
CREATE TYPE "public"."user_response" AS ENUM('accepted', 'rejected', 'unsure');--> statement-breakpoint
CREATE TABLE "behavioral_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"pattern" text NOT NULL,
	"trigger" text,
	"impact" text,
	"hypothesis" boolean DEFAULT true NOT NULL,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "constraints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"category" "constraint_category" NOT NULL,
	"severity" "severity" DEFAULT 'medium' NOT NULL,
	"note" text,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_identity" text,
	"emerging_identity" text,
	"desired_identity" text,
	"identity_tensions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"motivators" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fears" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"natural_tendencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"layer" "memory_layer" NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"context" text,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"status" "item_status" DEFAULT 'suggested' NOT NULL,
	"episode_at" timestamp with time zone,
	"superseded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "non_negotiables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"domain_key" text,
	"hardness" "hardness" DEFAULT 'strong' NOT NULL,
	"note" text,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"channel" "observation_channel" NOT NULL,
	"domain_key" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text,
	"pronouns" text,
	"role" text,
	"life_stage" text,
	"onboarding_stage" text DEFAULT 'not_started' NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strengths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"kind" text DEFAULT 'strength' NOT NULL,
	"note" text,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"password_salt" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"kind" text DEFAULT 'value' NOT NULL,
	"importance" integer DEFAULT 5 NOT NULL,
	"note" text,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"current_experience" real NOT NULL,
	"desired_experience" real NOT NULL,
	"outer_result" real NOT NULL,
	"inner_experience" real NOT NULL,
	"importance" real NOT NULL,
	"energy" real NOT NULL,
	"satisfaction" real NOT NULL,
	"risk" real NOT NULL,
	"momentum" real NOT NULL,
	"basis" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid,
	"bold_result_id" uuid,
	"title" text NOT NULL,
	"kind" text DEFAULT 'strategic' NOT NULL,
	"why" text,
	"date" date NOT NULL,
	"status" "action_status" DEFAULT 'planned' NOT NULL,
	"energy_cost" "magnitude" DEFAULT 'medium' NOT NULL,
	"time_minutes" integer DEFAULT 30 NOT NULL,
	"is_today_move" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bold_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"title" text NOT NULL,
	"day_marker" integer NOT NULL,
	"target_date" date NOT NULL,
	"success_definition" text NOT NULL,
	"evidence_list" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"leading_indicators" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bold_confidence" real DEFAULT 0.5 NOT NULL,
	"owner" text DEFAULT 'me' NOT NULL,
	"progress" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid,
	"question" text NOT NULL,
	"context" text,
	"verdict" "decision_verdict" NOT NULL,
	"headline" text NOT NULL,
	"reasoning" text NOT NULL,
	"conflicts_with" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"supports" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"better_move" text,
	"opportunity_cost" text,
	"council_run_id" uuid,
	"decision_confidence" real DEFAULT 0.5 NOT NULL,
	"user_outcome" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"severity" "severity" DEFAULT 'medium' NOT NULL,
	"likelihood" "likelihood" DEFAULT 'medium' NOT NULL,
	"mitigation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal_id" uuid,
	"name" text NOT NULL,
	"purpose" text NOT NULL,
	"winning_definition" text NOT NULL,
	"non_winning_definition" text NOT NULL,
	"strategic_objective" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "game_status" DEFAULT 'draft' NOT NULL,
	"why_this_plan" text DEFAULT '' NOT NULL,
	"intentional_omissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"health_score" real,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"raw_input" text,
	"horizon_months" integer DEFAULT 12 NOT NULL,
	"domain_id" uuid,
	"is_primary" boolean DEFAULT false NOT NULL,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"bold_result_id" uuid,
	"title" text NOT NULL,
	"due_date" date,
	"status" "item_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid,
	"name" text NOT NULL,
	"identity" text NOT NULL,
	"intention" text NOT NULL,
	"mantra" text NOT NULL,
	"attitude" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"agreements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"boundaries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"watch_outs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"why_this_fits" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protect_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"text" text NOT NULL,
	"non_negotiable_id" uuid,
	"reason" text NOT NULL,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "squad_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid,
	"name" text NOT NULL,
	"relationship" text,
	"can_help_with" text NOT NULL,
	"ask_draft" text,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stop_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"text" text NOT NULL,
	"reason" text NOT NULL,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategic_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"leverage_category" "leverage_category",
	"expected_impact" "magnitude" DEFAULT 'medium' NOT NULL,
	"effort" "magnitude" DEFAULT 'medium' NOT NULL,
	"sequence_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whole_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"result" text NOT NULL,
	"experience" text NOT NULL,
	"impact" text NOT NULL,
	"identity" text NOT NULL,
	"most_important_dimension" "goal_dimension",
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blind_spots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"hypothesis" text NOT NULL,
	"detail" text NOT NULL,
	"based_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"user_response" "user_response",
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"mode" "plan_mode" DEFAULT 'standard' NOT NULL,
	"council_note" text,
	"one_decision" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insight_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "insight_kind" DEFAULT 'insight' NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"domain_id" uuid,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intention_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"computed" integer NOT NULL,
	"components" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"accepted" boolean DEFAULT false NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protocol_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"protocol_id" uuid NOT NULL,
	"domain_id" uuid,
	"label" text NOT NULL,
	"minimum" text NOT NULL,
	"standard" text NOT NULL,
	"expansion" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protocols" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reflections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "reflection_kind" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"moved" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"didnt_move" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"surprises" text,
	"feeling" text,
	"cost_more_than_expected" text,
	"gave_energy" text,
	"should_change" text,
	"intelligence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rituals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "ritual_category" NOT NULL,
	"name" text NOT NULL,
	"detail" text NOT NULL,
	"cadence" text NOT NULL,
	"why_this_fits" text NOT NULL,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slot" "routine_slot" NOT NULL,
	"name" text NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration_minutes" integer DEFAULT 15 NOT NULL,
	"source" "source_kind" DEFAULT 'ai_inferred' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"status" "item_status" DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"operating_state" "operating_state" NOT NULL,
	"state_confidence" real DEFAULT 0.5 NOT NULL,
	"drivers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"focus" real NOT NULL,
	"energy" real NOT NULL,
	"alignment" real NOT NULL,
	"capacity" real NOT NULL,
	"user_override" boolean DEFAULT false NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"council_run_id" uuid NOT NULL,
	"kind" "conflict_kind" NOT NULL,
	"raised_by" "agent_id" NOT NULL,
	"against" "agent_id",
	"claim" text NOT NULL,
	"severity" "severity" NOT NULL,
	"resolution" text NOT NULL,
	"resolved_in_favour_of" "agent_id",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"council_run_id" uuid NOT NULL,
	"verdict" "council_verdict" NOT NULL,
	"headline" text NOT NULL,
	"rationale" text NOT NULL,
	"trade_offs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"omissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"next_question" jsonb,
	"user_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"agent_run_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"summary" text NOT NULL,
	"reasoning" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"council_run_id" uuid NOT NULL,
	"agent" "agent_id" NOT NULL,
	"purpose" "council_purpose" NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"confidence" real,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"latency_ms" integer,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" real DEFAULT 0 NOT NULL,
	"validation_attempts" integer DEFAULT 1 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "council_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "council_purpose" NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"latency_ms" integer,
	"agent_count" integer DEFAULT 0 NOT NULL,
	"provider" text NOT NULL,
	"total_input_tokens" integer DEFAULT 0 NOT NULL,
	"total_output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" real DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"council_run_id" uuid,
	"target" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"rationale" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"leverage" text,
	"status" "recommendation_status" DEFAULT 'suggested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sacrifice_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid,
	"council_run_id" uuid,
	"scores" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verdict" "sacrifice_verdict" NOT NULL,
	"warning" text,
	"alternatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "behavioral_patterns" ADD CONSTRAINT "behavioral_patterns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constraints" ADD CONSTRAINT "constraints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_models" ADD CONSTRAINT "identity_models_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_items" ADD CONSTRAINT "memory_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_negotiables" ADD CONSTRAINT "non_negotiables_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strengths" ADD CONSTRAINT "strengths_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "values" ADD CONSTRAINT "values_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_domains" ADD CONSTRAINT "life_domains_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_scores" ADD CONSTRAINT "life_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_scores" ADD CONSTRAINT "life_scores_domain_id_life_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."life_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_bold_result_id_bold_results_id_fk" FOREIGN KEY ("bold_result_id") REFERENCES "public"."bold_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bold_results" ADD CONSTRAINT "bold_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bold_results" ADD CONSTRAINT "bold_results_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_risks" ADD CONSTRAINT "game_risks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_risks" ADD CONSTRAINT "game_risks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_domain_id_life_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."life_domains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_bold_result_id_bold_results_id_fk" FOREIGN KEY ("bold_result_id") REFERENCES "public"."bold_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protect_list_items" ADD CONSTRAINT "protect_list_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protect_list_items" ADD CONSTRAINT "protect_list_items_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squad_members" ADD CONSTRAINT "squad_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squad_members" ADD CONSTRAINT "squad_members_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stop_list_items" ADD CONSTRAINT "stop_list_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stop_list_items" ADD CONSTRAINT "stop_list_items_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_moves" ADD CONSTRAINT "strategic_moves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_moves" ADD CONSTRAINT "strategic_moves_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whole_goals" ADD CONSTRAINT "whole_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whole_goals" ADD CONSTRAINT "whole_goals_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blind_spots" ADD CONSTRAINT "blind_spots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_logs" ADD CONSTRAINT "day_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_plans" ADD CONSTRAINT "insight_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_domain_id_life_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."life_domains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intention_snapshots" ADD CONSTRAINT "intention_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_items" ADD CONSTRAINT "protocol_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_items" ADD CONSTRAINT "protocol_items_protocol_id_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_items" ADD CONSTRAINT "protocol_items_domain_id_life_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."life_domains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rituals" ADD CONSTRAINT "rituals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_snapshots" ADD CONSTRAINT "state_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_conflicts" ADD CONSTRAINT "agent_conflicts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_conflicts" ADD CONSTRAINT "agent_conflicts_council_run_id_council_runs_id_fk" FOREIGN KEY ("council_run_id") REFERENCES "public"."council_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_council_run_id_council_runs_id_fk" FOREIGN KEY ("council_run_id") REFERENCES "public"."council_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD CONSTRAINT "agent_outputs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD CONSTRAINT "agent_outputs_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_council_run_id_council_runs_id_fk" FOREIGN KEY ("council_run_id") REFERENCES "public"."council_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "council_runs" ADD CONSTRAINT "council_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_council_run_id_council_runs_id_fk" FOREIGN KEY ("council_run_id") REFERENCES "public"."council_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sacrifice_assessments" ADD CONSTRAINT "sacrifice_assessments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sacrifice_assessments" ADD CONSTRAINT "sacrifice_assessments_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sacrifice_assessments" ADD CONSTRAINT "sacrifice_assessments_council_run_id_council_runs_id_fk" FOREIGN KEY ("council_run_id") REFERENCES "public"."council_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "behavioral_patterns_user_idx" ON "behavioral_patterns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "constraints_user_idx" ON "constraints" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_models_user_unique" ON "identity_models" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memory_items_user_layer_idx" ON "memory_items" USING btree ("user_id","layer");--> statement-breakpoint
CREATE INDEX "memory_items_key_idx" ON "memory_items" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "non_negotiables_user_idx" ON "non_negotiables" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "observations_user_idx" ON "observations" USING btree ("user_id","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_unique" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "strengths_user_idx" ON "strengths" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "values_user_idx" ON "values" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "life_domains_user_key_unique" ON "life_domains" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "life_scores_user_domain_idx" ON "life_scores" USING btree ("user_id","domain_id","captured_at");--> statement-breakpoint
CREATE INDEX "life_scores_user_captured_idx" ON "life_scores" USING btree ("user_id","captured_at");--> statement-breakpoint
CREATE INDEX "actions_user_date_idx" ON "actions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "bold_results_game_idx" ON "bold_results" USING btree ("game_id","day_marker");--> statement-breakpoint
CREATE INDEX "decisions_user_idx" ON "decisions" USING btree ("user_id","decided_at");--> statement-breakpoint
CREATE INDEX "game_risks_game_idx" ON "game_risks" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "games_user_status_idx" ON "games" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "goals_user_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "milestones_game_idx" ON "milestones" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "players_user_active_idx" ON "players" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "protect_list_game_idx" ON "protect_list_items" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "squad_user_idx" ON "squad_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stop_list_game_idx" ON "stop_list_items" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "strategic_moves_game_idx" ON "strategic_moves" USING btree ("game_id","sequence_index");--> statement-breakpoint
CREATE INDEX "whole_goals_goal_idx" ON "whole_goals" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "blind_spots_user_idx" ON "blind_spots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "day_logs_user_date_idx" ON "day_logs" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "insight_plans_user_idx" ON "insight_plans" USING btree ("user_id","generated_at");--> statement-breakpoint
CREATE INDEX "insights_user_idx" ON "insights" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "intention_snapshots_user_idx" ON "intention_snapshots" USING btree ("user_id","captured_at");--> statement-breakpoint
CREATE INDEX "protocol_items_protocol_idx" ON "protocol_items" USING btree ("protocol_id","order_index");--> statement-breakpoint
CREATE INDEX "protocols_user_active_idx" ON "protocols" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "reflections_user_kind_idx" ON "reflections" USING btree ("user_id","kind","period_start");--> statement-breakpoint
CREATE INDEX "rituals_user_idx" ON "rituals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "routines_user_slot_idx" ON "routines" USING btree ("user_id","slot");--> statement-breakpoint
CREATE INDEX "state_snapshots_user_idx" ON "state_snapshots" USING btree ("user_id","captured_at");--> statement-breakpoint
CREATE INDEX "agent_conflicts_council_idx" ON "agent_conflicts" USING btree ("council_run_id");--> statement-breakpoint
CREATE INDEX "agent_decisions_council_idx" ON "agent_decisions" USING btree ("council_run_id");--> statement-breakpoint
CREATE INDEX "agent_outputs_run_idx" ON "agent_outputs" USING btree ("agent_run_id");--> statement-breakpoint
CREATE INDEX "agent_runs_council_idx" ON "agent_runs" USING btree ("council_run_id");--> statement-breakpoint
CREATE INDEX "agent_runs_user_agent_idx" ON "agent_runs" USING btree ("user_id","agent");--> statement-breakpoint
CREATE INDEX "council_runs_user_idx" ON "council_runs" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "recommendations_user_status_idx" ON "recommendations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "sacrifice_user_idx" ON "sacrifice_assessments" USING btree ("user_id","created_at");