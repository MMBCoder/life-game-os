# Design System — LIFE GAME OS

## 1. Character

Premium · calm · sophisticated · intelligent · personal · warm · strategic · modern.

Not: playful SaaS, gradient-soaked, cartoon-gamified, motivational-poster, clinical dashboard.

The design should feel like a private strategy room, not an app store product page.

## 2. Palette

Defined once as CSS custom properties in `src/app/globals.css` and consumed through semantic Tailwind
tokens. **Components never contain hex values.**

### Primitives

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--navy-900` | `#0D1B2A` | — | Deep ground, dark-mode surface |
| `--navy-800` | `#132436` | — | Raised dark surface |
| `--teal-600` | `#1F8A8A` | — | Primary action, focus, active state |
| `--teal-400` | `#3AAFAE` | — | Dark-mode primary |
| `--sage-300` | `#C8DDB8` | — | Protection, growth, success accents |
| `--ivory-50` | `#F7F5EF` | — | Warm page ground (light) |
| `--charcoal-900` | `#20252B` | — | Primary ink (light) |
| `--slate-500` | `#667085` | — | Muted ink |
| `--amber-500` | `#C98A3C` | — | Watch / caution |
| `--clay-600` | `#B4553F` | — | Risk / warning (never pure red) |

### Semantic tokens

`--bg`, `--bg-subtle`, `--surface`, `--surface-raised`, `--line`, `--line-strong`,
`--ink`, `--ink-muted`, `--ink-faint`, `--primary`, `--primary-ink`, `--protect`, `--watch`, `--risk`,
`--focus-ring`.

Tailwind v4 maps these in `@theme inline`, giving `bg-surface`, `text-ink-muted`, `border-line`,
`text-primary`, `bg-protect`, etc.

### Colour semantics

Colour communicates **state, progress, risk, emphasis, protection, success** — never decoration.

- teal → intention, focus, the system's own voice
- sage → protected, healthy, sustainable
- amber → watch, approaching a limit
- clay → risk, sacrifice detected
- slate → inference, provisional, unconfirmed

## 3. Typography

- **Sans:** Inter (`next/font`, self-hosted, variable) — UI and body.
- **Display:** Fraunces (variable serif) — life statements, Game names, Player identity, major
  insights. Used sparingly and at large sizes; never for UI chrome.
- Numerals: `font-variant-numeric: tabular-nums` on all scores and meters.

| Class | Size / leading | Use |
| --- | --- | --- |
| `.type-display` | clamp 2.5–4rem, 1.05, serif | Hero, Game name |
| `.type-statement` | clamp 1.5–2.25rem, 1.2, serif | Player identity, headline insight |
| `.type-h1` … `.type-h3` | 1.75 / 1.375 / 1.125rem | Section structure |
| `.type-body` | 1rem / 1.65 | Prose |
| `.type-small` | 0.875rem / 1.55 | Secondary |
| `.type-label` | 0.75rem, 0.08em tracking, uppercase | Field labels, provenance chips |

## 4. Space, radius, elevation

- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96. Generous whitespace is a requirement.
- Radius: `--r-sm 6px`, `--r-md 10px`, `--r-lg 16px`, `--r-xl 24px`, `--r-full`.
- Elevation: two levels only. `--shadow-soft` for resting cards, `--shadow-lift` for interactive
  hover and dialogs. No layered neumorphic shadows.
- Cards use a 1px `--line` border plus `--shadow-soft`; the border does the work, the shadow is a hint.

## 5. Components (`src/components/ui`)

