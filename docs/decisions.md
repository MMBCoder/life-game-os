# Technical Decisions

Decisions the specification left open, resolved with defaults rather than escalated. Each records the
alternative and why it lost, so a future maintainer can reverse it deliberately.

## D1 — Local database: PGlite, not Docker Postgres or SQLite

**Decision.** PostgreSQL everywhere. Locally, PGlite (embedded Postgres compiled to WASM) persisted
to `.data/pglite`; in production, a real Postgres via `DATABASE_URL`.

**Why.** The spec requires PostgreSQL *and* "easy to run locally". Docker Postgres satisfies the
first and breaks the second. SQLite satisfies the second and forks the SQL dialect, so migrations and
queries diverge between dev and prod. PGlite is genuine Postgres 18 — same dialect, same JSONB, same
migrations, zero setup. Verified running before adoption.

**Cost.** PGlite is single-connection and in-process, so it is a development and demo tool only.
`serverExternalPackages` keeps its WASM out of the bundle.

## D2 — Auth: first-party, not NextAuth/Clerk

**Decision.** scrypt password hashing (`node:crypto`) + DB-backed sessions in an HTTP-only cookie.

**Why.** This app holds unusually intimate data. A small, fully-readable auth surface with no external
identity provider and no third-party network calls is the more defensible choice, and the spec asks
only for authentication, secure sessions, and authorisation checks. scrypt is in the standard library,
so there is no native build step to break on Windows or Vercel.

**Cost.** No OAuth, no magic links, no MFA. All are additive later; the session table is already the
right shape for them.

## D3 — Model tiering, not one model everywhere

**Decision.** `deep` = `claude-opus-5` (strategy, red team, orchestrator), `standard` =
`claude-sonnet-5` (most agents), `light` = `claude-haiku-4-5` (capacity arithmetic, extraction).
Overridable by env var.

**Why.** Spec §56 mandates cost awareness. Thirteen agents at the deepest tier on every interaction
is indefensible, and the agents where reasoning quality actually determines plan quality are a
minority. Depth is set with `output_config.effort`, never with sampling parameters — current models
reject `temperature`, `top_p`, `top_k`, and `thinking.budget_tokens`.

## D4 — Structured output via `output_config.format` + Zod

**Decision.** Each agent's Zod schema is compiled to JSON Schema and passed as
`output_config.format`. The response is then Zod-parsed. On failure: one repair round trip with the
validation errors appended; then the agent is marked failed and excluded.

**Why.** Schema-constrained generation plus runtime validation is belt and braces; either alone
leaves a gap. Zod is the single source of truth so the TypeScript types, the model contract, and the
runtime check cannot drift.

## D5 — A deterministic mock provider is a first-class component

**Decision.** `MockProvider` is seeded from a hash of the user's Personal Model and produces
*personalised, differentiated* output — not lorem ipsum.

**Why.** The spec demands the product remain fully functional without credentials, and the evaluation
suite must assert that two personas get different games. A trivial stub would make that assertion
vacuous. This is the component that makes CI meaningful.

**Cost.** The mock's strategy library is hand-authored, so its ceiling is lower than a real model's.
It is a scaffold and a test harness, not a product feature.

## D6 — Server Actions, not a REST API

**Decision.** Mutations are Server Actions co-located with routes. Route handlers exist only where a
non-form protocol is required: streaming council progress and data export.

**Why.** One deployable unit, no duplicated validation between client and server, no API surface to
version. Spec §80 explicitly warns against over-engineering.

## D7 — Conflict detection is deterministic, not model-judged

**Decision.** `detectConflicts()` is pure TypeScript over the agents' structured outputs. Guardian
vetoes, capacity overruns, non-negotiable breaches, priority overload, and contradictory proposed
changes are all mechanical checks.

**Why.** Protection must be reliable. A model asked "is this plan unsafe?" is probabilistic; a check
that reads `nonNegotiables` where `hardness = firm` and compares it against `proposedChanges` is not.
The model's job is to generate options and argue; the guarantee lives in code. This is the mechanism
that makes the core promise architectural rather than aspirational.

## D8 — Append-only score and snapshot history

**Decision.** `lifeScores`, `stateSnapshots`, `intentionSnapshots` never update in place; a
correction writes a new row.

**Why.** The monthly review compares starting state to current state, and the adaptation engine needs
trajectory, not just position. Mutating rows would destroy the comparison the product is built on.

