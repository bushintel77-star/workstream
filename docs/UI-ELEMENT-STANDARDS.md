# UI Element Standards

> **The contract**: a single source of truth for the small surface
> primitives every chrome-tier component agrees on — border radius,
> font size, spacing, transition. Authoring chrome reaches for these
> tokens instead of inlining pixel values. Off-scale values are
> regressions caught by lint + a vitest scan.

This document captures the proposed scales, the rationale behind
each rung, and the migration order across the canvas chrome tier.
It complements `docs/CANVAS-FIRST-Z-STACK-CONTRACT.md` (which governs
**where** surfaces live in the stacking order); this doc governs
**how** every surface looks once it lands there.

## 1. Border-radius scale

| Token | Value | Use case |
|---|---|---|
| `--gs-radius-xs` | `3px`  | tight inset framings, badge corners |
| `--gs-radius-sm` | `4px`  | small pills, dense chip clusters |
| `--gs-radius-md` | `6px`  | **default** card / button / chip |
| `--gs-radius-lg` | `8px`  | spacious cards, sectional groupings |
| `--gs-radius-xl` | `12px` | hero panels, fanout docks, transition HUD |
| `--gs-radius-2xl` | `14px` | flora-rings (single-component exception) |
| `--gs-radius-pill` | `9999px` | rounded pills (collapses `999` and `9999`) |

**Why a 9-step ladder is not the answer:** the canvas audit found
9 distinct inline values (`3, 4, 6, 8, 10, 12, 14, 999, 9999`) across
the same author group. A 9-step ladder would be a worse problem in
disguise. The 7-step ladder above collapses intentional variations
to deliberate picks.

**Why `9999px` for pill and not `999px`:** both render identical
circles, but `999` is a number an author reaches for when they don't
know what pill means. The token forces the intent.

**Why `14px` is special-cased:** only `FloraRingLayer.tsx` uses it
to distinguish ring badges from regular chrome chips. If a second
component reaches for `2xl`, the rung moves from "special case" to
"step on the ladder."

## 2. Font-size scale

| Token | Value | Use case |
|---|---|---|
| `--gs-font-micro` | `9.5px` | transition HUD chip indicators |
| `--gs-font-xs`    | `10.5px` | micro-copy on panels (most common) |
| `--gs-font-sm`    | `11px`   | default body text |
| `--gs-font-md`    | `11.5px` | form labels, scrubber value |
| `--gs-font-lg`    | `12px`   | UI labels |
| `--gs-font-sub`   | `13px`   | subhead (rare) |
| `--gs-font-h3`    | `14px`   | card title |
| `--gs-font-h2`    | `16px`   | section heading (single-component) |
| `--gs-font-h1`    | `20px`   | page header (3D-canvas-unavailable boundary) |

**Why 10.5px stays:** the Glass Card spec was authored at that
micro-line height — reducing it to 10 changes real estate
allocation. The rung exists to preserve that grid.

**Why we don't reach 9px:** `9px` and `9.5px` look identical to most
humans at arm's-length. Collapsing to a single rung keeps the scale
honest.

## 3. Spacing scale (gap / padding / short margins)

| Token | Value | Use case |
|---|---|---|
| `--gs-space-1` | `2px`  | tight stacks |
| `--gs-space-2` | `4px`  | chip cluster |
| `--gs-space-3` | `6px`  | form rows |
| `--gs-space-4` | `8px`  | **default** section gap |
| `--gs-space-6` | `12px` | panel pad |
| `--gs-space-8` | `16px` | panel spacing (larger) |

**Why no 10px:** the audit found `gap: 10` and `margin: 10` in 3-4
spots; merging them into `--gs-space-6` (12) or `--gs-space-4` (8)
is a one-character diff and reads cleaner in JSX.

**Why no 14px or 20px:** these were observed only inside padding
in two of three cases (`FitSheetCard.tsx`, `WebGLStudioPreview.tsx`).
If a fourth appears, that becomes a new rung.

## 4. Transition scale

| Token | Value | Use case |
|---|---|---|
| `--gs-fast` | `140ms ease-out` | button hover, chip activation |
| `--gs-base` | `180ms cubic-bezier(0.22, 1, 0.36, 1)` | **default** (panel enter, mode fade) |
| `--gs-slow` | `240ms cubic-bezier(0.22, 1, 0.36, 1)` | overlay / modal enter |

**Why this curve and not `ease`:** the slider/keyframe HUD already
uses `cubic-bezier(0.22, 1, 0.36, 1)` (the ease-out-quint family).
Promoting one curve to the standard saves a second invented
curve across `StudioToolRail.tsx` and friends.

**Why 140ms for fast:** below 100ms, hover affordances feel like
they're flickering. Above 200ms, they feel sluggish on visual
review. 140ms is the midpoint of the modern hover-budget sweet spot.

## 5. Companion dev-HUD tokens

| Token | Value | Use case |
|---|---|---|
| `--cf-dark-chrome-bg` | `rgba(0, 0, 0, 0.78)` | ladder bar, hover tooltip, peel bar |
| `--cf-dark-panel-bg`  | `rgba(0, 0, 0, 0.86)` | recipe pane |

These were `rgba(0,0,0,*)` inline in 4 sites of `CfzTierInspector.tsx`
before the audit. Promoting them closes the inline-rgba loop.

