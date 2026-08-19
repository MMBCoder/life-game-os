# Data Model — LIFE GAME OS

PostgreSQL via Drizzle. Every user-owned row carries `userId` with `ON DELETE CASCADE`.
Every row that holds a *claim about the user* carries provenance.

## Shared enums

```
source_kind      : user_said | user_confirmed | ai_inferred | ai_suggested | ai_generated
item_status      : draft | suggested | confirmed | rejected | archived
memory_layer     : stable | dynamic | episodic
operating_state  : drifting | stretched | surviving | stabilising | engaged | focused | flowing | expanding
plan_mode        : minimum | standard | expansion
goal_dimension   : result | experience | impact | identity
severity         : low | medium | high | critical
agent_id         : orchestrator | identity | reality | goal | player | strategy | health
                   | relationships | capacity | redTeam | execution | reflection | adaptation
```

## Provenance mix-in

Applied to every claim-bearing table:

| Column | Type | Notes |
| --- | --- | --- |
| `source` | `source_kind` | Who asserted it |
| `confidence` | `real` | 0..1; `1` for `user_said`/`user_confirmed` |
| `status` | `item_status` | Lifecycle |
| `evidence` | `jsonb` | Array of `{ kind, ref, note }` |
| `createdAt` | `timestamptz` | |
| `updatedAt` | `timestamptz` | |
| `lastConfirmedAt` | `timestamptz` | Null until the user confirms |

## Tables

### Identity & account

| Table | Key columns |
| --- | --- |
| `users` | `id`, `email` (unique), `passwordHash`, `passwordSalt`, `name`, `timezone`, `isDemo`, `createdAt` |
| `sessions` | `id`, `userId`, `tokenHash` (unique), `expiresAt`, `createdAt` |
| `profiles` | `userId` (unique), `displayName`, `pronouns`, `role`, `lifeStage`, `onboardingStage`, `onboardingCompletedAt` |

### Personal Model

| Table | Purpose | Key columns |
| --- | --- | --- |
| `identityModels` | One per user | `currentIdentity`, `emergingIdentity`, `desiredIdentity`, `identityTensions[]`, `motivators[]`, `fears[]`, `naturalTendencies[]` + provenance |
| `values` | Values & principles | `label`, `kind` (`value`\|`principle`), `importance`, `note` + provenance |
| `strengths` | Strengths & overdone strengths | `label`, `kind` (`strength`\|`overdone`), `note` + provenance |
| `constraints` | Reality constraints | `label`, `category` (time/energy/financial/responsibility/environment/skill), `severity`, `note` + provenance |
| `nonNegotiables` | Protect list source of truth | `label`, `domainId?`, `hardness` (`firm`\|`strong`\|`preference`), `note` + provenance |
| `behavioralPatterns` | Tendencies, never diagnoses | `label`, `pattern`, `trigger`, `impact`, `confidence`, `hypothesis` (always true) + provenance |
| `observations` | Raw signals feeding inference | `text`, `channel` (conversation/reflection/decision/rating), `domainId?`, `capturedAt` |

### Life Map

| Table | Key columns |
| --- | --- |
| `lifeDomains` | `id`, `userId`, `key`, `label`, `orderIndex`, `isCustom`, `isActive` |
| `lifeScores` | `domainId`, `currentExperience`, `desiredExperience`, `outerResult`, `innerExperience`, `importance`, `energy`, `satisfaction`, `risk`, `momentum` (all 0–10), `capturedAt` + provenance |

`lifeScores` is append-only — history powers the monthly comparison.

### Goals & Game

| Table | Key columns |
| --- | --- |
| `goals` | `title`, `rawInput`, `horizonMonths`, `domainId?`, `isPrimary`, `status` + provenance |
| `wholeGoals` | `goalId`, `result`, `experience`, `impact`, `identity`, `mostImportantDimension?` + provenance |
| `games` | `name`, `purpose`, `winningDefinition`, `nonWinningDefinition`, `strategicObjective`, `startDate`, `endDate`, `status`, `whyThisPlan`, `intentionalOmissions[]`, `healthScore` + provenance |
| `boldResults` | `gameId`, `title`, `dayMarker` (30/60/90), `targetDate`, `successDefinition`, `evidence[]`, `leadingIndicators[]`, `dependencies[]`, `risks[]`, `confidence`, `owner`, `progress` |
| `milestones` | `boldResultId?`, `gameId`, `title`, `dueDate`, `status` |
| `strategicMoves` | `gameId`, `title`, `detail`, `leverageCategory`, `expectedImpact`, `effort`, `sequenceIndex` |
| `stopListItems` | `gameId`, `text`, `reason`, `status` |
| `protectListItems` | `gameId`, `text`, `nonNegotiableId?`, `reason` |
| `risks` | `gameId`, `title`, `detail`, `severity`, `likelihood`, `mitigation` |
| `squadMembers` | `name`, `relationship`, `canHelpWith`, `askDraft`, `status` |

