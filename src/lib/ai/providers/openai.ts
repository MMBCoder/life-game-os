import OpenAI from 'openai';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { MODELS, TIER_EFFORT, estimateCostUsd } from '../config';
import { trimOversizedArrays } from '../normalise';
import type {
  AIProvider,
  GenerateRequest,
  GenerateResult,
  ModelTier,
  StreamChunk,
  StructuredRequest,
  StructuredResult,
} from '../types';

/**
 * OpenAI implementation of the provider seam (spec §53). Along with `anthropic.ts`
 * this is one of only two modules permitted to import a vendor SDK (CLAUDE.md §5).
 *
 * Uses the Responses API rather than Chat Completions: it is the surface the GPT-5
 * reasoning family is designed around, and it exposes `reasoning.effort`, which is
 * how depth is controlled here. Sampling parameters are never sent — the same rule
 * the Anthropic provider follows, for the same reason.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly isLive = true;

  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.OPENAI_API_KEY,
      maxRetries: 2,
      timeout: 180_000,
    });
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const model = MODELS[req.tier];

    try {
      const response = await this.client.responses.create({
        model,
        instructions: req.system,
        input: req.prompt,
        reasoning: { effort: effortFor(req) },
        max_output_tokens: maxOutputTokens(req),
      });

      assertUsable(response);

      return {
        text: response.output_text,
        model,
        usage: usageOf(response, model),
      };
    } catch (error) {
      throw translateProviderError(error);
    }
  }

  /**
   * Schema-constrained generation plus runtime validation, with one repair round trip.
   *
   * `strict: false` is deliberate. OpenAI's strict mode requires every property to
   * appear in `required` and every object to set `additionalProperties: false`, which
   * no schema with an optional field can satisfy — our artefact schemas are rejected
   * outright with a 400. The documented workaround (mark optionals required and
   * nullable) would make the model emit `null` where Zod expects the key to be absent,
   * trading a provider error for a validation error.
   *
   * Non-strict mode still sends the full JSON Schema and the model follows it; the Zod
   * parse below is what actually guarantees the contract, exactly as on the Anthropic
   * path. Verified against the real API: the deep and standard tiers validate first
   * time, and the light tier occasionally needs the repair attempt.
   */
  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const jsonSchema = toJsonSchema(req.schema, req.schemaName);
    const model = MODELS[req.tier];

    let lastErrors = '';
    let usage = { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };

    for (let attempt = 1; attempt <= 2; attempt++) {
      const prompt =
        attempt === 1
          ? req.prompt
          : `${req.prompt}\n\nYour previous response failed validation against the required schema:\n${lastErrors}\nReturn corrected JSON that satisfies the schema exactly.`;

      try {
        const response = await this.client.responses.create({
          model,
          instructions: req.system,
          input: prompt,
          reasoning: { effort: effortFor(req) },
          text: {
            format: {
              type: 'json_schema',
              name: schemaSafeName(req.schemaName),
              schema: jsonSchema,
              strict: false,
            },
          },
          max_output_tokens: maxOutputTokens(req),
        });

        const spent = usageOf(response, model);
        usage = {
          inputTokens: usage.inputTokens + spent.inputTokens,
          outputTokens: usage.outputTokens + spent.outputTokens,
          estimatedCostUsd: usage.estimatedCostUsd + spent.estimatedCostUsd,
        };

        assertUsable(response);

        const raw: unknown = JSON.parse(response.output_text);
        const parsed = req.schema.safeParse(raw);
        if (parsed.success) {
          return { data: parsed.data, model, usage, attempts: attempt };
        }

        // Over-long arrays are trimmed rather than re-requested: these models ignore
        // `maxItems` on the retry too, so the round trip buys nothing. See normalise.ts.
        const trimmed = trimOversizedArrays(raw, parsed.error);
        if (trimmed.changed) {
          const retry = req.schema.safeParse(trimmed.value);
          if (retry.success) {
            return { data: retry.data, model, usage, attempts: attempt };
          }
          lastErrors = summariseZodErrors(retry.error);
        } else {
          lastErrors = summariseZodErrors(parsed.error);
        }
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (error instanceof SyntaxError) {
          lastErrors = 'Response was not valid JSON.';
          continue;
        }
        throw translateProviderError(error);
      }
    }

    // Fail closed. The caller's existing plan is untouched.
    throw new AppError('ai_invalid_output', `schema validation failed: ${lastErrors}`);
  }

  async *stream(req: GenerateRequest): AsyncIterable<StreamChunk> {
    const model = MODELS[req.tier];
    try {
      const events = await this.client.responses.create({
        model,
        instructions: req.system,
        input: req.prompt,
        reasoning: { effort: effortFor(req) },
        max_output_tokens: maxOutputTokens(req),
        stream: true,
      });

      for await (const event of events) {
        if (event.type === 'response.output_text.delta') {
          yield { text: event.delta, done: false };
        }
      }
      yield { text: '', done: true };
    } catch (error) {
      throw translateProviderError(error);
    }
  }

  /**
   * Unlike the Anthropic provider this one can embed, which leaves the door open for
   * semantic memory retrieval. Nothing calls it yet — retrieval is currently recency
   * and confidence weighted (docs/roadmap.md, deferred).
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const response = await this.client.embeddings.create({
        model: process.env.AI_MODEL_EMBEDDING?.trim() || 'text-embedding-3-small',
        input: texts,
      });
      return response.data.map((item) => item.embedding);
    } catch (error) {
      throw translateProviderError(error);
    }
  }
}

/**
 * Reasoning models spend output tokens on reasoning before they emit a single visible
 * character, so the shared tier budgets — sized for Anthropic, where they are not
 * shared — truncate here. These are the same tiers with headroom for that overhead.
 */
