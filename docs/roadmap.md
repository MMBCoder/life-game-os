# Implementation Roadmap

Each milestone ends with `npm run verify` green (lint → typecheck → test → build) and its docs updated.

| M | Milestone | Done when | Status |
| --- | --- | --- | --- |
| M0 | Foundation | App boots clean; Tailwind v4 tokens live; strict TS; dual-driver DB abstraction; auth architecture; AI provider abstraction; architecture documented | ✅ |
| M1 | Design system | Full primitive set + signature-component shells; UI looks premium before any AI exists | ✅ |
| M2 | Landing page | Reads like a real premium product, not a sales page | ✅ |
| M3 | Onboarding | Three questions → meaningful initial Personal Model + Personal Snapshot | ✅ |
| M4 | Personal Model | Identity, values, domains, constraints, non-negotiables, energy, observations, memory; app can explain what it knows | ✅ |
| M5 | Life Map | Wheel with current/desired, outer/inner, gaps, importance, energy, momentum | ✅ |
| M6 | Whole Goal | Result / Experience / Impact / Identity from minimal input | ✅ |
| M7 | Player | Player identity + Ask My Player working | ✅ |
| M8 | Game | Name, purpose, winning + non-winning definition, 3 bold results, 30/60/90, stop list, protect list, leverage, risks | ✅ |
| M9 | AI Council | All 13 agents; parallel analysis; objections; conflict detection; red team; orchestrated decision; persisted | ✅ |
| M10 | Protocol | Minimum / Standard / Expansion + rituals + routines fitted to real life | ✅ |
| M11 | Daily Play | Daily game, three moves, state, intention, protocol, one decision | ✅ |
| M12 | Reflection | Daily, weekly, monthly reviews with generated intelligence | ✅ |
| M13 | Adaptation | State changes, plan updates, goal changes, game recalibration, protocol adaptation | ✅ |
| M14 | Evaluation | Six personas, agent tests, personalisation + safety + regression suites | ✅ |
| M15 | Production | Vercel-ready, env documented, logging, error handling, performance + a11y pass | ✅ |

## Sequencing rationale

Design system before features (M1 before M3) so no screen is ever retrofitted. Deterministic scoring
before agents (in M5–M8) so the council has real numbers to argue about rather than inventing them.
Council after the artefacts it operates on exist (M9 after M8) so negotiation has genuine subject
matter. Evaluation last but designed first — the assertions in `docs/evaluation-plan.md` were written
before the agents.

## Deliberately deferred

- Real-time collaboration / sharing a game with a coach.
- Calendar and wearable integrations (the Reality Mapper is designed to accept them later).
- PDF export rendering (JSON + printable HTML export ships now; the styled PDF is a later pass).
- Embeddings-backed semantic memory retrieval (the `embed()` provider method exists; retrieval is
  currently recency + confidence weighted, which is sufficient at this data volume).
