import 'server-only';
import { getProvider } from '@/lib/ai';
import { MODELS } from '@/lib/ai/config';
import { AppError, logFailure } from '@/lib/errors';
import { serialiseContext, type CouncilContext } from '@/lib/personalization/context-types';
import { AGENT_CHARTERS } from '@/prompts/agents';
import { BASE_SYSTEM } from '@/prompts/system/base';
import { SAFETY_SYSTEM } from '@/prompts/system/safety';
import { agentOutput, type AgentId, type AgentOutput } from '@/schemas/agent';

export interface AgentRunRecord {
  agent: AgentId;
  status: 'succeeded' | 'failed';
  output: AgentOutput | null;
  model: string;
  provider: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  validationAttempts: number;
  error: string | null;
}

/**
 * Runs a single agent and returns a record whether it succeeded or not.
 *
 * A failing agent must never take the council down: the run continues with the
 * remaining perspectives, the decision's confidence drops, and the UI names which
 * viewpoint is missing (docs/agent-architecture.md §9).
 */
export async function runAgent(
  agent: AgentId,
  ctx: CouncilContext,
): Promise<AgentRunRecord> {
  const charter = AGENT_CHARTERS[agent];
  const provider = getProvider();
  const started = Date.now();

  const system = [BASE_SYSTEM, SAFETY_SYSTEM, `## Your role\n${charter.charter}`].join('\n\n');
  const prompt = buildPrompt(ctx);

  try {
    const result = await provider.structured({
      system,
      prompt,
      tier: charter.tier,
      schema: agentOutput,
      // The agent hint lets the deterministic mock provider select the right voice.
      schemaName: `AgentOutput:${agent}`,
    });

    // The schema does not know which agent was asked; enforce it here so an agent
    // cannot answer on another's behalf.
    const output: AgentOutput = { ...result.data, agent };

    return {
      agent,
      status: 'succeeded',
      output,
      model: result.model,
      provider: provider.name,
      latencyMs: Date.now() - started,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      estimatedCostUsd: result.usage.estimatedCostUsd,
      validationAttempts: result.attempts,
      error: null,
    };
  } catch (error) {
    logFailure('agent.run', error, { agent });
    return {
      agent,
      status: 'failed',
      output: null,
      model: MODELS[charter.tier],
      provider: provider.name,
      latencyMs: Date.now() - started,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      validationAttempts: 1,
      error: error instanceof AppError ? error.kind : 'unknown',
    };
  }
}

function buildPrompt(ctx: CouncilContext): string {
  const parts = [
    `Purpose of this council run: ${ctx.purpose.replace(/_/g, ' ')}.`,
    ctx.ask.question ? `The person is asking: "${ctx.ask.question}"` : null,
    ctx.ask.detail ? `Additional detail: ${ctx.ask.detail}` : null,
    ctx.peerOutputs.length > 0
      ? `You can see ${ctx.peerOutputs.length} other council members' outputs in context.peerOutputs. React to them specifically — name the agent you agree or disagree with.`
      : null,
    '',
    serialiseContext(ctx),
    '',
    'Produce your analysis as JSON matching the schema.',
  ].filter((p): p is string => p !== null);

  return parts.join('\n');
}
