# Canvas gallery-frame refactor — handover

**Status:** In progress, uncommitted. Gate green (see below). Safe checkpoint for a
new session to pick up.

## Scope: this is `apps/web` (desktop) ONLY — there are two separate apps

The monorepo has **two independent apps**, not one responsive app:

- **`apps/web`** (Next.js) — mounts `HandoffDesignStudio`. This is the desktop
  gallery-frame surface this whole doc is about. It DOES have a narrow-browser-
  window fallback (`compactAssetUi`, viewport `≤719px`, see
  `HandoffDesignStudio.tsx`) that swaps the dock for `AssetCommandSheet` / a
  bottom sheet — that is a compact-width branch of the *web* app, not the
  mobile app. Treat it as "web app, narrow window", not "tablet/phone".
- **`apps/mobile`** (Expo/React Native) — a wholly separate app with its own
  UI (`MobileSketchTopbar`, `MobileToolStrip`, `MobileSketchBottomSheet`,
  `DesignAssetPalette`). It does **not** render `HandoffDesignStudio` and has
  no `CameraChrome`/frame system. Its topbar has an "Open in Studio" link that
  opens the web app in a browser for the full CAD experience. **None of the
  gallery-frame/frame-rail/activity-bar work in this doc applies to
  `apps/mobile`** — different codebase, different design language, out of
  scope unless the user explicitly asks to touch it.

Implication for the pending bottom-instrument-deck task below: gate it as
"desktop web, incl. its own compact/narrow-window fallback" — do not reach into
`apps/mobile` for this.

Binding design doc: [`docs/STUDIO-STYLING-AND-UX.md`](./STUDIO-STYLING-AND-UX.md)
§ 0.1 "Gallery frame" (added this effort) + § "Camera parenting".

## The goal

Make `HandoffDesignStudio` a **framed artwork**: a premium dark-grey gallery
frame holds all chrome in border bands; the cream plan is the subject and never
carries persistent chrome. Reference target: Windsurf/VS Code shell — thin line
icons down the side, status along the bottom, drawing fills the middle.
Directive from product owner: "indistinguishable from a Fortune-500 design
product", "pixel perfect" to the Windsurf activity bar.

## What is DONE (this session)

1. **Gallery frame shell** — `handoffStudio.module.css`
   - `.root` is a matte dark mount (`--ws-frame` = `--gray-d-50`), top-lit
     gradient (`--ws-frame-lit`/`-sunk`). **Always dark in both themes.**
   - `.board` inset by `--ws-frame-top/left/right/bottom` (46/48/14/46 desktop),
     radius 5, with a multi-layer rabbet lip (cut-line + bevel + cast shadow).
   - Bands widen + `--ws-frame-tap` → 44px on `(pointer: coarse)` and
     `[data-compact="1"]`. Client view collapses left/bottom bands only.
2. **`CameraChrome place={{ kind: "frame" }}`** — `CameraChrome.tsx`
   - New portal target `[data-testid="studio-frame-root"]`, a sibling of
     `.board` spanning the whole shell (mounted in `HandoffDesignStudio.tsx`).
   - Frame chrome is categorically outside the camera → gate C stays at zero.
3. **Frame control language** — `[data-frame-rail]` block in
   `handoffStudio.module.css`. Flat monochrome line controls: dim ink → wash on
   hover → inset hairline when engaged. Tactile press (`translateY/scale`).
   Overrides the neu-plastic chip rule (documented). Stamp any rail
   `data-frame-rail="top-left|top-right|left|bottom"` to inherit.
4. **Bands populated** (all via `place={{ kind: "frame" }}`):
   - `CanvasHeaderRail` (top-left): brand + mode strip + cadastral meta + paper/elev.
   - `CanvasTopBorder` (top-right): instruments/tilt/title icons + Ask AI + ⌘K + View + Share.
   - `ToolDock` (left): top-anchored activity bar, **summon-only** (do not make
     persistent — see e2e note).
   - `ContextualToolStrip` (bottom, compact).
5. **Crisp SVG line icons** — `ToolGlyph.tsx` (new). Replaced emoji glyphs
   (`✎ ➤ + ▣ …`) in `ToolDock` + `ContextualToolStrip`. Left rail has a
   VS Code-style signal active bar (`.activeBar`).
6. **Floating chrome → dark translucent** (matches frame, not light frost):
   `CanvasContextCard`, `CanvasToolCard`, `AssetPanel` (expanded/placing),
   `headerAiPill`, `headerViewMenu`, `vicGovChips`, `phaseManager`,
   `artboardStrip`. Collapsed `AssetPanel` FILL rail seats in the left band.
7. **Site-meta chip set** — `vicGovChips.module.css` pixel pass: kicker 7.5px /
   face 10.5px, hairline `::before` seams between chips, signal top-bar active
   accent, hidden scrollbar, floats inset from the right frame edge (was
   clipping the viewport edge).
8. **Motion + finish system** — tokens on `.root`: `--ws-r-1..4`,
   `--ws-ease-out/-in-out`, `--ws-dur-1..3`, `--ws-focus`. Font smoothing +
   `optimizeLegibility`. Branded `::selection`, slim styled scrollbars. Board
   "breathes" (band margins ease on client/fit).
