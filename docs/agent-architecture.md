# Agent Architecture — The Council

## 1. Principle

Agents do not produce independent answers that get concatenated. They **analyse in parallel,
disagree, get attacked by a red team, and are then reconciled by an orchestrator**. The
disagreement is the product feature — it is persisted and shown to the user.

## 2. Roster

| # | Agent | Id | Owns | Tier |
| --- | --- | --- | --- | --- |
| 1 | Life Architect | `orchestrator` | Coordination, conflict resolution, synthesis | deep |
| 2 | Identity Agent | `identity` | Identity, values, strengths, principles, tensions | standard |
| 3 | Reality Mapper | `reality` | Current life, constraints, time, responsibilities, resources | standard |
| 4 | Goal Architect | `goal` | Whole Goal: result / experience / impact / identity | standard |
| 5 | Player Designer | `player` | Player identity, intention, mantra, attitude, agreements | standard |
| 6 | Strategy Agent | `strategy` | Game, strategy, priorities, leverage, milestones, stop list | deep |
| 7 | Health Guardian | `health` | Sustainable workload, recovery, sleep, energy, movement | standard |
| 8 | Relationship Guardian | `relationships` | Family, key relationships, presence, boundaries | standard |
| 9 | Capacity Agent | `capacity` | Time, workload, energy, commitments, feasibility | light |
| 10 | Red Team | `redTeam` | Attacks the plan: assumptions, failure modes, omissions | deep |
| 11 | Execution Agent | `execution` | Actions, habits, rituals, routines, weekly/daily plan | standard |
| 12 | Reflection Agent | `reflection` | What happened, what worked, triggers, patterns, lessons | standard |
| 13 | Adaptation Agent | `adaptation` | Updates goals, strategy, player, protocol, milestones | standard |

## 3. Model tiering (cost control)

| Tier | Model | Effort | Used for |
| --- | --- | --- | --- |
| `deep` | `claude-opus-5` | `high` | Strategy, red team, orchestration — where reasoning quality decides plan quality |
| `standard` | `claude-sonnet-5` | `medium` | Most domain agents |
| `light` | `claude-haiku-4-5` | — | Capacity arithmetic, classification, short extraction |

Overridable per deployment with `AI_MODEL_DEEP` / `AI_MODEL_STANDARD` / `AI_MODEL_LIGHT`.

## 4. Routing

The orchestrator never runs all thirteen agents. `route(purpose)` selects the minimum set:

| Purpose | Agents |
| --- | --- |
| `onboarding_snapshot` | identity, reality, goal |
| `life_map_estimate` | reality, identity |
| `whole_goal` | goal, identity, capacity |
| `player_design` | player, identity, strategy |
| `game_design` | strategy, capacity, health, relationships, redTeam, orchestrator |
| `plan_review` | strategy, capacity, health, relationships, redTeam, orchestrator |
| `decision` | strategy, capacity, health, relationships, redTeam, orchestrator |
| `protocol_design` | execution, health, capacity |
| `daily_plan` | execution, capacity |
| `daily_reflection` | reflection, adaptation |
| `weekly_review` | reflection, capacity, strategy, adaptation |
| `monthly_review` | reflection, strategy, health, relationships, adaptation, orchestrator |
| `adaptation` | adaptation, strategy, capacity, orchestrator |

Purely computational work — a slider change, a momentum recompute, a capacity meter — runs **no
agents at all**. `src/lib/scoring` handles it deterministically.

## 5. Output contract

Every agent returns the same validated envelope (`src/schemas/agent.ts`):

```jsonc
{
  "agent": "strategy",
  "status": "draft",             // draft | suggested | confirmed | rejected
  "confidence": 0.86,            // 0..1
  "summary": "One-sentence, user-facing.",
  "reasoning": ["Concise user-facing points — never raw chain-of-thought"],
  "insights":        [{ "title", "detail", "confidence", "evidence": [] }],
  "recommendations": [{ "title", "detail", "rationale", "priority", "leverage"? }],
  "risks":           [{ "title", "detail", "severity", "likelihood", "mitigation" }],
  "questions":       [{ "question", "why", "valueScore", "suggestions": [] }],
  "proposedChanges": [{ "target", "operation", "payload", "rationale" }],
  "objections":      [{ "against": "strategy", "claim", "severity", "basis" }],
  "evidence":        [{ "kind", "ref", "note" }]
}
```

`questions[].valueScore` is what enforces the minimal-input law: the orchestrator surfaces **only
the single highest-scoring question** across all agents.

`objections[]` is what makes negotiation real: an agent can attack a named peer.

## 6. Negotiation protocol

```
1. PARALLEL ANALYSIS   all routed agents run concurrently on the same context
2. OBJECTION EXCHANGE  each agent's objections[] are matched to their targets
3. CONFLICT DETECTION  deterministic: guardian veto, capacity overrun,
                       non-negotiable breach, priority overload, contradictory changes
4. RED TEAM            attacks the surviving proposal (significant decisions only)
5. SYNTHESIS           orchestrator resolves under a fixed precedence order
6. PERSIST             agentRuns, agentOutputs, agentConflicts, agentDecisions
```

### Resolution precedence

Guardians can veto; strategy cannot overrule them. Ambition is never lowered to resolve a conflict —
the *method* changes.

1. **Non-negotiable breach** — hard block. The proposal is rejected outright.
2. **Health Guardian veto** — blocks unless the user has explicitly accepted the cost.
3. **Relationship Guardian veto** — same.
4. **Capacity infeasibility** — blocks; triggers the leverage search.
5. **Red Team severity ≥ high** — forces revision.
6. **Strategy preference** — applies only after all of the above are satisfied.

Worked example, stored verbatim and shown in the Council Room:

```
STRATEGY        Add a second high-visibility initiative.
CAPACITY        Load is already 90%.
HEALTH          Recovery debt; unacceptable risk.
RELATIONSHIPS   Conflicts with protected family time.
RED TEAM        Adds complexity without proportional strategic upside.
ORCHESTRATOR    Reject.
FINAL           Increase visibility through existing work instead of adding an initiative.
```

## 7. Transparency

Persisted per run: agent, purpose, input refs, output, confidence, evidence refs, recommendation,
status, timestamp, provider, model, latency, token/cost metadata, user confirmation state.

**Never persisted:** private chain-of-thought. `reasoning[]` is a concise user-facing summary and the
prompts instruct the model accordingly.

The Council Room renders the graph, each agent's summary, the objections, the conflicts, and the
final decision. Every card has a **Why?** affordance showing reasoning + evidence, and
**Confirm / Correct** where a claim about the user is involved.

## 8. Prompt structure

Each agent prompt is composed of:

1. `src/prompts/system/base.ts` — product framing, the seven laws, safety rules, output discipline.
2. `src/prompts/system/safety.ts` — health/finance/psychology boundaries.
3. The agent's own charter — its remit, what it must never decide, its objection rights.
4. Serialised context from `buildContext()` — Personal Model excerpt, memory, current artefacts.

Prompts are deliberately **not** over-prescriptive: they state goal, constraints, and output
contract, and leave method to the model.

## 9. Failure handling

- Schema-invalid output → one repair round trip with the validation errors appended → then the agent
  is marked `failed` and excluded. The council degrades; it does not crash.
- Provider timeout → agent marked `failed`, run continues with the remainder, decision confidence
  reduced, and the UI says which perspective is missing.
- If the orchestrator itself cannot produce a decision, nothing is written and the user sees:
  *"I couldn't complete that analysis. Your existing plan is safe."*
