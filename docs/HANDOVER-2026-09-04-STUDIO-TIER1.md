# HANDOVER — Studio front end: state + Tier-1 widget standard (2026-09-04)

For a fresh context window. Everything below is verified against git and the
live tree as of commit `0af7649` (pushed to `origin/main`).

---

## 1. Where things stand

### Shipped this session (all pushed, all gates green at commit time)
| Commit | Content |
|---|---|
| `dc6d882` | Collision e2e run for real → fixed the 960×640 bottom-stack/rail overlap + 1280×720 depth-rail/scale-toggle overlap (SUB·4 collapse <820px viewport); Tidy HUD spawn coords corrected through the canvas rect; Z-routing contract pinned in `sketchCad.test.ts`; spec bundle self-fetch (SSRF finding) removed; stray `ArchitecturalLandscapeUI/` duplicate deleted |
| `b032a6f` | `docs/MORPHOLIO-TRACE-3D-GAP-ANALYSIS-2026.md` — Trace × Mental Canvas gap analysis, 56-feature matrix, parity map (the Mental Canvas spatial engine is ALREADY BUILT here — phases A–R of `docs/MENTAL-CANVAS-ROADMAP.md`), 3 seams, phased roadmap |
| `0250530` | Polish track added to the roadmap (phases 1b/4b/5/6) + governing rule: "polish sticks only when a gate enforces it" |
| `b463052` | Phase 1 stroke assist: `strokeAssist.ts` (pull-chain stabilizer w/ follow floor, hold-to-straighten ≥400ms + ≥0.6 straightness, 15°/5° snap), wired into BOTH draw paths; SM dial in brush flyout; `webgl-sketch-assist.spec.ts` (PASSING — HUD spawn, BED→PLT default, plane cycle, ESC dismiss, hint retire); Tidy preview elevation tag (visible in PLAN); chip-bar 8px gap; API stress budgets |
| `0af7649` | RESTORE of the Phase-1 wiring lost to an interrupted stash (see §2) — FusedSketchLayer/ToolFlyout/studioStore wiring, annotations-spec repair, stress budgets to 600s |

### CI state
- Last push (`0af7649`) triggers CI — **check `gh run list --repo bushintel77-star/workstream --limit 2` before starting work.** Expect `gate` green now (stress budgets 600s); the pre-`0af7649` failure was stress timeouts under 2-core contention, not assertion failures.
- Deploy (Railway) is decoupled from e2e; deploys on main pushes when gate+secret-scan pass.

### The incident a fresh session must know (§ lost-wiring)
An interrupted `git stash push` stranded the Phase-1 wiring in stash index
`d0cdea3` while `b463052`'s commit message announced it. Recovered via
`git checkout d0cdea3 -- <paths>` in `0af7649`. **Lesson encoded:** announce
content must equal the commit's own diff. If a stash ever fails mid-flight,
check `git stash list` + `git fsck --lost-found` before re-doing work.

### Open threads (ranked)
1. **Stress-test economics** (see §4): 600s budgets are a splint. The right
   fix is a dedicated slow-stress CI job + removing stress suites from the
   pre-commit `vitest related` path.
2. **First-move hint can resurrect** after a second stroke's HUD cycle
   (observed visually; `guideFirstSketch` retires correctly on first ink —
   the resurrection path is unwired). Cosmetic; repro in
   `webgl-sketch-assist.spec` step 3 screenshot.
3. **Chip-bar middle pill truncates** when the top row is crowded (~1280px):
   a keyless-overlay pill between the primary chip and UNSCALED clips.
   `WfsChips.module.css` needs an overflow strategy (priority order exists —
   `visibleOverlays = chips.slice(0, 4)` — but the bar can still overflow).
4. **N? bearing** is BY DESIGN (uncalibrated north; schema tests say so). Do
   not "fix" it into a fake number. The bottom-left "N" circle is the Next.js
   dev overlay — not app chrome; it does not exist in production.
5. **Transient "Untitled site" fallback** during slow refetches (hold
   last-good address in the chip instead of dropping to the fallback).
