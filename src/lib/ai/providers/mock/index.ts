import { AppError } from '@/lib/errors';
import { parseContext } from '@/lib/personalization/context-types';
import type { AgentId } from '@/schemas/agent';
import { MODELS } from '../../config';
import type {
  AIProvider,
  GenerateRequest,
  GenerateResult,
  StreamChunk,
  StructuredRequest,
  StructuredResult,
} from '../../types';
import {
  makeGame,
  makeLifeMap,
  makePlayerOptions,
  makeProtocol,
  makeSacrifice,
  makeSnapshot,
  makeWholeGoal,
} from './artefacts';
import {
  makeAdaptationPlan,
  makeAgentOutput,
  makeBlindSpots,
  makeCouncilDecision,
  makeDailyPlan,
  makeInsightPlan,
  makeMonthlyReview,
  makePlayerDecision,
  makeResetOptions,
  makeStateAssessment,
  makeSuggestions,
  makeWeeklyIntelligence,
} from './analysis';
import { seedFrom } from './signals';

/**
 * Deterministic offline provider.
 *
 * This is not a stub. It reads the same serialised Personal Model the real provider
 * receives and synthesises personalised, differentiated output from it — which is
 * what keeps the entire product functional without credentials (spec §81) and what
 * makes the evaluation suite meaningful in CI (docs/decisions.md D5).
 *
 * Same input ⇒ same output, always. No randomness, no clock dependence.
 */
export class MockProvider implements AIProvider {
  readonly name = 'mock';
  readonly isLive = false;

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const ctx = parseContext(req.prompt);
    const text = ctx
      ? `Working from what you have told me about ${ctx.user.name}'s ${ctx.purpose.replace(/_/g, ' ')}.`
      : 'No context was supplied, so there is nothing specific to work from yet.';

    return {
      text,
      model: `mock:${MODELS[req.tier]}`,
      usage: usageFor(req.prompt, text),
    };
  }

  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const ctx = parseContext(req.prompt);
    if (!ctx) {
      throw new AppError('missing_context', 'mock provider requires a serialised context');
    }

    const [kind, hint] = req.schemaName.split(':');
    let payload: unknown;

    switch (kind) {
      case 'AgentOutput':
        payload = makeAgentOutput((hint ?? 'strategy') as AgentId, ctx);
        break;
      case 'CouncilDecision':
        payload = makeCouncilDecision(ctx);
        break;
      case 'PersonalSnapshot':
        payload = makeSnapshot(ctx);
        break;
      case 'LifeMapEstimate':
        payload = makeLifeMap(ctx);
        break;
      case 'WholeGoalDraft':
        payload = makeWholeGoal(ctx);
        break;
      case 'PlayerOptions':
        payload = makePlayerOptions(ctx);
        break;
      case 'PlayerDecision':
        payload = makePlayerDecision(ctx);
        break;
      case 'GameDraft':
        payload = makeGame(ctx);
        break;
      case 'SacrificeAssessment':
        payload = makeSacrifice(ctx);
        break;
      case 'ProtocolDraft':
        payload = makeProtocol(ctx);
        break;
      case 'DailyPlan':
        payload = makeDailyPlan(ctx);
        break;
      case 'StateAssessment':
        payload = makeStateAssessment(ctx);
        break;
      case 'WeeklyIntelligence':
        payload = makeWeeklyIntelligence(ctx);
        break;
      case 'MonthlyReview':
        payload = makeMonthlyReview(ctx);
        break;
      case 'InsightPlanDraft':
        payload = makeInsightPlan(ctx);
        break;
      case 'BlindSpotDraft':
        payload = makeBlindSpots(ctx);
        break;
      case 'AdaptationPlan':
        payload = makeAdaptationPlan(ctx);
        break;
      case 'ResetOptions':
        payload = makeResetOptions(ctx);
        break;
      case 'SuggestionSet':
        payload = makeSuggestions(ctx);
        break;
      default:
        throw new AppError('ai_invalid_output', `mock provider has no generator for ${kind}`);
    }

    // Validate against the same schema the real provider is held to. A mock that
    // could emit invalid output would hide contract drift instead of catching it.
    const parsed = req.schema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(
        'ai_invalid_output',
        `mock output failed ${req.schemaName}: ${parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join('.')} ${i.message}`)
          .join('; ')}`,
      );
    }

    return {
      data: parsed.data,
      model: `mock:${MODELS[req.tier]}`,
      usage: usageFor(req.prompt, JSON.stringify(parsed.data)),
      attempts: 1,
    };
  }

  async *stream(req: GenerateRequest): AsyncIterable<StreamChunk> {
    const { text } = await this.generate(req);
    for (const word of text.split(' ')) {
      yield { text: `${word} `, done: false };
    }
    yield { text: '', done: true };
  }

  /**
   * Deterministic pseudo-embeddings. Stable and comparable, but they carry no real
   * semantics — sufficient for exercising a retrieval code path, not for ranking.
   */
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const seed = seedFrom([text]);
      return Array.from({ length: 32 }, (_, i) => {
        const v = Math.sin(seed * (i + 1) * 0.0001);
        return Math.round(v * 1000) / 1000;
      });
    });
  }
}

/** Token counts are approximated so /admin shows plausible shapes with no cost. */
function usageFor(prompt: string, output: string) {
  return {
    inputTokens: Math.ceil(prompt.length / 4),
    outputTokens: Math.ceil(output.length / 4),
    estimatedCostUsd: 0,
  };
}