const OPENAI_TIER_MAX_TOKENS: Record<ModelTier, number> = {
  deep: 16_000,
  standard: 12_000,
  light: 6_000,
};

function maxOutputTokens(req: GenerateRequest): number {
  return req.maxTokens ?? OPENAI_TIER_MAX_TOKENS[req.tier];
}

/** The interface allows depths OpenAI does not expose; they clamp to its ceiling. */
function effortFor(req: GenerateRequest): 'low' | 'medium' | 'high' {
  const requested = req.effort ?? TIER_EFFORT[req.tier];
  return requested === 'xhigh' || requested === 'max' ? 'high' : requested;
}

/** The API accepts only `[A-Za-z0-9_-]` here, while our schema names contain `:`. */
function schemaSafeName(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * Rejects responses that cannot be used, so a truncated or declined answer surfaces as
 * a clean failure rather than a confusing parse error further down.
 */
function assertUsable(response: OpenAI.Responses.Response): void {
  if (response.status === 'incomplete') {
    const reason = response.incomplete_details?.reason ?? 'unknown';
    throw new AppError('ai_invalid_output', `response incomplete (${reason})`);
  }

  for (const item of response.output) {
    if (item.type === 'message') {
      for (const part of item.content) {
        if (part.type === 'refusal') {
          throw new AppError('ai_invalid_output', 'model declined the request');
        }
      }
    }
  }
}

function usageOf(response: OpenAI.Responses.Response, model: string) {
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    estimatedCostUsd: estimateCostUsd(model, inputTokens, outputTokens),
  };
}

/**
 * Zod 4 emits JSON Schema natively. `io: 'output'` matters: defaults must be required
 * in the model's contract, or it omits them and validation then fills values the model
 * never chose.
 */
function toJsonSchema(schema: z.ZodType, name: string): Record<string, unknown> {
  const generated = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    io: 'output',
    unrepresentable: 'any',
  }) as Record<string, unknown>;

  return { ...generated, title: name };
}

function summariseZodErrors(error: z.ZodError): string {
  return error.issues
    .slice(0, 12)
    .map((issue) => `- ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

function translateProviderError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new AppError('ai_timeout', 'provider timeout');
  }
  if (error instanceof OpenAI.RateLimitError) {
    return new AppError('ai_rate_limited', 'provider rate limit');
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new AppError('network', 'provider connection failure');
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return new AppError('ai_unavailable', 'provider authentication failure');
  }
  if (error instanceof OpenAI.APIError) {
    return new AppError('ai_unavailable', `provider error ${error.status ?? 'unknown'}`);
  }
  return new AppError('unknown', 'unexpected provider failure');
}
