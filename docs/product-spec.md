# Product Specification — LIFE GAME OS

> **Build a life worth winning.**
> Your ambition. Your life. One game plan.

## 1. The problem

High performers are handed a false trade: succeed, or be well. The tools available reinforce it —
they optimise output, count habits, and are indifferent to what the output costs. Nothing in a
productivity dashboard notices that a person's career score is climbing while their health and
family scores fall.

## 2. The product

A Personal Strategy Operating System. The user brings ambition and constraints; the system brings
strategy, protection, and adaptation, executed by a council of specialised AI agents that argue with
each other before recommending anything.

The system does the thinking. The user contributes conversation, choices, confirmations,
corrections, ratings, and occasional reflection.

## 3. The journey

```
DISCOVER → PERSONAL MODEL → LIFE MAP → WHOLE GOAL → PLAYER → GAME
        → PROTOCOL → DAILY PLAY → REFLECTION → ADAPTATION → NEXT GAME
```

Each stage is usable on its own and each produces an artefact the user can read, correct, and export.

## 4. Core concepts

### 4.1 Personal Model

The persistent, provenance-tagged representation of the person: identity, life domains, reality,
future, and behavioural patterns. It is never a form. It is assembled from conversation and
progressively enriched.

Every claim in it records: value · source · confidence · created_at · last_confirmed_at · status.

Sources are distinguished absolutely:

| Source | Meaning | Authority |
| --- | --- | --- |
| `user_said` | The person stated it | High |
| `user_confirmed` | The person accepted an inference | Highest |
| `ai_inferred` | Reasonable interpretation | Provisional |
| `ai_suggested` | Recommendation offered | Provisional |
| `ai_generated` | Content the system authored | Provisional |

### 4.2 Life Map

Ten default domains (Self, Health, Family, Relationships, Career, Financial Freedom, Growth,
Purpose, Joy, Impact), customisable. Each carries: current experience, desired experience, outer
result, inner experience, importance, energy, satisfaction, risk, momentum.

Scores are **estimated by the AI from conversation** and confirmed by the user with
`[Lower] [About right] [Higher]` — never entered as twenty sliders.

### 4.3 Outer Win vs Inner Win (signature mechanism)

Every domain separates the **outer result** (what is happening externally) from the **inner
experience** (what it feels like). Divergence is the product's central insight engine:

> "Your career is performing strongly externally, but your experience of it is deteriorating.
> Your current strategy may be producing results at an unsustainable cost."

### 4.4 Whole Goal

A goal is never only an outcome. Four dimensions, always:

- **Result** — what will physically exist
- **Experience** — how the person wants to experience themselves while achieving it
- **Impact** — what changes for other people
- **Identity** — who they are becoming

Generated from minimal input ("I want a promotion") and confirmed.

### 4.5 Player

The version of the person required to play their current game well: name, identity, intention,
mantra, attitude, actions, agreements, boundaries, strengths, watch-outs. The AI proposes three
candidate Players; the user chooses or edits.

**Ask My Player** evaluates any real decision against the current game, whole goal, identity,
values, non-negotiables, health, capacity, opportunity cost, and leverage — and returns a verdict
(`take` / `decline` / `delegate` / `defer` / `renegotiate`) with reasoning and a better move.

### 4.6 Operating State & Intentional Momentum

- **Operating State** — one of Drifting, Stretched, Surviving, Stabilising, Engaged, Focused,
  Flowing, Expanding. A dynamic state, never a personality label, always overridable.
- **Intentional Momentum** — a transparent 1–10 scale of how intentionally the person is operating
  toward their chosen game, computed from clarity, commitment, alignment, action, capacity,
  consistency, and resistance. The computation is shown, not hidden.

Neither is clinical. A drop triggers **Reset Your Game**, never "you failed".

### 4.7 Game

A 90-day strategic container: name, purpose, winning definition, **non-winning definition**
("winning does not require working nights"), strategic objective, exactly three Bold Results,
30/60/90 milestones, strategic moves, Stop List, Protect List, risks, squad, leverage plays,
intentional omissions.

### 4.8 Sacrifice Radar

Every plan creation or change is scored for cost across domains. Excessive cost produces a strategy
warning plus alternatives that preserve the ambition and change the method.

```
CAREER   ++++
HEALTH   --
FAMILY   --
ENERGY   -
SELF     -
```

### 4.9 Leverage Engine

Before accepting "more effort" as an answer, the system tests fifteen leverage categories:
delegation, automation, systems, relationships, visibility, positioning, technology, communication,
focus, elimination, sequencing, negotiation, environment, expertise, sponsorship.

### 4.10 Protocol

Three modes so the user is never all-or-nothing: **Minimum** (difficult days), **Standard** (normal
rhythm), **Expansion** (high capacity). Plus rituals and routines chosen to fit the person's actual
life — no assumed 5 AM wake-ups.

### 4.11 Strategy hierarchy

Never conflated: Strategy (how we win) → Initiative (a body of work) → Action → Habit → Ritual → Task.

## 5. Screens

| Route | Purpose |
| --- | --- |
| `/` | Landing — Win big. Live well. |
| `/discover` | Conversational onboarding → Personal Snapshot |
| `/dashboard` | Daily Play: three moves, state, council note, protocol, one decision |
| `/life` | Life Map wheel, outer vs inner, gaps |
| `/goal` | Whole Goal |
| `/player` | Player card + Ask My Player |
| `/game` | Game, bold results, timeline, stop/protect, sacrifice radar, why this plan |
| `/protocol` | Minimum / Standard / Expansion, rituals, routines |
| `/reflection` | Daily, weekly, monthly review |
| `/insight` | Personal Insight Plan + blind spots |
| `/council` | Council Room — agents, negotiation, decisions, evidence |
| `/admin` | Observability: agent runs, latency, cost, validation, conflicts |
| `/settings` | Account, export, delete |

## 6. Interaction rules

- Loading is never a bare spinner. Progressive status: "Reviewing your priorities… ✓".
- Every page has a meaningful empty state with a single clear action.
- Motion is subtle and meaningful; `prefers-reduced-motion` fully respected.
- Desktop is the primary experience; mobile supports check-in, reflection, decisions, state,
  protocol, council, progress.

## 7. Non-goals

Not a chat app. Not a calendar. Not a CRM. No social feed. No streak shaming. No gamified points.
No cartoon avatars. No motivational quote engine.

## 8. Safety posture

See `CLAUDE.md` §6. In short: wellness not medicine, frameworks not regulated advice, patterns not
diagnoses, plan quality not personal worth.
