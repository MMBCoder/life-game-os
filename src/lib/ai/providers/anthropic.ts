import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { MODELS, TIER_EFFORT, TIER_MAX_TOKENS, estimateCostUsd } from '../config';
import type {
  AIProvider,
  GenerateRequest,
  GenerateResult,
  StreamChunk,
  StructuredRequest,
  StructuredResult,
} from '../types';

/**
 * The only module in the codebase permitted to import the vendor SDK (CLAUDE.md §5).
 *
 * Parameters deliberately never sent: `temperature`, `top_p`, `top_k`,
 * `thinking.budget_tokens`. Current models reject them; depth is set with
 * `output_config.effort`.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  readonly isLive = true;

  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
      maxRetries: 2,
      timeout: 120_000,
    });
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const model = MODELS[req.tier];
    const maxTokens = req.maxTokens ?? TIER_MAX_TOKENS[req.tier];

    try {
      // Streaming even when the caller wants a single result: it removes the HTTP
      // timeout risk on long outputs at no cost to the caller.
      const stream = this.client.messages.stream({
        model,
        max_tokens: maxTokens,
        system: req.system,
        messages: [{ role: 'user', content: req.prompt }],
        output_config: { effort: req.effort ?? TIER_EFFORT[req.tier] },
      });

      const message = await stream.finalMessage();
      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      if (message.stop_reason === 'refusal') {
        throw new AppError('ai_invalid_output', 'model declined the request');
      }

      return {
        text,
        model,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          estimatedCostUsd: estimateCostUsd(
            model,
            message.usage.input_tokens,
            message.usage.output_tokens,
          ),
        },
      };
    } catch (error) {
      throw translateProviderError(error);
    }
  }

  /**
   * Schema-constrained generation plus runtime validation. Either alone leaves a
   * gap: `output_config.format` constrains the shape, the Zod parse guarantees it.
   * One repair round trip carries the validation errors back to the model.
   */
  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const jsonSchema = toJsonSchema(req.schema, req.schemaName);
    const model = MODELS[req.tier];
    const maxTokens = req.maxTokens ?? TIER_MAX_TOKENS[req.tier];

    let lastErrors = '';
    let usage = { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };

    for (let attempt = 1; attempt <= 2; attempt++) {
      const prompt =
        attempt === 1
          ? req.prompt
          : `${req.prompt}\n\nYour previous response failed validation against the required schema:\n${lastErrors}\nReturn corrected JSON that satisfies the schema exactly.`;

      try {
        const stream = this.client.messages.stream({
          model,
          max_tokens: maxTokens,
          system: req.system,
          messages: [{ role: 'user', content: prompt }],
          output_config: {
            effort: req.effort ?? TIER_EFFORT[req.tier],
            format: { type: 'json_schema', schema: jsonSchema },
          },
        });

        const message = await stream.finalMessage();

        usage = {
          inputTokens: usage.inputTokens + message.usage.input_tokens,
          outputTokens: usage.outputTokens + message.usage.output_tokens,
          estimatedCostUsd:
            usage.estimatedCostUsd +
            estimateCostUsd(model, message.usage.input_tokens, message.usage.output_tokens),
        };

        if (message.stop_reason === 'refusal') {
          throw new AppError('ai_invalid_output', 'model declined the request');
        }

        const raw = message.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('');

        const parsed = req.schema.safeParse(JSON.parse(raw));
        if (parsed.success) {
          return { data: parsed.data, model, usage, attempts: attempt };
        }

        lastErrors = summariseZodErrors(parsed.error);
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
      const stream = this.client.messages.stream({
        model,
        max_tokens: req.maxTokens ?? TIER_MAX_TOKENS[req.tier],
        system: req.system,
        messages: [{ role: 'user', content: req.prompt }],
        output_config: { effort: req.effort ?? TIER_EFFORT[req.tier] },
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { text: event.delta.text, done: false };
        }
      }
      yield { text: '', done: true };
    } catch (error) {
      throw translateProviderError(error);
    }
  }

  /**
   * Embeddings are not offered by this provider. The interface keeps the method so
   * semantic retrieval can be added later without a breaking change; retrieval is
   * currently recency + confidence weighted (docs/roadmap.md, deferred).
   */
  async embed(_texts: string[]): Promise<number[][]> {
    throw new AppError('ai_unavailable', 'embeddings not supported by this provider');
  }
}

/**
 * Zod 4 emits JSON Schema natively. `io: 'output'` matters: defaults must be
 * required in the model's contract, or it omits them and validation then fills
 * values the model never chose.
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

  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AppError('ai_timeout', 'provider timeout');
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AppError('ai_rate_limited', 'provider rate limit');
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AppError('network', 'provider connection failure');
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new AppError('ai_unavailable', 'provider authentication failure');
  }
  if (error instanceof Anthropic.APIError) {
    return new AppError('ai_unavailable', `provider error ${error.status ?? 'unknown'}`);
  }
  return new AppError('unknown', 'unexpected provider failure');
}
