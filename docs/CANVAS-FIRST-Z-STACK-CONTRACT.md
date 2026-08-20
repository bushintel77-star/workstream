# Canvas-First Z-Stack Contract

> **The contract**: a single source-of-truth ladder for the visual stacking
> hierarchy in the WebGL studio, enforced at three levels (CSS, JS, runtime)
> with a closed four-tier registry. Drift between any two levels fails the
> corresponding guard.

This is the canonical reference for the Canvas-First wrapper published
in `apps/web/src/components/canvas/webgl/CanvasFirstLayout.tsx`. Update
this file alongside any change to the ladder.

## 1. The four-tier ladder

The wrapper publishes four `data-cf-layer` slots, each pinned to a single
SDS token declared in `apps/web/src/styles/globals.css`:

| Slot | DOM attribute | SDS token | Numeric value | Visual role |
|---|---|---|---|---|
| Canvas  | `data-cf-layer="canvas"`  | `--cf-z-canvas`  | `0`  | WebGL canvas + R3F raycaster |
| Spatial | `data-cf-layer="spatial"` | `--cf-z-spatial` | `10` | World-pinned HTML portals (pins, annotations) |
| Chrome  | `data-cf-layer="chrome"`  | `--cf-z-chrome`  | `20` | Floating panels, tool rails, cards |
| App     | `data-cf-layer="app"`     | `--cf-z-app`     | `30` | Command palette, modals, toasts |

The slots are uniformly 10 units apart — matching the SDS blueprint. A
fifth rung inserted between any two rungs must also be exactly 10 units.

## 2. Drei `<Html zIndexRange>` companion pairs

drei's `<Html>` portals run through a separate id-based overlay
coordinator, not browser CSS. They use numeric min/max pairs. The four
documented pairs mirror the SDS ladder so both stacks stay coordinated:

| Pair name | `[near, far]` expression | Resolves to | Owners |
|---|---|---|---|
| `spatialLabel`      | `[spatial,        canvas + 1]` | `[10, 1]`  | (vacant — reserved for pinned labels) |
| `spatialAnnotation` | `[chrome,         spatial]`    | `[20, 10]` | CadProposalLayer, DimensionLayer, FusedSketchLayer, IrrigationZoneLayer, MeasureTapeLayer, TrenchLayer |
| `chromeChip`        | `[app,            spatial + 5]`| `[30, 15]` | MetaChipSet |
| `chromeZone`        | `[app,            chrome]`     | `[30, 20]` | FloraRingLayer |

Hardcode prohibited — always reach for `cfZPair("...")` from
`apps/web/src/components/canvas/cfz.ts`. The lint rule in
`eslint.config.mjs` (`no-restricted-syntax`) flags any other call shape.

## 3. The three-way guard

| Level | Where | What it locks |
|---|---|---|
| 1. CSS source of truth | `apps/web/src/styles/globals.css` (L617–620 + companion comment block) | The actual numeric values + documented pairs |
| 2. JS mirror + lint     | `apps/web/src/components/canvas/cfz.ts` + `no-restricted-syntax` rule | Mirrors the ladder into JS; closes the `cfZPair("...")` registry to four kinds |
| 3. Runtime              | `apps/web/e2e/canvas-first-z-stack.spec.ts` (Playwright) | Asserts the resolved DOM matches (1) under WebGL across Survey/Sketch/CAD/Garden |

Plus three unit tests that pin the CSS↔JS mirror in vitest:

- `cfz.test.ts` — runtime reads under both SSR (fallback) and client (mocked CSSOM)
- `cfz.parity.test.ts` — globals.css ladder values vs. `CF_Z_FALLBACK`
- `cfz.registry.test.ts` — closed `data-cf-layer` registry; only `CanvasFirstLayout.tsx` may publish it

## 4. Migration recipe — adding a new visible tier

If a future design needs a fifth visual rung (say, `--cf-z-floater` between
chrome and app), follow the four-step sequence below. Skipping a step
defeats the contract.

1. **CSS** — declare the new token in `apps/web/src/styles/globals.css` next
   to the four existing ones. Update the comment block that inventories
   the ladder.
2. **JS** — extend `CfTier` in `cfz.ts`; add the new key to `CF_Z_FALLBACK`
   and `CF_Z_PAIRS`; document the new pair's intent in JSDoc.
