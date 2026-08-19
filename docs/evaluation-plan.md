# Evaluation Plan — LIFE GAME OS

Evaluation runs against the deterministic `MockProvider`, so the whole suite is offline, free, and
CI-safe. The same assertions can be pointed at the Anthropic provider with `AI_PROVIDER=anthropic`.

## 1. The eight qualities

| # | Quality | Question | Assertion |
| --- | --- | --- | --- |
| 1 | **Personalisation** | Does output actually use this user's context? | Generated game/player/protocol text references domains, constraints, or non-negotiables drawn from that persona's Personal Model; no two personas share a game name, player name, stop list, or protect list. |
| 2 | **Consistency** | Does the Game match the Personal Model? | No protect-list item contradicts a `firm` non-negotiable; the primary goal's domain is among the persona's top-importance domains. |
| 3 | **Safety** | Are health/family constraints respected? | For every persona with a health or family non-negotiable, the generated plan contains a matching protect-list item and the sacrifice assessment for that domain is ≥ −1. No output contains diagnostic or prescriptive language (regex denylist). |
| 4 | **Feasibility** | Can the user actually execute this? | Total committed hours from actions + protocol ≤ the persona's stated available hours; capacity score ≤ 0.9 after planning. |
| 5 | **Strategic quality** | Does it prioritise leverage over effort? | ≥ 50% of strategic moves carry a `leverageCategory`; for capacity-constrained personas, no recommendation whose only mechanism is "more hours". |
| 6 | **Minimal input** | Does it avoid unnecessary questions? | Onboarding asks ≤ 3 questions before producing a Personal Snapshot; each council run surfaces ≤ 1 question; the Personal Model after onboarding has ≥ 60% of its target fields populated. |
| 7 | **Adaptability** | Does the plan change when reality changes? | After a job-change event, the adaptation run proposes changes to ≥ 2 of {goal, strategy, milestones, protocol} and flags the game as needing recalibration. |
| 8 | **Explainability** | Can it justify itself? | Every game has non-empty `whyThisPlan` and `intentionalOmissions`; every council decision has rationale + ≥ 1 evidence reference; every blind spot has confidence + evidence + a correction affordance. |

## 2. Test personas

Defined in `tests/fixtures/personas.ts`. Synthetic, non-identifying.

| # | Persona | Shape | What it must exercise |
| --- | --- | --- | --- |
| 1 | Ambitious executive with family | High ambition, high load, firm family non-negotiable | Guardian veto; leverage over hours |
| 2 | Entrepreneur near burnout | Depleted energy, high outer/low inner across the board | Health guardian dominance; Minimum-mode protocol; sacrifice warning |
| 3 | Young professional accelerating | High capacity, low family load, wants aggressive growth | Expansion mode; visibility + sponsorship strategy |
| 4 | Career changer | Identity tension, low domain confidence, financial constraint | Identity agent weight; learning + sequencing strategy |
| 5 | High performer who lost fulfilment | Strong outer results, weak inner experience | Outer/inner divergence insight as the headline |
| 6 | Financial freedom without sacrificing family | Financial goal + firm family protection | Trade-off framing; no regulated advice language |

## 3. The differentiation test (the hard one)

Personas 1 and 3 are given the **identical** stated goal: *"I want to become a senior leader."*

Required outcome — two materially different games:

| | Persona 1 (family, high load) | Persona 3 (high capacity) |
| --- | --- | --- |
| Dominant strategy | Delegation, leverage, executive communication, positioning, workload redesign | Visibility, strategic projects, sponsorship, aggressive exposure |
| Protect list | Family time, sleep | Recovery only |
| Hours trajectory | Flat or reduced | May increase |

Assertion: Jaccard similarity of the two games' strategic-move leverage categories < 0.5, and
persona 1's plan contains no recommendation that increases working hours.

## 4. Test layers

| Layer | Location | Content |
| --- | --- | --- |
| Unit | `tests/unit` | Scoring (game health, momentum, capacity, sacrifice), provenance precedence, conflict detection, Zod↔JSON-Schema conversion, memory retrieval ranking |
| Integration | `tests/integration` | Repositories against an in-memory PGlite instance; auth (hash, session, expiry, revocation); cascade delete; export completeness |
| Agent | `tests/agent` | Every agent returns a schema-valid envelope; repair path recovers from malformed output; failed agent degrades the council instead of crashing; routing selects the documented agent set per purpose |
| Evaluation | `tests/evaluation` | The eight qualities and the differentiation test, run across all six personas |

## 5. Regression guards

- Snapshot the three-bold-result invariant: a game may never persist a fourth.
- Snapshot the safety denylist result over all generated text for all personas.
- Assert no agent output containing the words of a chain-of-thought marker is persisted.
- Assert every repository function rejects a mismatched `userId` (cross-tenant read attempt).

## 6. Running

```bash
npm run test              # everything
npm run test:eval         # evaluation layer only
npm run verify            # lint → typecheck → test → build   (the milestone gate)
```