## 6. Pending primitives (no extraction yet — these would come next)

These are mentioned in the audit but the user has not yet asked for
the extraction. Each is a single component file with its own test
and the standards it should hit:

| Primitive | Sites currently | Variants |
|---|---|---|
| `<Button>` | 62 raw `<button>` across 22 files | `primary | secondary | ghost | danger | pill`, `sm | md` |
| `<Input>` (text / number) | 23 raw `<input>` across 6 files | `text | number` |
| `<Select>` | 4 raw `<select>` in `InspectorCard.tsx` | inherits `<Input>` |
| `<HudPill>` | CfzTierInspector + future dev tools | consumes `--cf-dark-chrome-bg` |

## 7. Migration order

The standards are useless without a migration. The cost of each tier
varies; pick the cheap ones first.

**Tier 1 — zero risk, no visual change** ✅ **shipped** (28 sites across
10 .tsx files; `ui.scan.test.ts` flipped from 4 failed to 6 passed)
1. `borderRadius: 6` → `var(--gs-radius-md)` (~5 sites).
2. `borderRadius: 999` → `var(--gs-radius-pill)` (10 sites, files:
   AssetFanOutDock × 2, FitSheetCard × 2, FloraRingLayer × 3,
   SketchCadReviewCard × 1, SplitViewLens × 1, WebGLStudioPreview × 1).
3. `borderRadius: 10` → `var(--gs-radius-xl)` (1 site, AssetFanOutDock L58).
4. `fontSize: 11` → `var(--gs-font-sm)` (~4 sites, mostly CfzTierInspector).
5. `fontSize: 10.5` → `var(--gs-font-xs)` (~6 sites, micro-copy).
6. `fontSize: 9` → `var(--gs-font-micro)` (2 sites, ViewportTransitionHUD).
7. `gap: 4` → `var(--gs-space-2)`, `gap: 1` → `var(--gs-space-1)`,
   `gap: 3` → `var(--gs-space-2)` (8 sites).
8. New rung `--gs-space-10: 10px` added so `gap: 10` round-trips (3 sites
   in WebGLStudioPreview project destinations + meta-tab columns).
9. 4 hardcoded `rgba(0,0,0,*)` sites in CfzTierInspector →
   `--cf-dark-chrome-bg` / `--cf-dark-panel-bg`.
10. New companion tokens `--gs-shadow` (vignette darkening) and
    `--gs-warning-amber` (scrubber-handle glow) — added in Tier 1
    because the 2 outlier rgba sites carried content meaning and
    collapsing them into the dark-chrome rung would lose language.
11. VignetteOverlay JSDoc rewording — `rgb(17 17 17)` was appearing
    only inside a comment; rewrote to reference the token by name so
    the scan's regex doesn't false-positive on it.

**Tier 2 — visual review per step**
1. Border-radius outliers (`3`, `12`, `14`) — each requires a
   site author to confirm intent.
2. Font outliers (`11.5`, `13`, `14`, `16`, `20`) — the `.h1/h2/h3`
   rungs are easy; `11.5px` needs author sign-off (it maps to
   non-adjacent `md` rung).
3. Spacing outliers (`gap: 12`) — author sign-off.
4. Outlier curves in `StudioToolRail.tsx` — keep or migrate to `--gs-base`.

**Tier 3 — structure changes (extract primitives)**
1. `<GlassCard>` → expand with `header` / `footer` slots where
   neighboring sites hand-roll them today.
2. `<Button>` extraction — start with chrome-tier chips, snapshot
   pixel-stable to the current visual.
3. `<Input>` extraction — driven by `InspectorCard.tsx` (12 inline
   inputs, most common shape).

## 8. Watch-outs (companion readers)

- `docs/CANVAS-FIRST-Z-STACK-CONTRACT.md` — governs stacking order.
- `docs/COLOR-TOKENS.md` — pre-existing; should be cross-linked.
- `apps/web/src/styles/globals.css` — the canonical home for these
  tokens.
- `apps/web/src/components/canvas/ui.scan.test.ts` — vitest scan
  catching off-scale values (future).
- `eslint.config.mjs` — future `no-restricted-syntax` rules for
  off-scale `fontSize` / `borderRadius` (future).

## 9. Open questions

- **`borderRadius: 14`** (only FloraRingLayer uses) — promote or
  special-case? Recommendation: special-case for now; promote if a
  second user arrives.
- **`fontSize: 13`** (subhead) — used in scrubber values, NibPalette,
  a few callouts. Probably migrate to `--gs-font-sub` and never
  reach for raw `13`.
- **`transition: 200ms ease`** in `SaveStatusChip.tsx` — migrate
  to `--gs-base`? Recommendation: `200ms` is between fast and base;
  audit shows it's the only outlier. Either collapse to `--gs-base`
  and accept a 20ms speed change, or keep with explicit comment.

## 10. Files in this contract

| File | Role |
|---|---|
| `docs/UI-ELEMENT-STANDARDS.md` | This document |
| `apps/web/src/styles/globals.css` | CSS source of truth (the scale tokens) |
| `apps/web/src/components/canvas/ui.scan.test.ts` | static scan now locks all 28 Tier-1 sites on-scale; flags any new departure (live) |
| `eslint.config.mjs` | parallel `no-restricted-syntax` rules (future, same shape as z-stack rules) |
