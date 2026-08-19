# Architecture — LIFE GAME OS

## 1. Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) | Server-first rendering, Server Actions, one deployable unit on Vercel |
| Language | TypeScript (strict) | Schema-derived types end to end |
| Styling | Tailwind CSS v4 + CSS custom properties | Design tokens in one place, no runtime CSS engine |
| Database | PostgreSQL | Relational integrity for a heavily-related model; JSONB where shape is fluid |
| ORM | Drizzle | Typed SQL, plain migrations, no code generation step at runtime |
| Local DB | PGlite (embedded Postgres, WASM) | The app runs with **zero** setup; identical SQL dialect to production |
| Validation | Zod | One schema drives TS types, JSON Schema for the model, and runtime validation |
| AI | Anthropic (`claude-*`) behind an `AIProvider` interface | Provider-swappable; deterministic mock for offline/dev/test |
| Auth | Custom: scrypt + DB-backed sessions in an HTTP-only cookie | No third-party dependency for very sensitive data; small, auditable surface |
| Tests | Vitest | Fast, ESM-native, no browser needed for the logic that matters |

## 2. Layout

```
life-game-os/
├── src/
│   ├── app/
│   │   ├── (marketing)/          landing, how-it-works
│   │   ├── (auth)/               sign-in, sign-up
│   │   ├── (app)/                authenticated shell + all product routes
│   │   │   ├── dashboard/  discover/  life/  goal/  player/  game/
│   │   │   ├── protocol/   reflection/  insight/  council/  settings/
│   │   │   └── admin/
│   │   └── api/                  route handlers (streaming council, export)
│   ├── components/
│   │   ├── ui/                   primitives: Button, Card, Field, Dialog, …
│   │   ├── life-wheel/  game/  player/  protocol/  council/  charts/
│   ├── agents/                   one directory per agent
│   ├── lib/
│   │   ├── ai/                   provider interface, Anthropic + Mock providers
│   │   ├── db/                   schema, client, repositories
│   │   ├── memory/               stable / dynamic / episodic layers
│   │   ├── scoring/              deterministic scoring (no LLM)
│   │   ├── personalization/      context builder
│   │   └── validation/           Zod → JSON Schema, repair
│   ├── schemas/                  shared Zod schemas
│   └── prompts/                  agent system prompts + shared framing
├── drizzle/                      SQL migrations
├── docs/
└── tests/                        unit · integration · agent · evaluation
```

## 3. Request flow

### 3.1 Read path

Server Component → repository (`src/lib/db/repositories/*`) → Drizzle → Postgres. Rendered on the
server. Client components receive plain serialisable props.

### 3.2 Mutation path

```
Client component
  → Server Action (src/app/(app)/**/actions.ts)
      → requireSession()                  // re-verified, never trusted from the client
      → Zod parse of the input
      → repository write  (scoped by userId)
      → revalidatePath()
```

### 3.3 Council path (the interesting one)

```
Server Action / route handler
  → buildContext(userId, purpose)          // src/lib/personalization
  → route(purpose)                         // which agents are actually needed
  → Promise.all(agent.run(ctx))            // parallel analysis
  → detectConflicts(outputs)               // deterministic, src/lib/scoring
  → redTeam.run(ctx, outputs, conflicts)   // only for significant decisions
  → orchestrator.synthesize(...)           // final recommendation
  → persist agentRuns + agentConflicts + agentDecision
  → return CouncilDecision to the UI (with reasoning summaries + evidence refs)
```

**Agent routing keeps cost sane.** A daily reflection runs three agents. A career decision runs
seven plus red team. A slider change runs none — deterministic scoring only.

## 4. Data layer

`src/lib/db/client.ts` picks a driver at runtime:

- `DATABASE_URL` set → `postgres-js` over the real database.
- Unset → PGlite persisted to `.data/pglite`.

Both are wrapped in the same `NodePgDatabase`-compatible Drizzle interface, so no calling code knows
the difference. Migrations in `drizzle/` are plain SQL and applied by the same runner in both cases.

`@electric-sql/pglite` is listed in `serverExternalPackages` so Next never tries to bundle its WASM.

## 5. AI layer

```ts
interface AIProvider {
  readonly name: string;
  generate(req: GenerateRequest): Promise<GenerateResult>;
  structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
  stream(req: GenerateRequest): AsyncIterable<StreamChunk>;
  embed(texts: string[]): Promise<number[][]>;
}
```

- `AnthropicProvider` — real calls. Structured output uses `output_config.format` with the JSON
  Schema compiled from the agent's Zod schema; the response is then Zod-parsed. One repair attempt on
  failure, then fail closed.
- `MockProvider` — deterministic, seeded from a hash of the user's Personal Model, so the entire
  product works without credentials **and still produces personalised, differentiated output**. This
  is what makes the evaluation suite runnable in CI.

Selection is automatic: `ANTHROPIC_API_KEY` present → Anthropic, else Mock. `AI_PROVIDER` can force
either.

Never sent: `temperature`, `top_p`, `top_k`, `thinking.budget_tokens` — current models reject them.
Depth is controlled with `output_config.effort` per agent tier.

## 6. Memory

Three layers over one `memoryItems` table, discriminated by `layer`:

- **stable** — values, principles, identity, non-negotiables, long-term preferences.
- **dynamic** — current goals, workload, game, energy, priorities.
- **episodic** — decisions, wins, hard weeks, insights, failures, breakthroughs.

Retrieval for context building is recency- and confidence-weighted, capped by a token budget, and
prefers `user_confirmed` over `ai_inferred` when the two disagree.

## 7. Security

- Passwords: `scrypt` (N=16384, r=8, p=1) with a per-user 16-byte salt, timing-safe comparison.
- Sessions: 32-byte random token, SHA-256 hashed at rest, HTTP-only + `SameSite=Lax` + `Secure` in
  production, 30-day sliding expiry, revocable.
- Authorisation: every repository function takes `userId` and filters on it. There is no unscoped read.
- Middleware guards the `(app)` group; Server Actions re-verify independently (defence in depth).
- Export (`/api/export`) and hard delete (cascade) are both implemented — not stubs.
- Logs carry ids and counts only. Never personal content, never prompts containing it.

## 8. Performance

- Server Components for all read-heavy pages; the Life Wheel and timeline are the only substantial
  client components.
- The council runs agents in parallel and streams progress so the UI is never blocked on a spinner.
- Deterministic scoring (game health, capacity, sacrifice, momentum) is pure TypeScript — instant,
  free, and unit-testable.
- Fonts self-hosted via `next/font`. No external stylesheet or script.

## 9. Error handling

`src/lib/errors.ts` maps every failure class to safe user-facing copy. Provider timeout, invalid
model output, missing context, DB failure, rate limit, and auth failure each have a distinct message
and none of them leak internals. The invariant on any AI failure is: **the user's existing plan is
untouched.**
