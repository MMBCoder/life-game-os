import 'server-only';
import type { ZodType } from 'zod';
import { getProvider } from '@/lib/ai';
import { tierFor } from '@/prompts/agents';
import { AGENT_CHARTERS } from '@/prompts/agents';
import { BASE_SYSTEM } from '@/prompts/system/base';
import { SAFETY_SYSTEM } from '@/prompts/system/safety';
import { serialiseContext, type CouncilContext } from '@/lib/personalization/context-types';
import type { AgentId } from '@/schemas/agent';
import type { ModelTier } from '@/lib/ai/types';

/**
 * Generates one structured artefact from a named agent's perspective.
 *
 * Used for the single-artefact paths (a Whole Goal, a Player, a Game draft) where a
 * full council negotiation would be overkill. The full council is reserved for
 * decisions and plan reviews — see docs/agent-architecture.md §4.
 */
export async function generateArtefact<T>(options: {
  agent: AgentId;
  schema: ZodType<T>;
  schemaName: string;
  ctx: CouncilContext;
  instruction: string;
  tier?: ModelTier;
}): Promise<{ data: T; model: string; usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number }; attempts: number }> {
  const provider = getProvider();
  const charter = AGENT_CHARTERS[options.agent];

  const system = [BASE_SYSTEM, SAFETY_SYSTEM, `## Your role\n${charter.charter}`].join('\n\n');

  const prompt = [
    options.instruction,
    '',
    serialiseContext(options.ctx),
    '',
    'Return JSON matching the schema exactly.',
  ].join('\n');

  return provider.structured({
    system,
    prompt,
    tier: options.tier ?? tierFor(options.agent),
    schema: options.schema,
    schemaName: options.schemaName,
  });
}