3. **Lint** — open `no-restricted-syntax` in `eslint.config.mjs`; the
   registry closes itself because the helper's string literal union is
   `keyof typeof CF_Z_PAIRS`.
4. **Runtime** — update `EXPECTED_LAYERS` and `EXPECTED_Z` in the
   Playwright spec; bump `createWrightsTier1Project` if the new rung
   requires previously-unlocked progression.

After applying all four steps:

```bash
pnpm --filter @workstream/web typecheck                                  # tsc clean
pnpm --filter @workstream/web lint                                       # ESLint clean
pnpm exec vitest run apps/web/src/components/canvas                       # 681+ tests green
pnpm --filter @workstream/web web:check-canvas-first-zstack              # Playwright runtime green (boots API + web)
```

The first step that fails tells you which of the four guards caught the
drift. Fix that one place and re-run.

## 5. Escape-hatch map

| What you want to change | Edit this ONE file first |
|---|---|
| A token's numeric value | `apps/web/src/styles/globals.css` (then let the parity test fail) |
| A drei pair's expression | `apps/web/src/components/canvas/cfz.ts` (`CF_Z_PAIRS` derive) |
| A new visual tier rung | `globals.css` first → then `cfz.ts` → then the Playwright spec |
| A new `data-cf-layer` slot | `CanvasFirstLayout.tsx` ONLY; the registry test guards this |
| The `cfZPair("...")` set | `CF_Z_PAIRS` in `cfz.ts`; lint + tests catch silent additions |

## 6. Why `data-cf-mirror` is NOT a fifth slot

The wrapper's accessibility mirror tree (the SR-only 1×1 clip → aria
tree, `role="tree"`) used to publish `data-cf-layer="mirror"`. It
sits at `--cf-z-app` for screen-reader announcement ordering
("above chrome"), but the visual contribution is *exactly zero* because
its rendered box is 1×1 px and clip-rect hides every pixel. The
mirroring role is signalled by its own attribute namespace
(`data-cf-mirror=""`) so the four-tier visual registry stays exactly
four. Renamed 2026-08-20 alongside the cfz work; the Playwright spec
passes if the box stays invisibly clipped — a future PR that grows the
mirror to a visible panel fails the assertion and forces the author
to re-confirm intent.

The lesson: visual-stack separation is enforced by *visibility*, not
by an absent z-index. Two elements can sit in the same tier and still
not compete visually.

## 7. Dev tools

A dev-only hover-tier HUD lives at
`apps/web/src/components/canvas/webgl/CfzTierInspector.tsx`. Activate on
any client route by appending `?cfz-inspect=1` to the URL. The HUD
walks `pointermove` events, samples the resolved `z-index` of the
nearest `[data-cf-layer]` ancestor, and reports the live delta against
`readCfZ(tier)`. Disabled in `NODE_ENV === "production"`; URL flag is
the positive control.

Mount it once anywhere inside the WebGL studio route to wire it up:
```tsx
import { CfzTierInspector } from "./CfzTierInspector";
// somewhere inside the studio tree:
<CfzTierInspector />
```

## 8. Files in this contract

| File | Role |
|---|---|
| `apps/web/src/styles/globals.css` | CSS source of truth (`--cf-z-*`) |
| `apps/web/src/components/canvas/cfz.ts` | JS SSR/client accessor + drei pair registry |
| `apps/web/src/components/canvas/cfz.test.ts` | Runtime reads (SSR + mocked CSSOM) |
| `apps/web/src/components/canvas/cfz.parity.test.ts` | CSS ↔ JS mirror pin |
| `apps/web/src/components/canvas/cfz.registry.test.ts` | Closed `data-cf-layer` registry guard |
| `apps/web/src/components/canvas/webgl/CanvasFirstLayout.tsx` | The four-slot publisher |
| `apps/web/src/components/canvas/webgl/CfzTierInspector.tsx` | Dev-only hover-tier HUD |
| `apps/web/e2e/canvas-first-z-stack.spec.ts` | Runtime regression (Survey/Sketch/CAD/Garden) |
| `eslint.config.mjs` | `no-restricted-syntax` rule for raw zIndex and `cfZPair("...")` registry |
| `docs/CANVAS-FIRST-Z-STACK-CONTRACT.md` | This document |
