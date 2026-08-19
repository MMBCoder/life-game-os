import 'server-only';
import { resolveProviderChoice } from './config';
import { MockProvider } from './providers/mock';
import type { AIProvider } from './types';
import type * as AnthropicModule from './providers/anthropic';
import type * as OpenAIModule from './providers/openai';

type ProviderGlobal = { __lgos_provider?: AIProvider };
const globalForProvider = globalThis as unknown as ProviderGlobal;

/**
 * Resolves the active provider once per process. Falls back to the deterministic
 * mock whenever credentials are absent, so the product never degrades into a
 * half-working state — it just stops making network calls.
 */
export function getProvider(): AIProvider {
  if (globalForProvider.__lgos_provider) return globalForProvider.__lgos_provider;

  const choice = resolveProviderChoice();
  const provider: AIProvider =
    choice === 'anthropic'
      ? createAnthropicProvider()
      : choice === 'openai'
        ? createOpenAIProvider()
        : new MockProvider();

  globalForProvider.__lgos_provider = provider;
  return provider;
}

/**
 * Required lazily so the vendor SDK is not loaded — and an absent key is not
 * fatal — in mock mode, which is the default for local development and CI.
 */
function createAnthropicProvider(): AIProvider {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate lazy load
  const { AnthropicProvider } = require('./providers/anthropic') as typeof AnthropicModule;
  return new AnthropicProvider();
}

/** Lazy for the same reason as the Anthropic provider above. */
function createOpenAIProvider(): AIProvider {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate lazy load
  const { OpenAIProvider } = require('./providers/openai') as typeof OpenAIModule;
  return new OpenAIProvider();
}

/** Test-only override. */
export function __setProviderForTests(provider: AIProvider | undefined): void {
  globalForProvider.__lgos_provider = provider;
}

export type { AIProvider } from './types';
export { MODELS, maxAgentsPerRun } from './config';