9. **Idle auto-fade** — `hooks/useChromeIdle.ts`; `.root[data-idle]` dims rails
   at 6s, restores on input; suspended while any panel/sheet/palette is open.

## Verification (current uncommitted state)

- `pnpm typecheck` — green
- `pnpm test` — 1047 passed
- `node scripts/check-handoff-chrome-colors.mjs` — ok (frame colours are v2
  `--gray-d-*`; only `#000`/`#fff` in `color-mix` lighting math, which the gate
  allows)
- Targeted e2e (LIVE_E2E=1, web :3002, api :3001) — 26/26:
  `canvas-chrome-detector` (gate C), `canvas-compact-chrome`, `canvas-first`,
  `pipeline-shell`, `design-studio`, `selection-focus-veil`, `tilt-lens`,
  `canvas-cream-zoom`, `interaction-contract`, `canvas-sketch-ai`.

### KNOWN PRE-EXISTING FAILURE (not from this work)
`e2e/canvas-lane-law.spec.ts:67` ("no schedule/panel card overlap…") fails at
`getByTestId('layers-panel')` after opening View → Layers. **Verified it fails
on baseline** (stashed all handoff changes, still red). Do not attribute to the
frame work; fix separately.

## Line endings (IMPORTANT for the eventual commit)
`.gitattributes` mandates `eol=lf`, but the committed HEAD blobs are **CRLF**
(pre-existing). The edit tools rewrote touched files to LF, so raw `git diff`
shows whole-file churn. **Review with `git diff -w`** (real change ≈ 1095/519
across 18 files). When committing, consider a separate "renormalize EOL" commit,
or accept the one-time CRLF→LF (which aligns with `.gitattributes`). Do NOT try
to "fix" by matching CRLF — `eol=lf` renormalizes on `git add` regardless.

## PENDING — next task: bottom instrument deck
Product owner wants the site-meta chip sets run **along the bottom band, either
side of a central CSS "thumb dock"** (DAW-transport / status-bar pattern).
Agreed composition:
- **Left of dock:** statutory facts — BOUNDARY, EASEMENTS, ZONING, OVERLAYS, COUNCIL.
- **Right of dock:** live/dynamic — TREES, BYDA, ENV (weather).
- **Center thumb dock:** the one intentionally *raised* CSS element (frame
  exception), thumb-reach zone.

Open decision (my recommended safe defaults if unanswered):
- Thumb-dock contents → **Add + Cmd+K + Ask AI** (action core). Do NOT put the
  draw tools there persistently — `canvas-compact-chrome.spec.ts` asserts
  `tool-dock` count 0 until summoned via `pointer-settings-top`; making tools
  persistent breaks it.
- This is all within `apps/web` only (see scope note at top of doc — `apps/mobile`
  is a separate Expo app and is untouched by this work). Within web: full
  instrument deck at normal desktop widths; the existing `compactAssetUi`
  (`≤719px`) narrow-window fallback keeps its current bottom sheet + FAB
  unchanged (protects the compact e2e) rather than trying to cram the split
  deck into a narrow browser window.
- Source component: `features/stickyMeta/VicGovStatusChipRow.tsx` (currently one
  flat row floating top-right via `place={{ kind:"dock" }}`). To split, partition
  chips into statutory/live groups and render the thumb dock between them; move
  to `place={{ kind:"frame" }}` in the bottom band. Watch the already-busy bottom
  band (ContextualToolStrip, PhaseManagerChip, ArtboardStrip, primary FAB,
  autosave) — reconcile, don't overlap.

## How to run (Windows / PowerShell)
Dev servers already expected on api :3001, web :3002 (`pnpm dev`).
```
pnpm typecheck
pnpm test
$env:LIVE_E2E='1'; $env:PLAYWRIGHT_BASE_URL='http://localhost:3002'; $env:API_URL='http://localhost:3001'
pnpm --filter @workstream/web test:e2e e2e/canvas-chrome-detector.spec.ts <others>
node scripts/check-handoff-chrome-colors.mjs   # hex gate
```
Render probe (writes PNGs; copy out of the gitignored artifacts dir to view):
`pnpm --filter @workstream/web test:e2e e2e/render1-presentation.spec.ts`

## Hard rules to respect
- All non-plan chrome MUST render through `CameraChrome` (gate C:
  `canvas-chrome-detector.spec.ts` — zero `[data-camera-chrome]` under
  `[data-testid="zoom-world"]`). Frame chrome uses the new `frame` placement.
- No raw hex in `apps/web/src/components/canvas/handoff` except `#000`/`#fff`.
- CSS Modules: every selector needs a local class (bare `[data-*]` / element
  selectors fail the Turbopack build — this bit us once already).
- Keep `data-testid`s: `canvas-mode-*`, `canvas-mode-strip`, `tool-dock`,
  `canvas-tool-*`, `pointer-settings-top`, `vic-gov-chip-*`, `paper-size-control`,
  `sheet-elevations-toggle`, `header-context-strip`, `council-setback-tip`.