6. Medium Mimosa findings in `apps/api/src/routes/cad.ts` (taint-style
   warnings through the `getOwnedProject` guard — guard is correct; the
   scanner can't see through it). Review and either annotate or refactor.
7. Untracked dev servers: orphaned `next dev`/API instances may hold ports
   3001/3002 (PIDs change; `netstat -ano | findstr LISTEN`). Playwright
   config starts its own with `RATE_LIMIT_MAX=10000`.

---

## 2. THE DESIGN BRIEF — Tier-1 widget standard (user directive 2026-09-04)

User words: the Brush flyout "needs to align with the PEN on the vertical
ribbon; ideally a dedicated brush-and-pen widget and a dedicated colour
palette widget — what's best-practice UI, interaction logic and UX? Apply
that standard across ALL UI layout, elements and components. Really make the
front end look Tier-1."

### 2.1 Diagnosis of today's flyout (the user is right)
`ToolFlyout` currently stacks FOUR concerns in one column: Brush (nibs +
width + smoothing + eraser), Materials (palette), Target plane, Falloff.
Problems: iteration frequency mismatch (colour changes far more often than
nib), scroll depth buries Target plane, one giant panel = one big layout
shift on open, and its `top` is set once (`338px`) rather than tracking the
PEN tile's live row.

### 2.2 Target architecture — two dedicated widgets + alignment law

**Widget A — Brush & Pen (ribbon-anchored to PEN/LINE/SPLINE tiles)**
- Contents: nib grid (keep SVG stroke previews + purpose titles), W width
  (NumericSlider — keep tap-to-type), SM smoothing, ERASE toggle, Opacity
  (add — missing today; Trace/Procreate both expose per-brush opacity).
- Split out: Target plane → its own compact widget anchored to the
  PLANT/BUILD tiles (it is a *where*, not a *what*); Falloff → stays with
  the draw widgets but as a 4th section collapsed by default.

**Widget B — Colour Palette (ribbon-anchored to a NEW colour-well tile)**
- The ribbon gains a **colour well tile** (current material colour as a
  filled square) — Procreate/Figma pattern: the toolbar always previews
  state so the panel can stay closed.
- Palette contents: grouped swatches (softscape/hardscape/soil-water/markup —
  keep), a RECENT row (last 6 used; session-scoped), and the active well
  with previous-swap on click.
- Contrast honesty: the active swatch shows its contrast ratio against the
  current canvas theme — the repo already enforces ink contrast
  (`ink-contrast-token.test.ts`); surface the number.

**Alignment law (the user's first ask)**
- Every flyout MUST anchor to its tile: compute `top` from the tile's live
  `getBoundingClientRect()` (ResizeObserver + scroll-safe), keep the arrow
  glyph pointing at the tile, never cover the tile itself, flip sides at
  viewport edges (the `--flyout-origin` var + `arrowRight` exist — wire them
  to real tile geometry instead of a static top).
- Never let a flyout cross the collision gate's instrument boxes; the gate
  (`webgl-chrome-collision.spec.ts`) is the acceptance check — add the two
  widgets' open states to the spec's measured states.

### 2.3 Interaction logic (best-practice, Procreate/Figma/Trace synthesis)
- **Zero-mode-shift preview**: changing nib/colour re-renders the ribbon tile
  preview instantly; panels open on click, stay open while the pointer is
  inside them, close on outside-click/Esc/tool re-click (current behaviour —
  keep, it matches the collision gate's assumptions).
- **Slider duality**: every slider keeps tap-to-type (NumericSlider exists);
  add arrow-key steps and shift = ×10 step.
- **Alt = temporary erase** (p/alt hint exists) — extend: hold the eraser
  tile to latch.
- **Keyboard**: B pen, E eraser, [ ] size down/up, X swap previous/current
  colour — mirror Photoshop muscle memory; register all in
  `StudioShortcutsHelp`.
- **Recents + defaults**: last nib/colour/size persist per project session;
  per-nib smoothing defaults (technical pen 5%, charcoal 25%) land with
  Phase 1 leftovers.
- **Motion**: 50ms linear opacity only (chrome contract §5.5) — no easing,
  no layout shift on open (the gate's no-bounding-box-change test is the
  referee).

### 2.4 Apply studio-wide ("the standard")
Every chrome surface conforms to: token-only colour (gates enforce), 8px
spacing grid (`--ws-space-*`), section headers = title + shortcut hint,
`--ws-radius-*` + `--ws-shadow-*` tiers, focus-visible rings everywhere,
tabular figures on every live numeral, collision-gate coverage for every new
open state, and `tokens.css` registration before any new token ships.

### 2.5 Build order + acceptance
1. Extract `BrushWidget` + `PaletteWidget` out of `ToolFlyout.tsx` (pure
   moves, no behaviour change) — collision + sketch-assist specs stay green.
2. Tile-geometry anchoring (ResizeObserver) — screenshot before/after at
   1280/1440/2560.
3. Colour-well ribbon tile + recents — Button.test-style unit + vision shot.
4. Contrast readout on the active swatch.
5. Target-plane extraction; Falloff collapse.
6. Gates: typecheck, lint, sketch-assist e2e, collision e2e (with the two
   widgets' open states added), handoff-chrome + css-scales + parity scripts.

---

## 3. Key files map (fresh-session shortcuts)
- Widgets today: `apps/web/src/components/canvas/webgl/ToolFlyout.tsx` (+`.module.css`)
- Ribbon: `ToolRibbon.tsx` (ribbonMachine XState collapse; tile defs ~line 80-95)
- Alignment CSS today: `ToolFlyout.module.css` (`--flyout-origin`, `.arrow*`)
- Anchor pattern to copy: `BirdsEyeHud.tsx` (canvas-rect geometry)
- Store dials: `studioStore.ts` — `strokeSmoothing`, `holdToStraighten`,
  `brushWidthOverride`, `activeMaterialId`, `draftingMode`
- Assist math: `strokeAssist.ts`; e2e: `webgl-sketch-assist.spec.ts`
- Design law: `docs/GOLD-STANDARD-2026.md` (supreme) + `tokens.css`
- Vision evidence: `apps/web/test-results/sketch-assist-*.png`

## 4. Stress-test note (why CI went red twice)
`tier1` stress suites multiply a ~20-25s pipeline by 15-25 iterations inside
fixed timeouts. Locally green (126s); in CI/pre-commit `vitest related` runs
suites concurrently on contended cores → 300s exceeded with green assertions
twice. Budgets now 600s (works). Proper fix (ranked): dedicated
`stress` CI job with its own timeout; exclude stress files from the
pre-commit related-run; consider `--shard`-style iteration scaling by
`process.env.CI`.