| Component | Notes |
| --- | --- |
| `Button` | variants `primary` `secondary` `ghost` `danger`; sizes `sm` `md` `lg`; `loading` state |
| `Card` | `CardHeader` / `CardTitle` / `CardBody` / `CardFooter`; `tone` = `default` \| `protect` \| `watch` \| `risk` |
| `Field` | label + hint + error + required, wired to the control via `aria-describedby` |
| `Textarea`, `Input`, `Select` | consistent focus ring, 44px minimum touch target |
| `SuggestionList` | the law-2 primitive: AI options with `Use this` / `Modify` / `Write my own` |
| `ProvenanceChip` | `USER SAID` · `AI INFERRED` · `AI SUGGESTS` · `CONFIRMED`, with confidence |
| `ConfirmCorrect` | `[Confirm] [Correct]` pair; correction opens inline editing |
| `ScaleCheck` | `[Lower] [About right] [Higher]` — the fast score-confirmation control |
| `Meter` | horizontal bar with tone thresholds; used for capacity, health, momentum |
| `Dialog` | focus trap, `Esc` to close, scroll lock, labelled by its title |
| `Tabs`, `Badge`, `Callout`, `Divider`, `Stat` | |
| `ProgressiveStatus` | the loading experience: named steps that tick over with ✓ |
| `EmptyState` | icon + headline + one sentence + single primary action |
| `ErrorState` | safe copy + retry; never a stack trace |

## 6. Signature components

| Component | Behaviour |
| --- | --- |
| `LifeWheel` | SVG radial chart. Two overlaid polygons (outer result vs inner experience) plus per-domain importance as spoke weight. Hover/focus reveals the domain panel. Keyboard navigable spoke by spoke. |
| `GameTimeline` | 30 / 60 / 90 horizontal timeline with bold results, progress, and today's marker. |
| `PlayerCard` | Serif identity, mantra, attitude chips, agreements list. |
| `WholeGoalCard` | Four quadrants: Result / Experience / Impact / Identity. |
| `SacrificeRadar` | Diverging bars per domain, −3…+3, warning banner + alternatives when triggered. |
| `CapacityMeter` | Time vs energy shown as two distinct tracks — the product insists they differ. |
| `StateBadge` | Operating state with confidence and drivers on expand. |
| `CouncilGraph` | The agent graph; nodes light up as runs complete; click a node for its summary. |
| `CouncilDecision` | Verdict, rationale, trade-offs, conflicts, evidence, `Why?`. |
| `ProtocolBuilder` | Three-column Minimum / Standard / Expansion editor per domain. |
| `StopList` / `ProtectList` | Paired lists with distinct tones (clay / sage). |

## 7. Motion

- Durations: 120ms (state), 200ms (enter), 320ms (wheel/timeline transitions). Easing
  `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Permitted: wheel polygon morph, timeline draw-in, council node activation, meter fill, dialog fade+lift.
- Forbidden: bounce, spring overshoot, confetti, long loading animations, parallax.
- `@media (prefers-reduced-motion: reduce)` disables all transitions and animations globally.

## 8. Accessibility

- Semantic HTML first; ARIA only where semantics run out.
- Visible `--focus-ring` (2px, 2px offset) on every interactive element. Never `outline: none`
  without a replacement.
- Contrast: body text ≥ 4.5:1, large text ≥ 3:1, in both themes.
- The Life Wheel has an equivalent accessible table (`sr-only`) so the data is never colour-only.
- Every score bar carries `role="meter"` with `aria-valuenow` / `valuemin` / `valuemax` / `aria-label`.
- Dialogs trap focus and restore it on close. `Esc` always closes.
- Touch targets ≥ 44×44px.

## 9. Responsive

| Breakpoint | Behaviour |
| --- | --- |
| `< 640px` | Single column. Wheel becomes a stacked domain list with dual bars. Bottom tab bar. |
| `640–1024px` | Two columns; wheel at reduced radius. |
| `1024–1440px` | Primary layout: sidebar + content. |
| `> 1440px` | Content capped at 1200px; sidebar fixed. |

Type scales with `clamp()`; no fixed pixel font sizes above `.type-body`.

## 10. Dark mode

Light is the default and the designed-for case. Dark mode is a full palette swap via
`:root` + `.dark`, driven by the OS with a manual override persisted to `localStorage`. Every token
has both values; no component defines a colour that exists in only one theme.
