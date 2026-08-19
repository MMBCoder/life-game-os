import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupTestDb, teardownTestDb } from '../helpers/test-db';
import { buildPersona } from '../helpers/build-persona';
import { personaById } from '../fixtures/personas';
import { buildContext } from '@/lib/personalization/context';
import { convene } from '@/agents/orchestrator';
import { runAgent } from '@/agents/runner';
import { agentsFor, route } from '@/agents/routing';
import { agentOutput, type AgentId, type CouncilPurpose } from '@/schemas/agent';
import { AGENT_CHARTERS } from '@/prompts/agents';
import { getProvider, __setProviderForTests } from '@/lib/ai';
import { MockProvider } from '@/lib/ai/providers/mock';
import { persistCouncilRun, getCouncilRun } from '@/lib/db/repositories/council';
import type { SessionUser } from '@/lib/auth/session';
import type { AIProvider } from '@/lib/ai/types';

let user: SessionUser;

beforeAll(async () => {
  await setupTestDb();
  __setProviderForTests(new MockProvider());
  user = await buildPersona(personaById('executive-with-family'));
});

afterAll(async () => {
  __setProviderForTests(undefined);
  await teardownTestDb();
});

describe('agent contract', () => {
  const allAgents = Object.keys(AGENT_CHARTERS) as AgentId[];

  it.each(allAgents)('%s returns a schema-valid envelope', async (agent) => {
    const ctx = await buildContext({ purpose: 'plan_review', user });
    const record = await runAgent(agent, ctx);

    expect(record.status).toBe('succeeded');
    expect(record.output).not.toBeNull();

    const parsed = agentOutput.safeParse(record.output);
    expect(parsed.success).toBe(true);
  });

  it('stamps the requested agent onto the output, so no agent can answer for another', async () => {
    const ctx = await buildContext({ purpose: 'plan_review', user });
    const record = await runAgent('health', ctx);
    expect(record.output?.agent).toBe('health');
  });

  it('never persists raw chain-of-thought — reasoning is a short user-facing summary', async () => {
    const ctx = await buildContext({ purpose: 'plan_review', user });
    const record = await runAgent('strategy', ctx);

    for (const line of record.output?.reasoning ?? []) {
      expect(line.length).toBeLessThanOrEqual(400);
      expect(line).not.toMatch(/<thinking>|chain of thought|step 1:/i);
    }
  });
});

describe('routing', () => {
  it('runs a light set for a daily reflection and a full council for a decision', () => {
    expect(agentsFor('daily_reflection')).toEqual(['reflection', 'adaptation']);

    const decision = agentsFor('decision');
    expect(decision).toContain('redTeam');
    expect(decision).toContain('orchestrator');
    expect(decision).toContain('health');
    expect(decision).toContain('relationships');
  });

  it('never trims the red team or orchestrator to fit a cost budget', () => {
    const plan = route('decision', 2);
    expect(plan.secondPass).toContain('redTeam');
    expect(plan.secondPass).toContain('orchestrator');
  });

  /**
   * The guardians are the only agents holding a veto. Trimming them to save cost
   * would remove the protection guarantee on exactly the runs most likely to need
   * it — and the cap is set by an operator who cannot see that consequence.
   */
  it('never trims the health or relationship guardian, however tight the budget', () => {
    for (const cap of [1, 2, 3, 4, 5, 6, 8]) {
      const plan = route('decision', cap);
      expect(plan.firstPass, `cap=${cap}`).toContain('health');
      expect(plan.firstPass, `cap=${cap}`).toContain('relationships');
    }
  });

  it('trims non-guardian agents instead, and always leaves at least one', () => {
    const tight = route('decision', 1);
    const full = route('decision', 8);

    const nonGuardians = (agents: readonly string[]) =>
      agents.filter((a) => a !== 'health' && a !== 'relationships');

    expect(nonGuardians(tight.firstPass).length).toBe(1);
    expect(nonGuardians(full.firstPass).length).toBeGreaterThan(1);
    // A council of only vetoes would have nothing to vote on.
    expect(tight.firstPass).toContain('strategy');
  });

  it('lets the cap yield rather than shed a veto, and says so in the plan', () => {
    // decision routes 4 first-pass + 2 second-pass agents. A cap of 2 cannot be met
    // without dropping a guardian, so the cap loses.
    const plan = route('decision', 2);
    const total = plan.firstPass.length + plan.secondPass.length;

    expect(total).toBeGreaterThan(2);
    expect(plan.firstPass).toContain('health');
  });

  it('applies the cap normally when no guardian is in the route', () => {
    // insight_plan routes identity, reality, reflection — no guardians, no second pass.
    const plan = route('insight_plan', 2);
    expect(plan.firstPass).toHaveLength(2);
  });

  it('marks significant purposes as such', () => {
    expect(route('decision', 8).isSignificant).toBe(true);
    expect(route('daily_reflection', 8).isSignificant).toBe(false);
  });
});

