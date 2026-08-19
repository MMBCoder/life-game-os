import type { ZodType } from 'zod';

/** Cost/quality tiers. See docs/agent-architecture.md §3 and decisions.md D3. */
export type ModelTier = 'deep' | 'standard' | 'light';

export interface GenerateRequest {
  system: string;
  prompt: string;
  tier: ModelTier;
  maxTokens?: number;
  /** Depth control. Never `temperature` — current models reject sampling parameters. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface GenerateResult {
  text: string;
  model: string;
  usage: Usage;
}

export interface StructuredRequest<T> extends GenerateRequest {
  /** The contract. Compiled to JSON Schema for the model, then re-validated. */
  schema: ZodType<T>;
  schemaName: string;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  usage: Usage;
  /** 1 normally, 2 when a schema-repair round trip was needed. */
  attempts: number;
}

export interface StreamChunk {
  text: string;
  done: boolean;
}

/**
 * The seam that keeps the product provider-agnostic (spec §53). Nothing outside
 * src/lib/ai/providers may import a vendor SDK.
 */
export interface AIProvider {
  readonly name: string;
  /** True when this provider makes real network calls (drives cost accounting). */
  readonly isLive: boolean;
  generate(req: GenerateRequest): Promise<GenerateResult>;
  structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
  stream(req: GenerateRequest): AsyncIterable<StreamChunk>;
  embed(texts: string[]): Promise<number[][]>;
}
