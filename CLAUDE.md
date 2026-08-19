# CLAUDE.md — LIFE GAME OS

Engineering constitution for this repository. These rules override default behaviour.

---

## 1. Product purpose

LIFE GAME OS is a **Personal Strategy Operating System powered by a multi-agent AI council**.

Core promise: **Win at the highest level without sacrificing your health, your self, or your family.**

It is not a habit tracker, not an OKR tool, not a chatbot, not a questionnaire. It helps a person
design a deeply personal life/career game plan, then protects what they refuse to sacrifice while
they execute it.

The product model is:

```
UNDERSTAND → CLARIFY → DESIGN → PROTECT → PLAY → REFLECT → ADAPT
```

## 2. Originality / IP requirement (non-negotiable)

Reference screenshots supplied by the product owner are **research material only**.

- Never copy branding, logos, proprietary names, workbook pages, exact wording, or exact layouts.
- Never imply affiliation with any source material.
- All terminology, prompts, exercises, visual design, and agent architecture in this repo are original.

Our terminology: Personal Model, Life Map, Whole Goal, Player, Game, Bold Result, Protocol,
Operating State, Intentional Momentum, Sacrifice Radar, Stop List, Protect List, Council.

## 3. The seven product laws

Every feature must obey these. They are enforced in code, not just copy.

1. **Minimal input.** Never ask what can be inferred. When information is missing, ask the single
   highest-value question — never a battery of questions.
2. **AI suggests, always.** No bare empty text field. Every input offers model-derived options with
   `[Use this] [Modify] [Write my own]`.
3. **Provenance is explicit.** Every fact carries a source: `user_said`, `ai_inferred`,
   `ai_suggested`, `user_confirmed`, `ai_generated`. Never render an inference as a fact.
4. **The user can always correct the AI.** Confirm/Correct affordances on every inference.
5. **Sacrifice is surfaced.** Any plan change is scored for cost across life domains. Excessive cost
   raises a strategy warning and generates alternatives — we change the strategy, not the ambition.
6. **Simplify aggressively.** More than 3 active priorities triggers an explicit reduction proposal.
7. **Explainability.** Every plan answers "Why this plan?" and "What we are not doing."

## 4. Architecture rules

- **One** Next.js app, **one** repo, **one** database, **one** AI abstraction, modular agents.
  Do not introduce microservices, queues, or a separate API service.
- Next.js App Router. Server Components by default; `"use client"` only where interaction requires it.
- **All AI calls are server-side.** No API key, prompt, or agent config may reach the browser.
- Mutations go through Server Actions in `src/app/**/actions.ts` or route handlers. Every one must
  re-verify the session and scope every query by `userId`.
- Database access only through `src/lib/db`. No raw SQL in components.
- Shared types live in `src/schemas`. Zod schema is the single source of truth; derive TS types with
  `z.infer`, never hand-write a parallel interface.

## 5. AI rules

- Provider access only via the `AIProvider` interface (`src/lib/ai/provider.ts`). Never import a
  vendor SDK (`@anthropic-ai/sdk`, `openai`) outside `src/lib/ai/providers/`, and never from a
  provider module other than its own.
- Model ids are per provider. Read them from `MODELS[tier]`, never hard-code one: a Claude id sent
  to OpenAI is a 400.
- Structured output only. Use `output_config.format` with a JSON Schema derived from the agent's Zod
  schema, then validate. Never parse free-form prose where a schema is possible.
- Invalid output → one repair attempt → then fail closed with the user's existing plan intact.
- **Never send `temperature`, `top_p`, `top_k`, or `thinking.budget_tokens`** — current models reject
  them. Control depth with `output_config.effort`.
- Model tiering is mandatory for cost control (see `docs/agent-architecture.md`). Simple updates and
  deterministic scoring must not invoke the council.
- Never store or expose private chain-of-thought. Persist concise, user-facing reasoning summaries
  and evidence references only.
- If no provider key is present, the deterministic `MockProvider` takes over so the whole product
  stays functional. Mock output must remain *personalised* — it reads the Personal Model.

## 6. Safety rules

- **Health:** no diagnosis, no treatment, no medication, no clinical claims, never impersonate a
  therapist. Wellness framing only ("this may be worth discussing with a qualified professional").
- **Finance:** frameworks and trade-offs only; never present regulated financial advice as professional advice.
- **Psychology:** never diagnose. Use "possible pattern", "potential blind spot",
  "behavioural tendency observed" — always with confidence and evidence, always correctable.
- Scores (Game Health, Operating State, Intentional Momentum) evaluate *the plan*, never the person's
  worth, and are never framed as clinical or scientific.

## 7. Coding standards

- TypeScript `strict`. No `any` in committed code; use `unknown` + a Zod parse at boundaries.
- Named exports, except Next.js route/page/layout files which require default exports.
- Files under ~350 lines. Extract when a module grows past one clear responsibility.
- Tailwind utilities with design tokens from `globals.css`. **No hard-coded hex values in components** —
  use semantic tokens (`bg-surface`, `text-ink-muted`, `border-line`).
- Comments explain constraints and non-obvious *why*, never restate the next line.
- Errors: never surface stack traces or provider errors to users. Use the copy in
  `src/lib/errors.ts` ("I couldn't complete that analysis. Your existing plan is safe.").

## 8. Database rules

- PostgreSQL + Drizzle ORM. Schema in `src/lib/db/schema.ts`, migrations in `drizzle/`.
- Local development uses PGlite (embedded Postgres, `.data/pglite`) so the app runs with **zero setup**.
  Production uses a real Postgres via `DATABASE_URL`. One dialect, one set of migrations.
- Every user-owned table has `userId` with `onDelete: "cascade"` so account deletion is complete.
- Provenance columns (`source`, `confidence`, `status`, `lastConfirmedAt`) are required on any table
  holding a claim about the user.
- Never log personal data. Log ids and counts.

## 9. Testing requirements

- `npm run verify` must pass before any milestone is considered done:
  lint → typecheck → test → build.
- Unit tests for scoring, provenance, capacity, and sacrifice logic (pure functions).
- Agent tests run against the deterministic MockProvider — no network in tests.
- Evaluation tests assert the eight qualities in `docs/evaluation-plan.md`, including that two
  personas with the same stated goal receive materially different games.

## 10. Deployment

- Target Vercel. `DATABASE_URL`, `SESSION_SECRET`, `ANTHROPIC_API_KEY` as environment variables.
- `.env.example` documents every variable. Never commit secrets.
- `.data/` (local PGlite) is git-ignored.

## 11. Definition of done for a feature

Functional (it really works and persists) · UX (intuitive, minimal input) · Visual (premium) ·
AI (personalised, provenance-tagged) · Strategic (recommendation is useful) · Safe (no overclaiming) ·
Performant · Accessible (keyboard, semantics, contrast, reduced-motion).

"The page renders" is not done.
