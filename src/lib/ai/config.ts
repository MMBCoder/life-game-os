import type { ModelTier } from './types';

export type ProviderChoice = 'anthropic' | 'openai' | 'mock';

/**
 * Provider selection. Absent credentials fall back to the deterministic mock so the
 * whole product stays functional — spec §81. Anthropic wins when both keys are
 * present, because the agent charters were written and evaluated against it.
 */
export function resolveProviderChoice(): ProviderChoice {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (forced === 'anthropic') return 'anthropic';
  if (forced === 'openai') return 'openai';
  if (forced === 'mock') return 'mock';

  if (process.env.ANTHROPIC_API_KEY?.trim()) return 'anthropic';
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai';
  return 'mock';
}

/**
 * Model tiering. Reasoning quality decides plan quality for strategy, red team and
 * orchestration; everything else runs a tier down.
 *
 * Defaults are per provider, because a model id is only meaningful to the vendor that
 * serves it — sending `claude-opus-5` to OpenAI is a 400. Any tier can still be
 * overridden per deployment so a cost-sensitive operator can move the whole council
 * without touching code.
 */
const DEFAULT_MODELS: Record<ProviderChoice, Record<ModelTier, string>> = {
  anthropic: { deep: 'claude-opus-5', standard: 'claude-sonnet-5', light: 'claude-haiku-4-5' },
  // Measured against this workload: gpt-5.5/high runs ~59s a call and the council
  // makes three sequential rounds of them, which is minutes of staring at a spinner.
  // gpt-5.4 keeps the reasoning depth the deep tier exists for at ~40s; the lower
  // tiers drop to ~14s. Override AI_MODEL_DEEP=gpt-5.5 if you want maximum depth and
  // can wait for it.
  openai: { deep: 'gpt-5.4', standard: 'gpt-5.4-mini', light: 'gpt-5.4-nano' },
  // The mock never calls anything; the names only appear in `mock:` labels.
  mock: { deep: 'claude-opus-5', standard: 'claude-sonnet-5', light: 'claude-haiku-4-5' },
};

function tierOverride(tier: ModelTier): string | undefined {
  switch (tier) {
    case 'deep':
      return process.env.AI_MODEL_DEEP?.trim() || undefined;
    case 'standard':
      return process.env.AI_MODEL_STANDARD?.trim() || undefined;
    case 'light':
      return process.env.AI_MODEL_LIGHT?.trim() || undefined;
  }
}

function modelFor(tier: ModelTier): string {
  return tierOverride(tier) ?? DEFAULT_MODELS[resolveProviderChoice()][tier];
}

/**
 * Resolved on access rather than at module load, so the active provider decides the
 * defaults. Call sites keep reading `MODELS[tier]`.
 */
export const MODELS: Record<ModelTier, string> = {
  get deep() {
    return modelFor('deep');
  },
  get standard() {
    return modelFor('standard');
  },
  get light() {
    return modelFor('light');
  },
};

/** USD per million tokens, for the cost figures shown in /admin. */
interface Rate {
  input: number;
  output: number;
}

const BUILT_IN_PRICING: Record<string, Rate> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-fable-5': { input: 10, output: 50 },
};

let extraPricing: Record<string, Rate> | null = null;

/**
 * Operator-supplied rates, e.g. `AI_PRICING_JSON={"gpt-5.5":{"input":1.25,"output":10}}`.
 *
 * Vendor prices change and are not discoverable through any API, so rather than bake
 * in figures that quietly go stale, unknown models are reported as unpriced and the
 * operator can supply current rates. Cost shown in /admin is then either right or
 * visibly absent — never confidently wrong.
 */
function operatorPricing(): Record<string, Rate> {
  if (extraPricing) return extraPricing;

  extraPricing = {};
  const raw = process.env.AI_PRICING_JSON?.trim();
  if (!raw) return extraPricing;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [model, rate] of Object.entries(parsed as Record<string, unknown>)) {
        if (rate && typeof rate === 'object') {
          const { input, output } = rate as { input?: unknown; output?: unknown };
          if (typeof input === 'number' && typeof output === 'number') {
            extraPricing[model] = { input, output };
          }
        }
      }
    }
  } catch {
    console.warn('[ai] AI_PRICING_JSON is not valid JSON; ignoring it.');
  }

  return extraPricing;
}

function rateFor(model: string): Rate | undefined {
  return operatorPricing()[model] ?? BUILT_IN_PRICING[model];
}

/** False when no rate is known, so callers can distinguish "free" from "unpriced". */
export function hasPricing(model: string): boolean {
  return rateFor(model) !== undefined;
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = rateFor(model);
  if (!rate) return 0;
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
}

/** Test-only: the parsed override is cached for the process lifetime. */
export function __resetPricingCache(): void {
  extraPricing = null;
}

/** Effort per tier. Depth is controlled here, never with sampling parameters. */
export const TIER_EFFORT: Record<ModelTier, 'low' | 'medium' | 'high'> = {
  deep: 'high',
  standard: 'medium',
  light: 'low',
};

export const TIER_MAX_TOKENS: Record<ModelTier, number> = {
  deep: 8_000,
  standard: 6_000,
  light: 2_500,
};

/** Belt-and-braces cost guard on top of agent routing. */
export function maxAgentsPerRun(): number {
  const parsed = Number(process.env.AI_MAX_AGENTS_PER_RUN ?? 8);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 8;
}