## D9 — Provenance as a table mix-in, not a separate audit log

**Decision.** `source`, `confidence`, `status`, `evidence`, `lastConfirmedAt` are columns on every
claim-bearing table.

**Why.** Provenance is queried on every render ("show me what you inferred"), so it belongs beside
the claim. A join to an audit table on every read would be both slower and easier to forget. The rule
that agents may not overwrite `user_said` rows is enforceable directly in the repository.

## D10 — Ten fixed default domains, user-extensible

**Decision.** Seed the ten domains from the spec on account creation; allow add, rename, reorder, and
deactivate, but never hard-delete (scores reference them).

**Why.** A blank Life Map violates the minimal-input law. Deactivation preserves history that
deletion would orphan.

## D11 — Timezone stored per user, dates computed server-side

**Decision.** `users.timezone` (IANA). "Today" is resolved on the server from that value.

**Why.** Daily play, streak-free protocol modes, and the 30/60/90 timeline all hinge on which day it
is for *this* person. Deriving it from the browser would make the dashboard non-deterministic and
untestable.

## D12 — Fraunces + Inter, self-hosted

**Decision.** Inter for UI, Fraunces for display, both via `next/font`.

**Why.** The design brief calls for premium typography with a distinct voice for life statements. A
serif display face against a neutral sans is the least generic pairing that stays readable. Self-hosting
is required — a strict no-external-requests posture is part of the privacy story.

## D13 — No client-side AI, no client-side agent config

**Decision.** Agent prompts, model ids, routing, and the provider live in server-only modules; the
browser receives only validated, user-facing output.

**Why.** Spec §50/§73. Also protects the prompt library as product IP.

## D14 — Vitest with a Node environment

**Decision.** Vitest, node environment, no jsdom, no browser runner.

**Why.** The logic that carries risk — scoring, conflict detection, provenance precedence, repository
scoping, agent contracts — is all headless. Component rendering tests would add a large dependency
surface to assert far less. Accessibility and responsive behaviour are verified by review against the
checklist in `docs/design-system.md`.

## D15 — Session sliding-window split across the proxy and the render

**Decision.** Extending a session's life is done in two places, deliberately: `getSessionUser()`
extends the **database row** when the remaining life drops below the refresh threshold, and the
proxy re-issues the **cookie** with a fresh `maxAge` on every authenticated navigation.

**Why.** The obvious implementation — do both in `getSessionUser()` — throws at runtime. That
function is called during Server Component render, and Next.js only permits cookie writes from a
Server Action or Route Handler. The failure is invisible in development and in tests: it fires only
once a session is old enough to cross the threshold, so a user would hit a 500 on every page
roughly three weeks after signing in. It was caught by a local smoke test that minted a session
with a deliberately short expiry.

**Alternatives rejected.** *Swallow the cookie write in a try/catch* — the DB row would then outlive
the browser cookie and the user would be silently signed out. *Validate and refresh the session in
the proxy* — the proxy runs on the Edge runtime and must not touch the database, which is the whole
reason `src/lib/auth/constants.ts` exists. The split keeps each write in a context that permits it,
and the proxy needs no database access to do its half.

## D16 — A second live provider (OpenAI), and non-strict structured output

**Decision.** `OpenAIProvider` sits beside `AnthropicProvider` behind the same `AIProvider`
interface, using the Responses API with `reasoning.effort` for depth. Structured output is
requested with `json_schema` and **`strict: false`**, then guaranteed by the Zod parse.

**Why not strict mode.** OpenAI's strict structured outputs require every property to appear in
`required` and every object to set `additionalProperties: false`. No schema with an optional field
can satisfy that, and our artefact schemas are rejected outright with a 400 — verified against the
live API. The documented workaround (mark optionals required-and-nullable) would make the model
emit `null` where Zod expects the key absent, trading a provider error for a validation error.
Non-strict mode still sends the full schema and the model follows it; the Zod parse is what
actually enforces the contract, exactly as on the Anthropic path.

**Model defaults are per provider.** A model id only means something to the vendor serving it, so
`MODELS` resolves against the active provider rather than being a module-level constant. Defaults
were chosen by measurement, not preference: `gpt-5.5` at high effort runs ~59s per call and the
council makes three sequential rounds of them.