### Player

| Table | Key columns |
| --- | --- |
| `players` | `gameId?`, `name`, `identity`, `intention`, `mantra`, `attitude[]`, `actions[]`, `agreements[]`, `boundaries[]`, `strengths[]`, `watchOuts[]`, `isActive` + provenance |
| `decisions` | `question`, `context`, `verdict` (`take`\|`decline`\|`delegate`\|`defer`\|`renegotiate`), `reasoning`, `conflicts[]`, `betterMove`, `councilRunId?`, `userOutcome?` |

### Protocol & execution

| Table | Key columns |
| --- | --- |
| `protocols` | `gameId?`, `isActive` + provenance |
| `protocolItems` | `protocolId`, `domainId?`, `label`, `minimum`, `standard`, `expansion` |
| `rituals` | `category` (energy/mind/gratitude/support/purpose/creativity/relationships), `name`, `detail`, `cadence`, `whyThisFits`, `status` |
| `routines` | `slot` (morning/work/transition/evening/weekly/monthly), `name`, `steps[]`, `durationMinutes`, `status` |
| `actions` | `gameId?`, `boldResultId?`, `title`, `kind` (strategic/health/relationship/admin), `date`, `status`, `energyCost`, `timeMinutes`, `isTodayMove` |

### State & reflection

| Table | Key columns |
| --- | --- |
| `stateSnapshots` | `operatingState`, `confidence`, `drivers[]`, `focus`, `energy`, `alignment`, `capacity`, `userOverride`, `capturedAt` |
| `intentionSnapshots` | `level` (1–10), `computed`, `components` (`{clarity,commitment,alignment,action,capacity,consistency,resistance}`), `explanation`, `accepted`, `capturedAt` |
| `reflections` | `kind` (daily/weekly/monthly), `periodStart`, `periodEnd`, `answers` (jsonb), `moved[]`, `didntMove[]`, `surprises`, `feeling`, `costMoreThanExpected`, `gaveEnergy`, `shouldChange` |
| `insights` | `kind` (insight/pattern/opportunity/risk), `title`, `detail`, `domainId?`, `confidence`, `evidence[]`, `status` + provenance |
| `blindSpots` | `hypothesis`, `detail`, `confidence`, `evidence[]`, `userResponse` (`accepted`\|`rejected`\|`unsure`) + provenance |
| `insightPlans` | `sections` (jsonb, the 18 sections of the Personal Insight Plan), `generatedAt` |

### Council & observability

| Table | Key columns |
| --- | --- |
| `councilRuns` | `purpose`, `status`, `startedAt`, `finishedAt`, `latencyMs`, `agentCount`, `provider`, `totalInputTokens`, `totalOutputTokens`, `estimatedCostUsd`, `error?` |
| `agentRuns` | `councilRunId`, `agent`, `purpose`, `status`, `confidence`, `provider`, `model`, `latencyMs`, `inputTokens`, `outputTokens`, `estimatedCostUsd`, `validationAttempts`, `error?` |
| `agentOutputs` | `agentRunId`, `payload` (validated envelope), `summary`, `reasoning[]`, `evidence[]` |
| `agentConflicts` | `councilRunId`, `kind`, `raisedBy`, `against`, `claim`, `severity`, `resolution`, `resolvedInFavourOf` |
| `agentDecisions` | `councilRunId`, `decision`, `headline`, `rationale`, `tradeOffs[]`, `omissions[]`, `confidence`, `userConfirmedAt?` |
| `recommendations` | `councilRunId?`, `target`, `title`, `detail`, `rationale`, `priority`, `status` (`suggested`\|`accepted`\|`rejected`\|`applied`) |
| `sacrificeAssessments` | `gameId?`, `councilRunId?`, `scores` (jsonb: domainKey → −3..+3), `verdict` (`balanced`\|`watch`\|`warning`), `warning?`, `alternatives[]` |

### Memory

| Table | Key columns |
| --- | --- |
| `memoryItems` | `layer`, `key`, `value`, `context`, `source`, `confidence`, `status`, `createdAt`, `lastConfirmedAt`, `supersededById?`, `episodeAt?` |

Retrieval: filter by layer → weight by `confidence` and recency → prefer `user_confirmed` over
`ai_inferred` on conflict → truncate to the context token budget.

## Integrity rules

1. A `games` row may have **at most three** `boldResults` with distinct `dayMarker`s. Enforced in the
   repository and asserted in tests.
2. `protectListItems` referencing a `nonNegotiable` may not be deleted while that non-negotiable is
   `firm`.
3. `lifeScores` and the snapshot tables are append-only; corrections append a new row.
4. `values`, `nonNegotiables`, `blindSpots` with `source = user_said | user_confirmed` may never be
   overwritten by an agent — agents may only propose a *new* row.
5. Deleting a `user` cascades to every table above, satisfying the deletion requirement.
