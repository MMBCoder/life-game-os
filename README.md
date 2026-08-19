# LIFE GAME OS

**A personal strategy operating system powered by a multi-agent AI council.**

> Win at the highest level without sacrificing your health, your self, or your family.

Most planning tools help you go faster. This one asks what going faster is costing you, refuses
to fund your ambition from the things you said you would never trade, and then redesigns the
strategy so you can have both. The ambition is never the thing that gets cut.

```
UNDERSTAND -> CLARIFY -> DESIGN -> PROTECT -> PLAY -> REFLECT -> ADAPT
```

---

## Table of contents

1. [Quick start](#quick-start)
2. [What it actually does](#what-it-actually-does)
3. [Architecture](#architecture)
4. [The agent council](#the-agent-council)
5. [Environment variables](#environment-variables)
6. [Database and migrations](#database-and-migrations)
7. [Scripts](#scripts)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [Project structure](#project-structure)
11. [Safety, privacy and IP](#safety-privacy-and-ip)
12. [Further documentation](#further-documentation)

---

## Quick start

Requires **Node.js 20+**. No database server, no API key, no Docker.

```bash
npm install
npm run db:seed     # applies migrations and builds the demo account
npm run dev         # http://localhost:3000
```

Sign in with the seeded demo account:

| | |
|---|---|
| **Email** | `demo@lifegameos.local` |
| **Password** | `demo-account-password` |

That account has already been through the whole journey: personal model, life map, whole goal,
Player, a council-designed game, sacrifice radar, protocol, a day's plan, a weekly review, an
insight plan and a recorded Player decision. Open `/dashboard` to see it.

To start clean instead, skip `db:seed`, run `npm run dev`, and create an account at `/sign-up`.
The embedded database migrates itself on first use.

**Two things worth knowing up front:**

- **No AI credentials are required.** With neither `ANTHROPIC_API_KEY` nor `OPENAI_API_KEY` set,
  the app runs on a deterministic mock provider that reads your actual Personal Model and produces
  genuinely different output for different people. It is not a stub — the whole product works.
  Supply either key to run the council on a real model.
- **No Postgres install is required.** Locally the app runs PGlite, a real Postgres compiled to
  WASM, persisted to `.data/pglite`. Production uses a normal Postgres. Same dialect, same
  migrations, same ORM.

---

## What it actually does

| Area | What it is |
|---|---|
| **Personal Model** | Identity, values, strengths, overdone strengths, constraints, non-negotiables and behavioural patterns. Every entry is tagged with its source and confidence. |
| **Life Map** | Ten domains scored on two separate axes — the **outer result** (how it looks) and the **inner experience** (how it feels). The gap between them is the divergence the product is built to surface. |
| **Whole Goal** | A goal in four dimensions: Result, Experience, Impact, Identity. A goal that only has a Result is how people win and feel nothing. |
| **Player** | The version of you your current game requires. Designed as three candidates; you choose. "Ask My Player" turns it into a decision engine. |
| **Game** | Exactly three Bold Results, a strategy hierarchy above the task level, and a leverage plan drawn from fifteen categories. |
| **Sacrifice Radar** | Every plan is scored for its cost across all ten domains before it is committed. |
| **Protect List / Stop List** | What is defended, and what has to stop to fund the plan. |
| **Protocol** | Three modes — Minimum, Standard, Expansion — so a bad week degrades the plan instead of ending it. |
| **Operating State** | Eight states with drivers, governing what today's plan is allowed to ask of you. |
| **Intention Ladder** | Fifteen levels from −7 to +7. Each pairs the stance you are operating from with the energy you are putting out. Computed deterministically as chosen effort minus absorbed cost — so working hard *against* yourself reads negative, because effort alone was never the measure. |
| **Daily play** | Three moves a day: one strategic, one for the self, one for a relationship. The composition is fixed by construction. |
| **Reflection** | Weekly intelligence and monthly review that feed the adaptive engine. |
| **Insight Plan** | An eighteen-section personal strategy document, plus blind spots stated as hypotheses with evidence and confidence — never as verdicts. |
| **Council Room** | Full transparency: which agents ran, what each argued, where they disagreed, what was vetoed and why. |

### The protection guarantee

The thing that makes protection real rather than aspirational: **conflict detection is deterministic
TypeScript, not a model judgement.** Structured agent output is run through six pure detectors in
[src/lib/scoring/conflicts.ts](./src/lib/scoring/conflicts.ts):

| Detector | Fires when |
|---|---|
| `non_negotiable_breach` | The plan touches something marked **firm**. Hard block. |
| `guardian_veto` | The Health or Relationship Guardian objects at severity high or above. |
| `capacity_overrun` | The plan needs more hours than the person has. |
| `priority_overload` | More than three active priorities. |
| `contradictory_change` | The plan reverses a change made recently. |
| `red_team_block` | The Red Team finds a failure mode that invalidates the plan. |

A model can be persuaded. `if (hardness === 'firm') return blocked` cannot.

---

## Architecture

One Next.js application, one repository, one database, one AI abstraction, modular agents. No
microservices, no queues, no separate API service.

```
+-------------------------------------------------------------------+
|  App Router (React 19 Server Components + Server Actions)         |
|  Client components only where interaction requires them           |
+-------------------------------+-----------------------------------+
                                |  every mutation re-verifies session
+-------------------------------v-----------------------------------+
|  Services  (src/services)                                         |
|  onboarding . lifemap . goal . player . game . protocol           |
|  daily . reflection . insight . adaptation                        |
+-------+----------------------------------+------------------------+
        |                                  |
+-------v-----------------+   +------------v----------------------+
|  Orchestrator           |   |  Scoring (pure functions)         |
|  src/agents             |   |  conflicts . capacity . momentum  |
|  routing -> parallel    |   |  sacrifice . game-health          |
|  analysis -> objection  |   |  divergence . intention           |
|  exchange -> red team   |   |                                   |
|  -> conflicts -> synth  |   |  Deterministic. Unit-tested.      |
+-------+-----------------+   +------------+----------------------+
        |                                  |
+-------v-----------------+   +------------v----------------------+
|  AI abstraction         |   |  Data layer (src/lib/db)          |
|  src/lib/ai             |   |  Drizzle ORM . PostgreSQL         |
|  AIProvider interface   |   |  PGlite (local) | postgres-js     |
|  |- AnthropicProvider   |   |  Repositories scope every query   |
|  |- OpenAIProvider      |   |  by userId                        |
|  \- MockProvider        |   |                                   |
|     (deterministic)     |   |                                   |
+-------------------------+   +-----------------------------------+
```

**Rules the codebase enforces:**

- All AI calls are server-side. No key, prompt or agent config can reach the browser. Server-only
  modules import `server-only`, which fails the build if they end up in a client bundle.
- A vendor SDK is importable only from its own file under `src/lib/ai/providers/` —
  [anthropic.ts](./src/lib/ai/providers/anthropic.ts) and [openai.ts](./src/lib/ai/providers/openai.ts).
  Nothing above the provider seam knows which model answered.
- Zod schemas in `src/schemas` are the single source of truth. TypeScript types are derived with
  `z.infer`; the JSON Schema sent to the model is derived with `z.toJSONSchema`. One definition,
  three consumers, no drift.
- Database access only through `src/lib/db`. Every user-owned table cascades on user delete.
- Every claim about the user carries `source`, `confidence`, `status` and `lastConfirmedAt`. An
  inference is never rendered as a fact, and an agent can never overwrite something the user said.

### Structured output

Agents do not return prose. Each returns a Zod-validated envelope containing its position,
reasoning summary, evidence references, questions (each with a value score, so the system can
surface only the single highest-value one) and objections. Invalid output gets exactly one repair
round trip, then fails closed with the user's existing plan untouched.

### The mock provider is a real feature

`MockProvider` classifies the Personal Model into an archetype — `constrained_ambitious`,
`depleted`, `high_capacity_accelerator`, `identity_shifter`, `hollow_winner`, `provider_optimiser`
— seeds a hash from the model, and composes output from a hand-authored library keyed on that
archetype. Its output is then validated against the same Zod schema the real provider is held to.

This is what makes the evaluation suite meaningful: it can assert that two personas with the same
stated goal receive materially different games, with no network calls and no flakiness.

---

## The agent council

Thirteen agents. Each has a charter in [src/prompts/agents.ts](./src/prompts/agents.ts)
defining its remit, what it explicitly may **not** decide, and its objection rights.

| Agent | Label | Remit |
|---|---|---|
| `orchestrator` | Life Architect | Convenes the council and synthesises the decision |
| `identity` | Identity | Current, emerging and desired identity; identity tension |
| `reality` | Reality Mapper | The situation as it actually is, including what is being avoided |
| `goal` | Goal Architect | The Whole Goal across all four dimensions |
| `player` | Player Designer | Who this person must become to play this game |
| `strategy` | Strategy | Bold Results, leverage, the strategy hierarchy |
| `health` | Health Guardian | **Veto right.** Sustainability of the plan |
| `relationships` | Relationship Guardian | **Veto right.** Cost to the people around them |
| `capacity` | Capacity | Time and energy honesty; what will not fit |
| `redTeam` | Red Team | How this plan fails. Runs on the second pass, seeing everything |
| `execution` | Execution | Protocol, rituals, routines, the daily three |
| `reflection` | Reflection | Weekly and monthly intelligence |
| `adaptation` | Adaptation | What to change when reality disagrees with the plan |

**How a run works** ([src/agents/orchestrator.ts](./src/agents/orchestrator.ts)):

1. **Routing** — the purpose selects the relevant agents. Not every question needs thirteen.
2. **Parallel analysis** — first-pass agents run concurrently.
3. **Objection exchange** — each agent sees its peers' positions and may object.
4. **Red team** — runs last, with the whole picture.
5. **Deterministic conflict detection** — pure TypeScript over the structured output.
6. **Synthesis** — the decision, the trade-offs, what was rejected, and exactly one question.

Cost is controlled by model tiering (deep / standard / light), routing, and a hard ceiling on
agents per run that trims the first pass only — the guardians and the red team are never trimmed.

Every run is persisted: agents invoked, latency, tokens, cost, validation outcome, conflicts,
objections. Visible at `/admin` and `/council`. Private chain-of-thought is never stored or shown —
only concise user-facing reasoning summaries and evidence references.

### How long a real council run takes

The mock provider answers instantly. A live reasoning model does not, and the council makes three
sequential rounds of calls (parallel analysis → red team → synthesis), so the wait is the sum of
the slowest call in each round. Measured on OpenAI with six agents:

| Configuration | Full council run |
|---|---|
| `deep=gpt-5.4` (default) | ~7 minutes |
| `deep=gpt-5.4-mini`, `standard=gpt-5.4-nano` | ~2 minutes |
| `deep=gpt-5.5` | ~10 minutes |

This is inherent to reasoning models rather than a defect, but it has two consequences worth
planning for. Lower `AI_MAX_AGENTS_PER_RUN` to trim the first pass — guardians and red team are
never trimmed, so protection is unaffected. And on a host that caps request duration (Vercel's
serverless functions default well below this), a full council will need a raised limit or a
background job; the single-artefact calls, at roughly 10–30 seconds, are unaffected.

---

## Environment variables

Copy [.env.example](./.env.example) to `.env.local`. Every variable is optional for local
development.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Production only | *unset* → PGlite | Postgres connection string. When unset the app uses the embedded database at `.data/pglite`. |
| `SESSION_SECRET` | **Production** | dev-only fallback | Signing secret for session cookies. Generate with `openssl rand -base64 48`. |
| `ANTHROPIC_API_KEY` | No | *unset* → mock | Enables the real council on Claude. |
| `OPENAI_API_KEY` | No | *unset* → mock | Enables the real council on GPT-5. Supply either key, or neither. |
| `AI_PROVIDER` | No | `auto` | `auto` \| `anthropic` \| `openai` \| `mock`. `auto` prefers Anthropic, then OpenAI, then the mock. Set `mock` to force determinism even with a key. |
| `AI_MODEL_DEEP` | No | per provider | Council synthesis, insight plan, blind spots. |
| `AI_MODEL_STANDARD` | No | per provider | Most agent analysis. |
| `AI_MODEL_LIGHT` | No | per provider | Suggestions, short rewrites, classification. |
| `AI_MODEL_EMBEDDING` | No | `text-embedding-3-small` | OpenAI only. Unused today; reserved for semantic memory retrieval. |
| `AI_MAX_AGENTS_PER_RUN` | No | `8` | Hard ceiling per council run. Guardians and red team are exempt. |
| `AI_PRICING_JSON` | No | — | Cost rates in USD per million tokens, e.g. `{"gpt-5.4":{"input":1.25,"output":10}}`. See [cost reporting](#cost-reporting). |
| `ENABLE_ADMIN` | No | `true` | Exposes `/admin` (agent runs, latency, cost, validation, conflicts). Set `false` in production. |
| `NEXT_PUBLIC_APP_URL` | No | — | Absolute URLs in exports. |

**Leave the three `AI_MODEL_*` variables unset unless you mean to override them.** Defaults follow
the active provider, and a Claude model id sent to OpenAI — or the reverse — is a 400:

| Tier | Anthropic | OpenAI |
|---|---|---|
| `deep` | `claude-opus-5` | `gpt-5.4` |
| `standard` | `claude-sonnet-5` | `gpt-5.4-mini` |
| `light` | `claude-haiku-4-5` | `gpt-5.4-nano` |

### Cost reporting

Claude model rates are priced in code. Any other model is reported in `/admin` as **Unpriced**
rather than `$0.00` until you supply a rate through `AI_PRICING_JSON` — vendor prices change and
are not discoverable through any API, so the dashboard is either right or visibly silent, never
confidently wrong about spend.

Never commit real values. `.env.local` and `.data/` are git-ignored.

---

## Database and migrations

PostgreSQL via Drizzle ORM. One dialect and one set of migration files for both drivers.

| | Local | Production |
|---|---|---|
| Driver | PGlite (embedded Postgres, WASM) | postgres-js |
| Storage | `.data/pglite` | Your Postgres instance |
| Migration | Automatic on first use | Explicit: `npm run db:migrate` |

Production is never migrated implicitly. Applying schema changes to real data is a deliberate,
reviewable deploy step.

```bash
# after editing src/lib/db/schema/*
npm run db:generate     # writes SQL into drizzle/

# apply them
npm run db:migrate      # local when DATABASE_URL is unset; production when it is set

# start over locally (refuses to run when DATABASE_URL is set)
npm run db:reset
npm run db:seed
```

Schema lives in `src/lib/db/schema/`, migrations in `drizzle/`, repositories in
`src/lib/db/repositories/`. Every user-owned table has a `userId` foreign key with
`onDelete: 'cascade'`, so account deletion is genuinely complete rather than a soft flag.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (bans `any`; bans `console.log` to keep personal data out of logs) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Full Vitest suite |
| `npm run test:eval` | Evaluation suite only |
| `npm run verify` | **The gate:** lint -> typecheck -> test -> build |
| `npm run format` | Prettier |
| `npm run db:generate` | Generate migrations from the schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Migrate and build the demo account |
| `npm run db:reset` | Delete the local embedded database |

---

## Testing

156 tests across four layers. No network calls — agent tests run against the deterministic mock
provider, so they are fast and cannot flake.

| Suite | Covers |
|---|---|
| `tests/unit` | Scoring and all six conflict detectors as pure functions |
| `tests/integration` | Repositories against a real PGlite instance: provenance rules, game invariants, tenant scoping, cascade delete |
| `tests/agent` | All thirteen agents produce schema-valid output; routing; guardian objections; the one-question rule; graceful degradation when an agent fails; determinism; cost accounting |
| `tests/evaluation` | Six synthetic personas across eight qualities, plus the differentiation test |

The evaluation suite is the interesting one. Six personas —
`executive-with-family`, `entrepreneur-near-burnout`, `young-professional`, `career-changer`,
`hollow-winner`, `provider` — each declaring what the system must protect, what it must never
produce, and what capacity it should read. It asserts:

1. The plan is personalised, not generic.
2. Non-negotiables are never funded from.
3. Capacity is read honestly.
4. Ambition is preserved when a conflict is found — the strategy changes, not the goal.
5. Exactly one question is surfaced.
6. Nothing crosses the safety line (regex denylist for diagnostic, prescriptive and clinical language).
7. Every inference carries provenance and confidence.
8. Two personas with the same stated goal receive materially different games.

This suite has already caught two real product bugs that every other test passed: protected domains
being scored as a cost in the Sacrifice Radar, and capacity reading `overloaded` the moment a
leverage plan — whose entire purpose is to return capacity — was committed to.

```bash
npm run test          # everything
npm run test:eval     # the persona suite
npm run verify        # the full gate, required before any milestone is done
```

---

## Deployment

Target: **Vercel**, though any Node host works.

> **`DATABASE_URL` is mandatory on any serverless host.** Without it the app falls back to
> the embedded database, which writes to the deployment's own filesystem — read-only,
> per-instance, and discarded on every cold start. Accounts and history would vanish between
> visits. The app now refuses to start in that configuration rather than appear to work; see
> [Why history needs a real database](#why-history-needs-a-real-database).

1. **Provision Postgres** — Vercel Postgres, Neon, Supabase, RDS, anything. Copy the pooled
   connection string.
2. **Set environment variables** on the host:
   ```
   DATABASE_URL=postgres://...?sslmode=require   # required
   SESSION_SECRET=<openssl rand -base64 48>      # required
   OPENAI_API_KEY=sk-proj-...                    # or ANTHROPIC_API_KEY; omit for the mock
   ENABLE_ADMIN=false                            # recommended in production
   ```
3. **Create the tables** — once, and again after any schema change. The app never migrates a
   real database on its own, because doing that implicitly to live data is not something a
   deploy should decide. Either run it yourself:
   ```bash
   DATABASE_URL=... npm run db:migrate
   ```
   …or opt in on the host by setting Vercel's **Build Command** to:
   ```
   npm run db:migrate && npm run build
   ```
4. **Deploy.** Push to Vercel, or `npm run build && npm run start` anywhere else.

Miss step 3 and the first sign-up returns a 500 with `relation "users" does not exist` — the
tables simply are not there yet.

### Why history needs a real database

Signing in does not create your data; it just identifies you. Every record — personal model,
life map, whole goal, Player, game, protocol, daily plans, reflections, decisions, memory — is
keyed to your `userId`, so signing in with the same credentials always resumes exactly where you
left off, and the dashboard's next action is recomputed from that state. Sessions are separate,
short-lived rows; deleting one logs you out without touching anything you have built.

That design only holds if the rows survive, which is what `DATABASE_URL` guarantees. Locally,
with no `DATABASE_URL`, PGlite persists to `.data/pglite` on your disk and history survives
restarts perfectly well — it is only ephemeral serverless filesystems that break the promise.

`@electric-sql/pglite` and `postgres` are declared in `serverExternalPackages`, so the bundler
leaves the native/WASM drivers alone. Security headers are set in
[next.config.ts](./next.config.ts). Do not deploy without `SESSION_SECRET` — the development
fallback is not a secret.

---

## Project structure

```
src/
  app/
    (marketing)/        landing page
    (auth)/             sign-in, sign-up, auth server actions
    (app)/              discover . dashboard . life . goal . player . game
                        protocol . reflection . insight . council . admin . settings
    api/export/         full data export
  agents/               routing table, orchestrator (the council run)
  prompts/              the thirteen agent charters
  schemas/              Zod: common, agent, artefacts - the single source of truth
  services/             one module per product surface
  lib/
    ai/                 AIProvider interface, Anthropic provider, mock provider
    db/                 client, schema, migrations, repositories
    scoring/            conflicts, capacity, momentum, sacrifice, game-health, divergence
    personalization/    context assembly for a council run
    auth/               password hashing, sessions
    memory/             stable / dynamic / episodic layers with confidence
  components/
    ui/                 buttons, cards, fields, provenance chips, suggestions, dialogs
    life-wheel/         dual-polygon life map with divergence connectors
    game/               sacrifice radar, game timeline
    council/            council graph
  proxy.ts              session gate (Next 16's middleware convention)
docs/                   product spec, architecture, agents, data model,
                        design system, evaluation plan, roadmap, decisions
drizzle/                generated SQL migrations
scripts/                migrate . seed . reset
tests/                  unit . integration . agent . evaluation
```

---

## Safety, privacy and IP

**Health.** No diagnosis, no treatment, no medication, no clinical claims, and never impersonating
a therapist. Wellness framing only, with a pointer to a qualified professional where relevant.

**Finance.** Frameworks and trade-offs only. Nothing is presented as regulated financial advice.

**Psychology.** Blind spots are hypotheses — "possible pattern", "behavioural tendency observed" —
always with evidence and a confidence value, and always correctable by the user. Game Health,
Operating State and Intentional Momentum evaluate *the plan*, never the person's worth.

**Privacy.** Session-authenticated, every query scoped by `userId`. Full export at `/api/export`.
Account deletion cascades across every table. Logs carry ids and counts, never personal content —
`console.log` is banned by lint specifically to keep it that way. No secret ever reaches the client.

**Originality.** All terminology, prompts, exercises, visual design, agent architecture and copy in
this repository are original. Reference material supplied during the build was research only:
nothing is copied, and no affiliation with any source material is implied.

---

## Further documentation

| Document | Contents |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | Engineering constitution — the rules this codebase is held to |
| [docs/product-spec.md](./docs/product-spec.md) | The full product model |
| [docs/architecture.md](./docs/architecture.md) | System architecture in depth |
| [docs/agent-architecture.md](./docs/agent-architecture.md) | Charters, routing, negotiation, model tiering |
| [docs/data-model.md](./docs/data-model.md) | Entities, provenance, the memory layers |
| [docs/design-system.md](./docs/design-system.md) | Palette, type scale, motion, accessibility |
| [docs/evaluation-plan.md](./docs/evaluation-plan.md) | The eight qualities and how they are measured |
| [docs/roadmap.md](./docs/roadmap.md) | Milestones M0-M15 |
| [docs/decisions.md](./docs/decisions.md) | Every architectural decision, with the alternatives and why they lost |

---

## Licence

MIT — see [LICENSE](./LICENSE).
