# Curtis & Co — color tokens v2 (Studio Paper)

Source of truth:

- CSS: `apps/web/src/styles/color-tokens.css` (raw palette + single semantic set)
- TS mirror: `apps/web/src/styles/colorTokens.ts` (SVG/PDF/tests that need hex)
- Imported from `apps/web/src/styles/globals.css`
- **Drift guard:** `colorTokens-css-sync.test.ts` pins the TS mirror to the CSS declarations

## Rules

1. **Never paint from raw palette** (`--gray-*`, `--crimson-*`, …) in components. Use semantic tokens (`--existing-stroke`, `--proposed-text`, …).
2. **Label text uses `*-text`.** Existing/proposed keep deliberate stroke ≠ text pairs; planting shares them on paper (dark greens are AA text directly — the dark-era lifted stops are retired).
3. **Fills use `color-mix()` against `--canvas`**, not hex-alpha suffixes — see utility classes `.existing-structure`, `.proposed-structure`, `.tpz-canopy`, `.selected-highlight`.
4. **APWA locate colours are mode-invariant** (safety standard). BYDA lines pull from `PALETTE.apwa*`.
5. **Single theme.** Studio Paper is the only theme; `data-theme` and `.rootDark` are no-op aliases. Status colour is ink + iconography — crimson is reserved for CTA/active-tool/focus/critical (see GOLD-STANDARD-2026-TOKENS.md §1.2).

## Handoff chrome (`--hc-*`)

Studio chrome **aliases this v2 system** via `--hc-*` on `.root` in
`handoffStudio.module.css` (`--hc-ink` → `--gs-ink`, `--hc-paper` →
`--gs-panel`, field → `--canvas`, etc.). The cream/blush era is retired;
`.rootDark` is a no-op alias of `.root`. Plan geometry always uses the
semantic strokes/fills below — never invent hex in components.

### Allowlist (literal colour exceptions)

| Exception | Why |
| --- | --- |
| APWA / BYDA locate (`--apwa-*` / `PALETTE.apwa*`) | Safety standard — mode-invariant |
| Material swatch faces (turf/bluestone chips) | Product identity |
| Fit sheet print plate (`--sheet-paper` / `--sheet-ink` / `--sheet-border`) | Print tokens — no scattered raw hex |
| Raster / aerial imagery | Not chrome paint |
| SVG mask algebra (`#fff` / `#000` in SelectionFocusVeil) | Mask channel, not UI paint |
| WebGL scene materials + physical light tokens | Drawing content / motivated lighting, not chrome |

CI gate: `node scripts/check-handoff-chrome-colors.mjs` (also via `pnpm web:check-handoff-colors`).

## LA UX mapping (what operators read)

| Meaning | Stroke | Label text | Fill |
|---------|--------|------------|------|
| Existing (dwelling, retain) | `--existing-stroke` | `--existing-text` | `PLAN_FILL.existingStructure` / `.existing-structure` |
| Proposed (new work) | `--proposed-stroke` | `--proposed-text` | `PLAN_FILL.proposedStructure` / selection highlight |
| Planting retain / TPZ | `--planting-retain-stroke` | `--planting-retain-text` | `.tpz-canopy` / `--fill-tpz` |
| Planting new | `--planting-new-stroke` | `--planting-new-text` | `PLAN_FILL.plantingWash` |
| Easement (title) | `--easement-stroke` | — | hatch via easement stroke mix |
| BYDA dig | `--apwa-*` | APWA (mode-invariant) | — |
| Earthworks cut/fill | `--gs-earthworks-cut` / `--gs-earthworks-fill` | — | cell wash |

Helpers: `mixOnCanvas()`, `PLAN_FILL`, `CSS_TOKEN`, `semanticForTheme()` in `colorTokens.ts`.

SDS aliases on the studio root: `--sds-vector-primary` → `--text-primary`, `--sds-canvas-bg` → `--canvas`.