**Cost is reported honestly.** Claude rates are priced in code; anything else reads as "Unpriced"
in `/admin` until an operator supplies `AI_PRICING_JSON`. Vendor pricing is not discoverable
through any API, so baking in figures would produce a dashboard that is confidently wrong.

## D17 — Array overflow is trimmed deterministically, not re-requested

**Decision.** When structured output fails validation *only* because arrays exceed their declared
maximum, the overflow is trimmed in code (`src/lib/ai/normalise.ts`) and re-validated, instead of
spending the model repair round trip.

**Why.** Live GPT-5 models ignore `maxItems` in non-strict mode and then ignore it again when the
retry prompt names the exact violation — observed as a hard failure on `GameDraft`, where both
attempts returned six evidence items against a limit of five. A round trip that cannot succeed is
pure latency and cost.

**What it deliberately does not do.** It only ever removes trailing items from an array that
declared a maximum. It never invents a value, never edits one, and never touches any other issue
kind: a number out of range or a missing field still fails and still earns the repair round trip.
Truncating an over-long list is normalisation; filling in a short one would be fabricating the
model's answer. Covered by `tests/unit/normalise.test.ts`, including the case where a sibling
field is out of range and must survive to fail.

## D18 — The dashboard resolves to one next action

**Decision.** The dashboard opens with a single computed next action
(`src/lib/guidance/next-step.ts`), and everything else moves below a "The read behind it"
divider as reference.

**Why.** The previous layout presented six panels of equal visual weight — moves, state,
momentum, protocol, decision, warnings — and left the person to work out where to begin. That is
the decision load Law 1 (minimal input) and Law 6 (simplify aggressively) exist to remove, and we
were imposing it on the very screen the person sees most.

**Ordering is by consequence, not convenience.** A plan currently breaching a protection outranks
an unplanned day, because acting on a breaching plan does damage that finishing today's moves
cannot undo. The urgent interrupt fires only on `non_negotiable_breach`, deliberately *not* on the
full `isBlocking` set — that set fires on most runs by design, and using it here would cry wolf
until the interrupt stopped meaning anything.

## D19 — The Intention Ladder, and why effort is not the measure

**Decision.** A -7 … +7 ladder with two axes per level — the stance being operated from, and the
energy being put out — computed deterministically in `src/lib/scoring/intention.ts` from signals
the system already holds. No model decides the level, and nothing new is persisted.

**The core of the model: LIFT minus DRAG.** Lift is how much of the effort is chosen (alignment,
momentum, follow-through). Drag is how much energy goes into absorbing cost (depletion, sacrifice,
breached protections). Someone can be working extremely hard and still read negative, because
effort aimed at yourself is drag, not lift. Effort alone was never the thing worth measuring.

**Categorical ceilings sit on top of the arithmetic.** Discovered by a failing test: a person at
full alignment, full momentum and complete follow-through, but running on empty, breaching a
protection, with the Sacrifice Radar at `warning`, produced a *higher* lift than drag and read 0 —
"Settling". Settling means accepting less than you want; this person is doing the opposite at
their own expense. A breached protection is now a hard ceiling of -2 (Sacrificing — giving away
what you want for a cause — by definition), and a sacrifice warning caps at 0. Ceilings, not
penalties.

**Terminology.** The scale is the product owner's own: Sovereignty, Surrendering, Seeking,
Striving, Settling, Sacrificing, Struggling, Suffering, paired with Embodying, Knowing,
Committing, Believing, Asking, Wanting, Wishing, Indifference, Resigned, Avoiding, Denying,
Resisting, Suppressing, Resenting, Sabotaging. It was first implemented under original
placeholder wording while provenance was unclear, then replaced with the supplied terminology
once the owner confirmed it twice. All labels live in exactly one file
(`src/lib/intention/scale.ts`), which is what made the swap a single edit.

**One deliberate deviation.** The source definition of Suffering includes the word "illness". The
`experience` copy is rendered to the user as a direct statement about their current state, so
asserting illness would be a health claim, which §6 forbids. That level reads "enduring real pain
and hardship" instead. Terminology is unchanged; only the assertion about the person's health was
dropped.

**Safety.** A level describes a stance being operated from right now, never the person, and is
never framed as clinical (CLAUDE.md §6). A test asserts the bottom rung carries no diagnostic
vocabulary, because the -7 copy is the copy most likely to do harm.
