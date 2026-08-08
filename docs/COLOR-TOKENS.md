# Curtis & Co — color tokens v2

Source of truth:

- CSS: `apps/web/src/styles/color-tokens.css` (raw palette + semantic light/dark)
- TS mirror: `apps/web/src/styles/colorTokens.ts` (SVG/PDF/tests that need hex)
- Imported from `apps/web/src/styles/globals.css`

## Rules

1. **Never paint from raw palette** (`--gray-*`, `--crimson-*`, …) in components. Use semantic tokens (`--existing-stroke`, `--proposed-text`, …).
2. **Dark mode: stroke ≠ text.** Labels, badges, and legend copy must use `*-text`, not `*-stroke` (stroke stops pass UI 3:1 but fail AA 4.5:1 for text).
3. **Fills use `color-mix()` against `--canvas`**, not hex-alpha suffixes — see utility classes `.existing-structure`, `.proposed-structure`, `.tpz-canopy`, `.selected-highlight`.
4. **APWA locate colours are mode-invariant** (safety standard). BYDA lines pull from `PALETTE.apwa*`.
5. **Theme attribute:** Design Studio root sets `data-theme="light"|"dark"` from Dark canvas (`darkLens` when not on Fit sheet).

## Handoff chrome (`--hc-*`)

Light studio chrome **aliases this v2 system** via `--hc-*` on `.root` in `handoffStudio.module.css` (`--hc-ink` → `--text-primary`, `--hc-neu-surface` → `--panel`, field → `--canvas`, etc.). Blush pink (`#f1e4e9` / `#ffd3de` / umber `#241318`) is **retired** for light chrome.

Dark `.rootDark` maps `--hc-*` onto `data-theme="dark"` neutrals (dolphin board). Plan geometry always uses the semantic strokes/fills below — never invent hex in components.

### Allowlist (literal colour exceptions)

| Exception | Why |
| --- | --- |
| APWA / BYDA locate (`--apwa-*` / `PALETTE.apwa*`) | Safety standard — mode-invariant |
| Material swatch faces (turf/bluestone chips) | Product identity |
| Fit sheet print plate (`--sheet-paper` / `--sheet-ink` / `--sheet-border`) | Print parchment tokens — no scattered raw hex |
| Raster / aerial imagery | Not chrome paint |
| SVG mask algebra (`#fff` / `#000` in SelectionFocusVeil) | Mask channel, not UI paint |

CI gate: `node scripts/check-handoff-chrome-colors.mjs` (also via `pnpm web:check-handoff-colors`).

## LA UX mapping (what operators read)

| Meaning | Stroke | Label text (esp. dark) | Fill |
|---------|--------|------------------------|------|
| Existing (dwelling, retain) | `--existing-stroke` | `--existing-text` | `PLAN_FILL.existingStructure` / `.existing-structure` |
| Proposed (new work) | `--proposed-stroke` | `--proposed-text` | `PLAN_FILL.proposedStructure` / selection highlight |
| Planting retain / TPZ | `--planting-retain-stroke` | `--planting-retain-text` | `.tpz-canopy` / `--fill-tpz` |
| Planting new | `--planting-new-stroke` | `--planting-new-text` | `PLAN_FILL.plantingWash` |
| Easement (title) | `--easement-stroke` | — | hatch via easement stroke mix |
| BYDA dig | `--apwa-*` | APWA (mode-invariant) | — |

Helpers: `mixOnCanvas()`, `PLAN_FILL`, `CSS_TOKEN`, `semanticForTheme()` in `colorTokens.ts`.

SDS aliases on the studio root: `--sds-vector-primary` → `--text-primary`, `--sds-canvas-bg` → `--canvas`.