describe('council run', () => {
  it('produces a decision, persists it, and reads back intact', async () => {
    const ctx = await buildContext({
      purpose: 'decision',
      user,
      ask: { question: 'Should I take on this extra high-visibility project?' },
    });

    const result = await convene(ctx);

    expect(result.outputs.length).toBeGreaterThan(0);
    expect(result.decision.headline.length).toBeGreaterThan(0);
    expect(result.decision.rationale.length).toBeGreaterThan(20);
    expect(result.failedAgents).toHaveLength(0);

    const { councilRunId } = await persistCouncilRun(user.id, result);
    const stored = await getCouncilRun(user.id, councilRunId);

    expect(stored?.agentRuns.length).toBe(result.records.length);
    expect(stored?.decision?.headline).toBe(result.decision.headline);
    expect(stored?.conflicts.length).toBe(result.conflicts.length);
  });

  it('detects a guardian objection for an over-committed person with firm protections', async () => {
    const ctx = await buildContext({
      purpose: 'decision',
      user,
      ask: { question: 'Should I take on another initiative this quarter?' },
    });

    const result = await convene(ctx);
    const objections = result.outputs.flatMap((o) => o.objections);

    // The executive persona is tight on capacity with firm family and sleep
    // protections, so at least one guardian or capacity objection is expected.
    expect(objections.length).toBeGreaterThan(0);
    expect(
      objections.some((o) => ['health', 'relationships', 'capacity'].includes(o.basis)),
    ).toBe(true);
  });

  it('surfaces at most one question, however many the council wants to ask', async () => {
    const ctx = await buildContext({ purpose: 'onboarding_snapshot', user });
    const result = await convene(ctx);

    const asked = result.outputs.flatMap((o) => o.questions);
    if (asked.length > 1) {
      expect(result.nextQuestion).not.toBeNull();
      // The one surfaced must be the highest-value one.
      const best = Math.max(...asked.map((q) => q.valueScore));
      expect(result.nextQuestion?.valueScore).toBe(best);
    }
  });

  it('gives the red team its peers’ output to attack', async () => {
    const ctx = await buildContext({ purpose: 'plan_review', user });
    const result = await convene(ctx);

    const redTeam = result.outputs.find((o) => o.agent === 'redTeam');
    expect(redTeam).toBeDefined();
    expect(redTeam!.risks.length).toBeGreaterThan(0);
    for (const risk of redTeam!.risks) {
      expect(risk.mitigation.length).toBeGreaterThan(0);
    }
  });
});

describe('failure degradation', () => {
  /** A provider that fails for one named agent and behaves normally otherwise. */
  function flakyProvider(failFor: AgentId): AIProvider {
    const real = new MockProvider();
    return {
      name: 'flaky',
      isLive: false,
      generate: real.generate.bind(real),
      stream: real.stream.bind(real),
      embed: real.embed.bind(real),
      structured: async (req) => {
        if (req.schemaName === `AgentOutput:${failFor}`) {
          throw new Error('simulated provider failure');
        }
        return real.structured(req);
      },
    };
  }

  it('continues the council when one agent fails, and names the gap', async () => {
    __setProviderForTests(flakyProvider('capacity'));

    const ctx = await buildContext({ purpose: 'plan_review', user });
    const result = await convene(ctx);

    expect(result.failedAgents).toContain('capacity');
    expect(result.outputs.length).toBeGreaterThan(0);
    expect(result.decision.headline.length).toBeGreaterThan(0);

    __setProviderForTests(new MockProvider());
  });

  it('still returns a safe decision when every agent fails', async () => {
    const alwaysFails: AIProvider = {
      name: 'broken',
      isLive: false,
      generate: async () => {
        throw new Error('down');
      },
      structured: async () => {
        throw new Error('down');
      },
      stream: async function* () {
        throw new Error('down');
      },
      embed: async () => {
        throw new Error('down');
      },
    };
    __setProviderForTests(alwaysFails);

    const ctx = await buildContext({ purpose: 'plan_review', user });
    const result = await convene(ctx);

    expect(result.outputs).toHaveLength(0);
    expect(result.decision.verdict).toBe('defer');
    expect(result.decision.rationale).toMatch(/unchanged|no analysis/i);

    __setProviderForTests(new MockProvider());
  });
});

describe('determinism', () => {
  it('produces identical output for identical context, so evaluation is stable', async () => {
    const ctx = await buildContext({ purpose: 'plan_review', user });
    const a = await runAgent('strategy', ctx);
    const b = await runAgent('strategy', ctx);
    expect(JSON.stringify(a.output)).toBe(JSON.stringify(b.output));
  });

  it('reports the mock provider as not live, so cost accounting stays honest', () => {
    expect(getProvider().isLive).toBe(false);
  });
});

describe('cost accounting', () => {
  it('records per-agent usage on every run', async () => {
    const ctx = await buildContext({ purpose: 'plan_review', user });
    const result = await convene(ctx);

    for (const record of result.records) {
      expect(record.inputTokens).toBeGreaterThanOrEqual(0);
      expect(record.latencyMs).toBeGreaterThanOrEqual(0);
      expect(record.model.length).toBeGreaterThan(0);
    }
    expect(result.totalInputTokens).toBeGreaterThan(0);
  });

  it('honours the documented purpose→agent mapping', async () => {
    const purposes: CouncilPurpose[] = ['daily_plan', 'whole_goal', 'weekly_review'];
    for (const purpose of purposes) {
      const ctx = await buildContext({ purpose, user });
      const result = await convene(ctx);
      const expected = agentsFor(purpose);
      for (const agent of result.outputs.map((o) => o.agent)) {
        expect(expected).toContain(agent);
      }
    }
  });
});
