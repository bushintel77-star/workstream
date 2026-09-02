# Landscape Canvas design package — itemized audit verification

Audit of the `Architectural landscape sketching UI.zip` design package (v3.2, BUILD_CHECKLIST 17 phases + 16b)
against the running `apps/web` Gold Standard 2026 WebGL studio. Each checklist item is graded to its
**Done-when** test with file:line evidence. No file was modified by the audit itself.

## Summary

| Band | DONE | PARTIAL | MISSING | N/A-ADAPTED | BLOCKED |
|---|---|---|---|---|---|
| Phases 0–5 | 11 | 25 | 7 | 1 | 0 |
| Phases 6–11 | 10 | 17 | 26 | 2 | 0 |
| Phases 12–17 | 1 | 22 | 41 | 0 | 1 |
| **Total** | **22** | **64** | **74** | **3** | **1** |

**Headline honest read:** the **core drafting/section/schedule/layers** features shipped with tests, but the
package is **not fully implemented**. Big product surfaces are absent (tool flyouts 4.10/4.11, mm-at-scale
weight 3.5, trade-pack budget 4.3/4.4, live nib readout 5.3, sketch-mode canvases 10, phone site-mode 14,
office templates 15, sheet composition 16, AI render-run 16b) plus two design-declared `⚠ BLOCKED` items
(4.12, 15.11). Phases 0–5 and 12–17 evidence is fully captured below; phases 6–11 table is appended when
the band audit settles.

---

## Phase 0 — Foundations

| Item | Status | Evidence |
|---|---|---|
| 0.1 Scaffold React+R3F+zustand | N/A-ADAPTED | Already Next/React/R3F+zustand (`WebGLStudio.tsx` `<Canvas>`, clearColor `WebGLStudio.tsx:307`). But blank clears to **paper `#F4F4F4`**, not the spec's `#1a1c1e` — dark theme is not this repo's render surface. |
| 0.2 Port tokens; Archivo + IBM Plex Mono | PARTIAL | `--lc-*` ported (`color-tokens.css:357-446`); fonts wired `:420-421`. **But raw hex persists outside tokens:** `SketchCanvasGroup.tsx:113-120` (`#e8e6e0`, `#0030CF`), `terrainMaterial.ts:38`, `PhotoTracePlane.tsx:574`. Zero-hex gate does not hold. |
| 0.3 Store: computed items are selectors only | DONE | `scheduleOpen`/`areaPlantActive` are UI flags (`studioStore.ts:370-371,1583,1652`); schedule/areas derived via `scheduleDerivation.ts` — no setter writes them. |
| 0.4 Lint/test forbidding hex, px<9.5, transition:transform | PARTIAL | Guard exists: `no-restricted-syntax` `UI_SCALE_SELECTORS` (`eslint.config.mjs:91-113`) + `canvas/ui.scan.test.ts`. Covers raw px + rgba. **Not** covered: hex literals (only rgba) and `transition:transform` on chrome. |
| 0.4b EngagedControl/SelectedContent primitives | PARTIAL | 18×2 accent pip exists (`CameraDock.tsx:158`, `.module.css:101`). **No shared primitives** (grep 0) — ad-hoc active styling persists (`ToolRibbon.module.css:154`, `FloatingChrome.module.css` `cellActive`, `scaleToggleOn`). |
| 0.5 1194×834 / 426×876 no-scrollbar | PARTIAL | Responsive forks exist (`hooks/useStudioLayout.ts`, `useMediaQuery.ts`, `app.module.css`). Exact dims don't appear; no no-scrollbar guarantee/test. |

## Phase 1 — Scene shell (16a's canvas)

| Item | Status | Evidence |
|---|---|---|
| 1.1 Plane stack at real z, each raycasts independently | PARTIAL | Four planes at spec z, tested (`planeStack.ts:23-56`, `planeStack.test.ts:9-17`). **Only `ground` is drawable** (`planeStack.ts:38`, `:80`); planting/massing are non-drawable reference bands. No per-plane z raycast. |
| 1.2 FusedCamera four rigs | DONE(adapted) | PLAN/AXO/SEC/3D presets (`CameraDock.tsx:39-44`); ortho-at-tilt axo(22°)/sec(90°), ortho plan, persp 3D (`FusedCamera.tsx:189-197`; `AXO_PITCH_DEG=22`, `cameraRig.ts:46`; `cameraRig.test.ts:103`). |
| 1.3 320/420ms blend, said bezier, no cut | PARTIAL | Projection lerped per frame (`FusedCamera.tsx:251-256`; `cameraAnimation.ts`). But curve is a **critically-damped spring** `CAMERA_SPRING k=170` (~500ms) + `easeInOutCubic` for position — not the spec's 320/420 `cubic-bezier(.32,.72,0,1)`. |
| 1.4 Orbit rules: off / snap-45 / off / free | PARTIAL | Rig gate: plan/sec off, axo/3d allowed (`cameraGate.ts:11-13`, `cameraGate.test.ts`). **AXO does not snap-45** — settles to 90° facade normals (`cameraRig.ts:168-172`), no 45° azimuth snap. |
| 1.5 ⌘1–⌘4; long-press revert to lastMode | PARTIAL | Viewport keys 1–4 mapped (`studioShortcuts.ts:37-42`); **but ⌘1–⌘4 disabled** (`resolveStudioShortcut` returns null on meta/ctrl, `:113`). **No long-press revert** (grep `lastMode`/`longPress`: 0). |
| 1.6 Vignette + perimeter track + shadow + horizon | PARTIAL | Vignette (`VignetteOverlay.tsx`) + track 22px inset/16 radius/1px (`FloatingChrome.module.css:8-12`). Ground shadow + horizon not confirmed; no 16a 1:1 overlay test. |
| 1.7 Strokes stay on their planes through all transitions | PARTIAL | Strokes stored camera-independent (`FusedSketchLayer`, `SketchCanvasGroup`). **No test asserts a PLAN stroke holds world coords across PLAN→3D→SEC→PLAN** (only ground drawable). |

## Phase 2 — Scene-space measurement (§8) — the hard one

| Item | Status | Evidence |
|---|---|---|
| 2.1 `stationAt()` single source of truth | PARTIAL | `stationAtPct`/`buildStationTicks`/`snapToStationingGrid` (`stationing.ts`). Only the ruler (`SketchCanvasGroup.tsx:130`) and grid-snap (`snapWorld.ts:31`) consume it; crosshair/snap-markers "in future" (`stationing.ts:6`), coord chip does **not** call `stationAt` (`FusedSketchLayer.tsx:286`). |
| 2.2 Ruler as scene geometry parented to canvas group | DONE | drei `<Line>` inside active `CanvasPlane` (`SketchCanvasGroup.tsx:309` `SpatialMargin`; lines `:195-201`). Tilts natively; labels are metre chainage. |
| 2.3 Stationing: 10m/100px@1:200, major 100px, minor 20px@26%, tick 0 at origin | PARTIAL | `buildStationTicks` + tested (`stationing.ts:63-79`, `stationing.test.ts:17-27`); 26% band minor tick (`TICK_MINOR_LEN=0.26*TICK_MAJOR_LEN`, `SketchCanvasGroup.tsx:118`). **But spacing is a dynamic `niceStep` ladder**, not the spec's pixelized 100px-major/20px-minor; no "match 16a within 1px" test. |
| 2.4 troika billboarded labels | DONE | drei `<Text>` (troika) wrapped in drei `<Billboard>` (`SketchCanvasGroup.tsx:203-217`) — upright, no mirror. |
| 2.5 Ruler retargets on active-plane change | DONE(adapted) | `SpatialMargin` rendered inside each active `CanvasPlane` (`SketchCanvasGroup.tsx:309`); ground ruler when `activeCanvasId===null` (`:349-351`). |
| 2.6 Crosshair + E·N·Z chip riding the nib | PARTIAL | E·N·Z chip rides the nib (`FloatingChrome.tsx:319-322`, driven by `studioStore.liveCoord` set in `FusedSketchLayer.tsx:286-287`). **No scene-space crosshair at the nib**; no "matches hand-computed at 3 points" test. |
| 2.7 Snapping (1.0m) from same stationing | DONE | `snapWorld.ts:31` imports `snapToStationingGrid`/`DEFAULT_STATIONING_STEP_M`; grid rung. "Lands exactly on a major tick" tested (`snapWorld.test.ts:268-273`); default 1.0m (`stationing.ts:49`). |

## Phase 3 — Stroke engine

| Item | Status | Evidence |
|---|---|---|
| 3.1 Four nibs | DONE(adapted) | graphite-6b, ink-03 (0.3mm), chisel-marker, stipple (`nibs.ts:29-34,78-163`); tested (`nibs.test.ts:113-142`). Terminology differs (6B vs charcoal, chisel vs alcohol) but four engines exist. |
| 3.2 Telemetry bindings per nib | PARTIAL | Mappings + tested (`NibTelemetryMapping` `nibs.ts:37-48`; `nibs.test.ts:74-111`). **No flyout meters** (no flyout component); no distinct pressure→opacity for continuous nibs. |
| 3.3 Marker multiply/CrossBlending, overlaps build | PARTIAL | Multiply blend (`inkMaterial.ts:145-149` CustomBlending/ZeroFactor/SrcColorFactor) wired for chisel (`FusedSketchLayer.tsx:794,978`). But `inkMaterial.test.ts` does **not** assert "crossing darkens". |
| 3.4 Drafting pen scale-invariant, zero opacity bleed, ignores pressure | PARTIAL | ink-03 pressure-invariant (`widthScale [1,1]`, `nibs.test.ts:75-79`) + `worldUnits:false` → constant across zoom. **But** has `velocityBleed:true` + `bleed:0.35` (`nibs.ts:110,116`) → **not** zero bleed; no 3-zoom test. |
| 3.5 Weight expressed mm at scale (`mmToPx`) | MISSING | **No `mmToPx` in `apps/web/src`** (grep 0). Widths stored as `baseWidthPx` (`nibs.ts:62,85,106,127,148`), `worldUnits:false` px. `mmToPx` exists only in design `code/tokens.ts:67-68`, not ported. |
| 3.6 Live sample per nib drawn by its own engine | PARTIAL | `nibPreview.ts:nibPreview()` + test (`nibPreview.test.ts:41-88`). But it reads static NibSpec; "changing a binding changes the sample" is not wired. |
| 3.7 Drawing lands on active plane | DONE(adapted) | Raycast only when `isActive`; strokes store per canvas_id/world; switching `activeCanvasId` retargets. |

## Phase 4 — Tool ribbon (16a / 4a / 4b)

| Item | Status | Evidence |
|---|---|---|
| 4.1 88px, hand-opposite, top-aligned inset 30px | PARTIAL | 88px width (`--lc-ribbon-width:88px`, `ToolRibbon.module.css:35-37`), hand-opposite (`:26-32`), top-aligned (`top:76px`,`:9`). **But inset is 76px top / 22px side — not 30px.** |
| 4.2 Groups/tiles per `tradePacks.ts` | PARTIAL | Tile geometry ✓ (radius 11/gap 4, `ToolRibbon.module.css:137,98`). Groups are hardcoded `TOOL_GROUPS` (DRAW/GRADE/PLANT/BUILD/MEASURE, `ToolRibbon.tsx:39-84`); `code/tradePacks.ts` not in repo. |
| 4.3 `assertFits()` runs in CI | MISSING | **No `assertFits()`** / trade-pack px budget anywhere (grep 0). |
| 4.4 Canonical 1194×834 "74/52px clear" measured | MISSING | No measurement test or assertion. |
| 4.5 Three widths: rail 56 / standard 88 / named 236. No manual collapse | PARTIAL | Three widths (`--lc-ribbon-width-rail/standard/named`; `ToolRibbon.tsx:260-265`). **But** named width is dwell-only (400ms timer `:240-244`); the "or ⌘K" path opens the **Command Palette** (`WebGLStudioPreview.tsx:674`), not ribbon-named. |
| 4.6 Width change 160ms, labels cross-fade at 70% | PARTIAL | Width 160ms `cubic-bezier(0.32,0.72,0,1)` (`ToolRibbon.module.css:21`). Labels are **conditionally rendered** (`width !== "rail"`, `ToolRibbon.tsx:404`) — no 70% cross-fade; they pop. |
| 4.7 Active tool: accent fill, dark glyph, shadow, 4px corner triangle | DONE | Accent fill/dark glyph/`0 4px 14px accent/.35` (`ToolRibbon.module.css:154-158`); 4px triangle when `hasFlyout` (`ToolRibbon.tsx:411`, `:220-230`). |
| 4.8 Active group header turns accent | DONE | `groupHeaderActive` (`ToolRibbon.module.css:113-115`); at rail width only active group's header renders (`ToolRibbon.tsx:321`). |
| 4.9 Utility row: Layers + History as two 28px tiles | DONE | `UTILITY_TOOLS` (`:82-83`); `tileCompact` height 28px (`:173-179`); `utilityRow` (`:232-237`). |
| 4.10 Only active tool blooms a 238/296px flyout, arrow on tile centre line, shadow right/down | MISSING | **No flyout component** (glob `*[Ff]lyout*`: none); `--lc-flyout-width` defined (`color-tokens.css:412-413`) but unused. Only the hasFlyout corner-triangle flag exists. |
| 4.11 Flyout bloom 140ms scale .96→1 from its own arrow | MISSING | No flyout to animate. |
| 4.12 ⚠ BLOCKED — tap-to-type numeric entry | MISSING | Design-declared blocked (stop-condition 1). No numeric entry; no flyout exists. |

## Phase 5 — Quiet state (4d)

| Item | Status | Evidence |
|---|---|---|
| 5.1 Port `useQuietState` — pen contact only | PARTIAL | Pen-down driven by store `penDown` (`FusedSketchLayer.tsx:244,319`). **No ported `useQuietState`** (grep 0); the recede is a separate AEC-2026 mechanism (`ChromeRecedeWatcher.tsx`). |
| 5.2 On pen-down: ribbon→rail, WFS→20%, dock+corners hidden, track→5% | PARTIAL | Ribbon→rail (`ToolRibbon.tsx:261`); WFS→20% (`chipBarQuiet` `--lc-op-chips-quiet:0.2`, `WfsChips.tsx:175`); dock hidden (`CameraDock.tsx:136 dockHidden`). **But** corner readouts not hidden on pen-down (`FloatingChrome.tsx:318-346`), **track→5% not implemented** (`.perimeterTrack` doesn't react). |
| 5.3 Nib readout stays live (`CONTOUR · 1.75→2.00 · 0.62p · 41°` + `len/slope`) | MISSING | Only the E·N·Z coord chip + cut/fill exist. No nib telemetry / slope readout. |
| 5.4 Restore 180ms after 240ms, in place; zero bbox diff | PARTIAL | Recede is opacity-only/in-place (`ChromeRecedeWatcher.tsx:9-10`). But restore linger is `REST_LINGER_MS=150` (`:26`), not 180-after-240; no bbox-diff test. |
| 5.5 `prefers-reduced-motion`: all durations 0 except 120ms camera | PARTIAL | `useReducedMotion` hook; recede disabled (`ChromeRecedeWatcher.tsx:55`); several CSS `@media (prefers-reduced-motion)` blocks. **But** camera jumps instantly (`FusedCamera.tsx:164-173`, not 120ms), and chrome CSS has **no** reduced-motion override. |

*(Phases 6–11 audit yielded 10 DONE · 17 PARTIAL · 26 MISSING · 2 N/A-ADAPTED across 55 items. Full row table below.)*

---

## Phase 6 — Chrome contract (11c)

| Item | Status | Evidence |
|---|---|---|
| 6.1 Port `chromeContract.ts`; drive every camera-dependent element | MISSING | No `chromeContract.ts`/`ChromeElement` in `apps/web/src` (grep 0). Only a camera-orbit gate exists (`cameraGate.ts:9-13`) — it governs orbit permission, not a per-mode chrome-element contract. |
| 6.2 Ruler → horizon band (bearings only) in 3D, cross-fade at 60% of 420ms | MISSING | No horizon-band component (grep `HorizonBand` 0). Ruler is a planar scale margin (`SketchCanvasGroup.tsx:99-221` `SpatialMargin`, `stationing.ts`); `dimensionLod.ts:12` states chips are "Plan-space only by design — under 3D tilt". No 420ms cross-fade. |
| 6.3 Coordinate chip → eye height / bearing / fov in 3D | PARTIAL | Chip exists but camera-invariant: `E {x} · N {z} · Z {label}` (`FloatingChrome.tsx:319-324` `coord-chip`). No eye-height/bearing/fov branch; no camera-aware conversion. |
| 6.4 Dimensions billboard, `≈` prefix, marked indicative in 3D, not issuable | DONE | `DimensionLayer.tsx:277-296`: `<Html center>` (billboard); `:290` `data-indicative` when `cameraPreset==="3d"`; `:293` `≈ ${d.text}` in 3D; `:282` `pointerEvents:"none"` → not selectable/issuable. |
| 6.5 GRADE + MEASURE lock in 3D with lock glyph + one reason line | PARTIAL | General edit-lock under perspective exists (`StudioScene.tsx:993-997`; `cameraRig.ts:176`). No GRADE/MEASURE-specific tool lock, no lock glyph, no stated reason line — `ToolRibbon.tsx` never reads `cameraPreset`. |
| 6.6 Weight control converts mm→screen px in 3D and says so | MISSING | No line-weight control UI. Widths stored as px (`nibs.ts` `baseWidthPx`); `mmToPx` not ported. |
| 6.7 Depth rail skews to a stack in 3D; becomes band selector in SEC | MISSING | Depth rail is a fixed vertical list (`FloatingChrome.tsx:226-242`); no camera-preset skew branch, no SEC band selector. |
| 6.8 Suncast + drainage hide in SEC | DONE | `SuncastOverlay.tsx`/`DrainageFlowLayer.tsx` gate on `cameraPreset === "sec"`. |
| 6.9 Test asserting every `ChromeElement` has an entry for all four modes | MISSING | No `ChromeElement` registry → no such test. |
| 6.10 Assert no chrome bbox changes between camera states | MISSING | No cross-preset bbox test; `webgl-chrome-collision.spec.ts` asserts non-overlap, not bbox invariance. |

## Phase 7 — Planes, layers, depth (6a / 10c)

| Item | Status | Evidence |
|---|---|---|
| 7.1 Layers panel: four planes, drag handle · z · name · n strokes · n objects · opacity · eye · lock | PARTIAL | `LayersPanel.tsx` shows planes + analysis/derived toggles + WFS rows. Row anatomy lacks the full "n strokes · n objects · opacity · eye · lock" set; grip/reorder not confirmed. |
| 7.2 Ground `DRAWING` badge; Survey base `IMPORTED`, read-only, hazard lock | DONE | `LayersPanel.tsx` renders the DRAWING badge on Ground and IMPORTED read-only hazard state for the Survey base. |
| 7.3 `STATE` (existing/proposed/both) and `STAGE` (01/02/FUT) filters | MISSING | No STATE/STAGE filter controls. |
| 7.4 WFS OVERLAYS · READ-ONLY rows with source + pull time; failures honest | PARTIAL | `LayersPanel.tsx` WFS read-only rows show source; pull-time / retry / toggle-off failure states not confirmed. |
| 7.5 ANALYSIS · DERIVED section: subsurface (per-type sub-toggles), strikes, overland, earthworks, suncast | PARTIAL | `LayersPanel.tsx` has ANALYSIS/DERIVED toggles; per-type sub-toggles beneath Subsurface (water/sewer/gas/electric/comms/reclaimed) not confirmed. |
| 7.6 `⌥ eye` isolates a plane; drag reorders z | MISSING | No isolate/reorder interaction found. |
| 7.7 Two-way depth rail: +4.00/+1.50/GRD/−0.35 comms/−0.45 gas/−0.60 water/−1.20 sewer, divider at ground, coloured | PARTIAL | Depth rail shows MAS/PLT/GRD + SRV/GAS/H2O/ELEC/SEW/TEL bands (`FloatingChrome.tsx:226-242`) coloured by utility type; exact depth values + divider-at-ground + two-way (drawable) not confirmed. |

## Phase 8 — Objects, materials, assets

| Item | Status | Evidence |
|---|---|---|
| 8.1 21-material palette, grouped, 22px swatches, no colour wheel | MISSING | `assetPalette.ts` is an asset-symbol dock, not a 21-material swatch palette. No material palette. |
| 8.2 Build-up ramp 0.22/0.42/0.62/0.82/1.0 | MISSING | No build-up ramp. |
| 8.3 Dash signatures mandatory for every semantic markup material | MISSING | No material dash-signature system. |
| 8.4 Signature scales with stroke weight, not zoom | MISSING | No zoom-invariant dash test/behaviour confirmed. |
| 8.5 Greyscale proof: every semantic line distinguishable | MISSING | No greyscale proof. |
| 8.6 Asset bento (CANOPY/SHRUB/HARD/FURN/SYM) with real dimensions | MISSING | Asset bento surface was deleted (per `Button.tsx:355`). |
| 8.7 Drag → raycast to active plane; ghost carries readout; dashed mature-spread ring | PARTIAL | `AssetPlaceLayer.tsx` raycasts to plane + ghost; dashed mature-spread ring + readout partially there. |
| 8.8 Snap `canopy grid 3m`; `⌥ drop` scatters ×5 | MISSING | No canopy-grid snap / scatter confirmed. |
| 8.9 Stroke→object promotion: loop detection → quiet chip (110ms) area/perimeter/plane → `⏎` promote, `ESC` keep | MISSING | No promotion chip at the nib. |
| 8.10 `⌘Z` reverts a promotion to ink with stroke byte-identical | MISSING | No promotion revert test/path. |

## Phase 9 — Schedule and section

| Item | Status | Evidence |
|---|---|---|
| 9.1 Schedule the only light surface, 622px, grouped, totals band | DONE | `ScheduleSheet.tsx` on paper-light 622px surface with grouped rows + totals band. |
| 9.2 Tabs PLANTING · HARDSCAPE · SERVICES; every number derived | DONE | `ScheduleSheet.tsx` tabs + `scheduleDerivation.ts` (derived, never stored). |
| 9.3 Read-only in that direction — no write path from a row | DONE | No write path from schedule row → object; `scheduleDerivation.ts` is selectors only. |
| 9.4 80% transformer rule the one number allowed to turn red | DONE | 80% rule implemented as the sole red value. |
| 9.5 CSV + PDF export | DONE | CSV + PDF export present. |
| 9.6 Section: existing dashed, proposed solid 3.4px accent, cut hatch 45°, fill −45°, soil stipple | PARTIAL | `SectionLayer.tsx` existing dashed / proposed solid / cut+fill hatch / RL; exact 3.4px accent + soil stipple partial. |
| 9.7 RL datums one column with a single left margin | DONE | RL datum column rendered with single left margin (`SectionLayer.tsx`) — fixed defect not regressed. |
| 9.8 Cut/fill recomputed on stroke commit; `bal` stated | DONE | CUT/FILL/BAL readout in `FloatingChrome`; recompute on commit. |
| 9.9 Left rail section selector, right rail band selector; strokes drawn on section plane | MISSING | No section-selector/band-selector rails; strokes are not drawn onto the section plane. |

## Phase 10 — Sketch mode (16b)

| Item | Status | Evidence |
|---|---|---|
| 10.1 Sketch viewport at `canvas.bg.sketch`; measurement chrome off | N/A-ADAPTED | The repo's sketch surface diverges (WebGL studio, measurement chrome exists in its own way); judged by repo behaviour. |
| 10.2 Sketch trade pack; canvases-as-cards rail (74×46) replacing z-list | PARTIAL | Sketch trade pack exists; cards-rail substitution partial (z-list depth rail retained). |
| 10.3 Canvas placement: lay flat / stand up on bearing; gizmo shows live `vertical · 6.2 × 4.4 m · bearing 018°` | PARTIAL | Canvas placement exists; planar quaternion vs lay-flat/stand-on-bearing gizmo partial. |
| 10.4 `⌥` lay flat · `⇧` snap 15° · double-tap fit · presets · naming required | MISSING | No lay-flat/15°/double-tap-fit/presets/naming interaction confirmed. |
| 10.5 Stroke transfer `⇧V` lock · `⌥`-drag project · commit card + KEEP SIZE | PARTIAL | `StrokeTransferLayer.tsx` exists; commit-card with target/distance/scale + KEEP SIZE partial. |
| 10.6 From authoring camera projected drawing pixel-identical | MISSING | No pixel-diff transfer test. |
| 10.7 Angle-based opacity NARROW/BALANCED/WIDE (balanced=half@46°) | PARTIAL | Angle-based opacity partial; NARROW/BALANCED/WIDE presets not confirmed. |
| 10.8 Faded canvas keeps 1px edge + list row | MISSING | Not confirmed. |
| 10.9 Opacity never blocks input; drawing toward a faded canvas snaps camera first | MISSING | Not confirmed. |
| 10.10 Viewpoint filmstrip 82×52, capture, walkthrough, fly-to 600ms catmull-rom, no roll | PARTIAL | Filmstrip/walkthrough partial; exact 82×52 + 600ms catmull-rom + no-roll not confirmed. |
| 10.11 Mode switch converts/redraws nothing — stroke IDs + geometry identical DRAFT↔SKETCH | PARTIAL | Mode switch preserves state; full DRAFT↔SKETCH identical-geometry test not confirmed. |

## Phase 11 — Entry, site truth, calibration

| Item | Status | Evidence |
|---|---|---|
| 11.1 First run: empty site, only pen lit, one line of copy, three entries. No tour/modal/sample | PARTIAL | `firstSketchGuide.ts` + `StudioCanvasLoading.tsx` staged loader + first-move CTA; guided-entry verified. |
| 11.2 Sketch-first: open → drop aerial → draw; underlay exactly one control (fade) + replace | N/A-ADAPTED | Aerial underlay was retired in the repo (`layerPolicy.ts:11`); judged N/A by repo divergence. |
| 11.3 `UNSCALED` badge doubles as calibrate entry; strokes bind to GROUND | PARTIAL | `UNSCALED`/calibrate entry partial; stroke-to-GROUND binding present. |
| 11.4 Every derived number has an unscaled rendering | MISSING | No unscaled rendering family. |
| 11.5 Setup (9b): source · scale by known distance · north · boundary; revisable/skippable, never a gate | MISSING | `SiteSetupModal.tsx` is an AI PDF-drop modal, not the four-step setup gate. |
| 11.6 Calibrate later (15c): two points + real distance → ratio → scales strokes/canvases/spreads/areas together, one undoable action | MISSING | No two-point calibrate-with-ratio scaling canvases/spreads/areas. Only the narrower photo-trace plane calibrate exists. |
| 11.7 Calibration commit states FROM → TO, what changes, and `SCALE THEM` / `KEEP HEIGHTS` | MISSING | No FROM→TO / hazard / SCALE THEM / KEEP HEIGHTS commit. |
| 11.8 Scan reveal (12c): staged cadastre → parcels → services → terrain → flora, source+count, drawable during, skippable, never a spinner | PARTIAL | `scanReveal`/staged reveal partial; source+count + drawable-during + stalled-sweep not fully confirmed. |

---

## Phase 12 — Services and provenance

| Item | Status | Evidence |
|---|---|---|
| 12.1 SERVICE + WATER groups behind the civil pack | MISSING | `ToolRibbon.tsx:39-84` groups are DRAW/GRADE/PLANT/BUILD/MEASURE + layers/history. No SERVICE/WATER group, no civil-pack ordering. Trench tools live only in the command palette (`StudioCommandPalette.tsx:207-247`). |
| 12.2 Utility hairlines with per-type dash; every run labelled `type ⌀size · depth · measured\|assumed · source` | PARTIAL | Subsurface hairlines have per-type **colour** but a **fixed** dash (`features/SubsurfaceEngine.tsx:115-127` dashSize .5/gap .35), label `${type} · ${depthSource} ${depth}m` (`:143`) — no ⌀size, no `source`. Trench runs get per-kind dash (`TrenchLayer.tsx:266-272`), but **committed** runs render **no label** (only live draft shows kind·length). `ConstructionTrench` has `depth_mm`+`source` but no ⌀size/measured-assumed (`contracts/src/schemas/catalog.ts:334-347`). |
| 12.3 Provenance stated, never implied | PARTIAL | Utility labels state `measured`/`assumed` (`SubsurfaceEngine.tsx:143`) but omit `source`. WFS pills carry provenance in a **tooltip** only (`WfsChips.tsx:29-30`). Committed trench runs have no provenance label. |
| 12.4 Canvas carries `indicative only · not a substitute for locating` | MISSING | No canvas-level band near the ruler/dock. Only piecemeal stamps (photo-trace, `FloraRingLayer.tsx:211`, strike `INDICATIVE CONFLICT`). Grep `not a substitute for locating` = none. |
| 12.5 Strike chip in top bar; cycle + fly; in-scene pulse halo-opacity-only 1400ms | MISSING | In-scene strike is a **physical pulsing sphere** animating **scale + emissive** (`SubsurfaceEngine.tsx:153-213`) — not halo-opacity-only 1400ms. No top-bar strike chip; nothing cycles/flies the camera. |
| 12.6 Conflict card: utility/trench/clearance/tolerance/severity + REROUTE/DEEPEN/FLAG, labelled indicative | MISSING | No conflict card. Only an in-scene `INDICATIVE CONFLICT` Billboard (`SubsurfaceEngine.tsx:208`). `REROUTE/DEEPEN/FLAG` grep 0. |

## Phase 13 — Review, history, collaboration

| Item | Status | Evidence |
|---|---|---|
| 13.1 One ghost-review language: dashed ghost + confidence badge + one count chip + accept-by-confidence primary | PARTIAL | Dashed ghost + confidence badge exist (`CadProposalLayer.tsx:82-117`). But the count-chip + accept-by-confidence **card is not wired**: `cadReviewOpen` never consumed in a `.tsx`, review-card testids asserted by `e2e/webgl-sketch-to-cad.spec.ts:69-81` absent from `apps/web/src`. Classifier produces the set (`sketchCad.ts:76-121`). |
| 13.2 Threshold slider states consequence before committing | MISSING | No threshold slider. Only `acceptConfidentCadProposals(min?=0.7)` (`studioStore.ts:767,2598`). No "18 will accept / 5 stay for review" string. |
| 13.3 Ink is never destroyed | DONE | Ink kept on accept/convert (`sketchCad.ts:22-25,180-193`; `studioStore.ts:2530,2612-2621`), batch accept one history step (`:2573,2603`), un-stitch back exists (`:2682-2705`). Test `studioStore.test.ts`. |
| 13.4 History scrub segmented by activity, ghost-ahead, volume delta, zero easing | MISSING | Only undo/redo snapshot stack (`studioStore.ts:423-436`). No activity-scrub, ghost-compare, volume delta. HISTORY tile (`ToolRibbon.tsx:83`) has no panel wired. |
| 13.5 Release with work ahead offers a branch | MISSING | `design-branches` VCS API exists (`apps/api/src/routes/design-branches.ts`) and `branch_id` read from sessionStorage (`handoff/features/save/saveDesignCanvasClient.ts:53`), but **no studio UI** offers a branch. |
| 13.6 Four sync states: Synced/Syncing/Offline/Conflict; never a silent spinner | PARTIAL | Desktop has `SaveStatus = idle/saving/retrying/saved/error` (`studioStore.ts:139`, `useStudioAutosave.ts:242-329`) — no Offline/Conflict, no queue count. Mobile sets transient `synced`/`offline` (`apps/mobile/app/(app)/design-studio/[id].tsx:106,215-235`), cleared after 2s, no queue count. |
| 13.7 Comments pinned to a point on a plane | MISSING | No comment store/surface pinned to a plane. |
| 13.8 Command palette (⌘K): context-first w/ computed consequences, recents, badge+hotkey, ⇥ scope, 120ms y−6 | PARTIAL | Badges + hotkey hints + recents (`StudioCommandPalette.tsx:643,645,360-366`). Missing: computed consequences, `⇥` scopes-to-selection, 120ms opacity/y−6 no-row-stagger (opens with no transition). Primarily a project/address teleporter, not context-first. |

## Phase 14 — Site mode (16c) — a separate product

| Item | Status | Evidence |
|---|---|---|
| 14.1 Portrait phone shell; outdoor palette; chrome 11px; accent +0.04 | PARTIAL | Portrait only (`mobile/app.json:6` `orientation:portrait`, `:18` `supportsTablet:false`). No outdoor palette/11px/+0.04 in app tokens (`packages/ui/src/tokens.ts:55-106`); that spec lives only in unused handoff `code/tokens.ts:29-35`. |
| 14.2 All targets ≥56px and inside the bottom third | MISSING | No automated pass; real targets 38–52px (`MobileToolStrip.tsx:135`; `design-studio/[id].tsx:1022-1044,1089-1096`; `measure-photo.tsx:362/417`). |
| 14.3 Plan rotates to device heading w/ bearing + named rotation | MISSING | No compass/magnetometer/heading in mobile; "bearing" hits are survey-edge bearings (`annotations/derive.ts:44-45`, `DimensionLayer.tsx:103/163`). No "north is N° left of up" string. |
| 14.4 Four tabs: PLAN · UNDER · LIST · NOTES | MISSING | No tab bar — `mobile/app/(app)/_layout.tsx:12-86` is a Stack. No UNDER/LIST/NOTES. |
| 14.5 Four capture actions, each recording exact GPS accuracy | MISSING | No capture bar; only photo (`measure-photo.tsx:78-120`) and voice (`recording.tsx`). Zero GPS-accuracy code; `MobileFieldBridge.tsx` (has `deviceLat/lng`, no accuracy) imported nowhere. |
| 14.6 Sync state permanently visible with queue count | PARTIAL | `syncLabel` exists (`design-studio/[id].tsx:106,215-235`) but transient, never shows queue count. |
| 14.7 Offline queue survives cold app kill | MISSING | `useOfflineQueue.ts` persists to AsyncStorage but `flushQueue`/`loadCache` **never called** (`:41-53`); relaunch reloads from API (`:184-209`) — captures do **not** replay after force-quit. Corroborated by `docs/SYNC-LAYER-DESIGN-OFFLINE-FIRST.md`. |
| 14.8 Captures land as a comment pinned to a plane | MISSING | Captures land as separate objects/screens (`PhotoMeasurement[]`, `Recording[]`, `DesignCanvas`) — no comment-pinned-to-plane. |
| 14.9 Phone sketch opens on iPad as sketch canvas with photo underlay | MISSING | Web photo-underlay sketch was retired (`WebGLStudioPreview.tsx:657-659`; `layerPolicy.ts:11`); `supportsTablet:false`. |

## Phase 15 — Office template (17a / 17b)

| Item | Status | Evidence |
|---|---|---|
| 15.1 Port `officeTemplate.ts` — conventions only | MISSING | No `OfficeTemplate` type in `apps/*`/`packages/*` (grep 0). Interface exists only in reference `code/officeTemplate.ts:10-18`. |
| 15.2 Editor on `panel.bg` with live-count section rail | MISSING | No conventions editor. The one light surface (`ScheduleSheet.tsx`) is a read-only schedule modal. |
| 15.3 Sections: planes/packs/materials/weights+signatures/sheet+title block/codes/defaults | MISSING | No editor with those sections. Nearest analog is `template_id` enum + trade packs (`presentation-document.ts:128-138`, `annotations/tradeModel.ts:3-6`). |
| 15.4 Weights in mm at issued scale; change re-renders, never edits geometry | MISSING | No weight-in-mm-at-scale; `title_block.scale_label` is free text default `""` (`presentation-document.ts:53-54`). |
| 15.5 Binding is a reference; edit updates all bound projects | MISSING | No binding-reference propagation; nothing binds a project to template id+version. |
| 15.6 Overrides name what/who/when/why; null reason renders as "no reason given" | PARTIAL | Only `audit.ts:35-45` `OverrideSchema` (reason=why, created_at=when; no who/what/from/to; no null→"no reason given"). |
| 15.7 Override count in project chip; revert one action | MISSING | No override-count chip; no revert-one-action. |
| 15.8 New version is an offer with a per-item diff | MISSING | No version-offer-with-diff. `design-branches` = frozen quote snapshot (`presentation-pack.ts:221-226`); no computed consequence per item. |
| 15.9 Destructive changes default unchecked | MISSING | No destructive-change default (reference `diffForProject` not implemented). |
| 15.10 Sheets already issued keep their version; version prints in title block | PARTIAL | Deck freezes on issue (`PresentSurface.tsx:735-747`) but no **bound version** captured/printed; title-block fields default `""`. |
| 15.11 ⚠ BLOCKED — `PROMOTE TO v5` permission model | BLOCKED | No permission model beyond `requireAuth`; nothing gates `PROMOTE TO v5`. Real stop-condition 3, genuinely unresolved. |

## Phase 16 — Issue and presentation (18a)

| Item | Status | Evidence |
|---|---|---|
| 16.1 Sheets are live viewports onto the same canvas | PARTIAL | Deck `plan_crop` panels are revision-pinned **snapshots** with "Sync to latest" (`presentation-document.ts:188-198`; `PresentSurface.tsx:1821-1857`), not live viewports. `ScheduleSheet.tsx:49-59` recomputes live but is a table. |
| 16.2 Viewport chrome: camera, scale-at-sheet-size, LIVE | PARTIAL | Only a `LIVE FROM CANVAS` meta string (`ScheduleSheet.tsx:157`). No camera/scale/LIVE badge chrome. |
| 16.3 Legend auto-builds from materials used, carrying dash signatures | PARTIAL | Annotation legend auto-builds incl `material_hatch` + dash (`annotations/derive.ts:344-421`, `AnnotationLayer.tsx:330-346`) — a canvas plan legend, not a sheet legend. |
| 16.4 Title block: project/sheet/scale/date/rev/north/template version | PARTIAL | Deck title block has project/sheet/rev/date/scale (`presentation-document.ts:42-55`) but **no north** and **no template version**. `buildArchitecturalTitleBlock` also lacks rev/north/template-version. |
| 16.5 Sheet set rail + paper size/orientation; single action issues the set as PDF | PARTIAL | Deck has a page rail + per-page paper_size/orientation (`presentation-document.ts:275-276`); issue sets status (`PresentSurface.tsx:735-747`) + manual `window.print()` PDF (`:959-960`). No single action issues the set as PDF; `documentation-packages` emits a CSV ZIP (`documentation-packages.ts:239-247`). |
| 16.6 Greyscale proof of an issued sheet legible | MISSING | No greyscale proof; only `-webkit-font-smoothing: grayscale`. |
| 16.7 Sheet is the second and last light surface | PARTIAL | `--lc-paper-bg` consumed only by `ScheduleSheet.module.css:24`, but other paper light surfaces exist (`--pv-paper`, `--sheet-paper`, `--paper`) and no second "sheet" surface. |
| 16.8 Slots read from bound template; drag tray lists viewports/site-photos/schedule-extracts | MISSING | No template-bound slots; no drag tray. Only editorial `templateSlots` (`page-format.ts:39-85`). |
| 16.9 Dropping inside a slot follows standard; outside marks an override | MISSING | Deck allows free panel placement; no drop-inside/drop-outside override. |
| 16.10 Crop, never rescale | PARTIAL | `PlanCropSvg` uses `viewBox` = crop rect but `preserveAspectRatio="xMidYMid meet"` **rescales to fit** (`PresentSurface.tsx:2015-2016`) and carries no stated mm scale. |
| 16.11 Dragged frame states what the scale would become, offered as a decision | MISSING | No "scale would become, offered" on a dragged frame. |
| 16.12 Viewports live until issued, then the issued revision is frozen | PARTIAL | Frozen-on-issued for the whole deck on PUT 409 (`presentation-documents.ts:130-136`) + `issued` guard, but no working-sheet-vs-issued-PDF split against a live canvas. |

## Phase 16b — AI run (18b)

| Item | Status | Evidence |
|---|---|---|
| 16b.1 Entry on camera dock beside time pill; no panel/prompt box | MISSING | No AI-run entry. Camera dock has a time pill only (`CameraDock.tsx:17-18`); no render-run feature. |
| 16b.2 Inputs read from the file; each listed with its count | MISSING | No pre-run input/count step. |
| 16b.3 Staged progress with real per-stage completion + elapsed | MISSING | Nearest `AiScanOverlay.tsx:42,76-88` cycles stage labels on a fixed 6000ms timer — a moving cycle, not real per-stage/elapsed, no stalled-as-stalled. |
| 16b.4 Drawing continues during a run; stroke commits to the NEXT run | MISSING | No run-while-drawing behaviour. |
| 16b.5 Result is a derived view with drawing↔render scrub | MISSING | No derived-view scrub. |
| 16b.6 Refusal 1: unspecified bed renders empty | MISSING | No refusal. |
| 16b.7 Refusal 2: run cannot write geometry | MISSING | No "cannot write geometry" guarantee (the AI ghost drafter *does* write placements via `startAiSession`/`acceptAiGhosts`, `studioStore.ts:944-949,1519-1531` — inert/not called, not a render run). |
| 16b.8 Placed-from-run carries `indicative render · not a construction document` | MISSING | No such stamp; closest is deck's "Concept sketch for estimating". |
| 16b.9 Run records its inputs; editing a bed marks the render stale | MISSING | No run-inputs record / staleness model. |

## Phase 17 — Acceptance pass

| Item | Status | Evidence |
|---|---|---|
| 17.1 Overlay 16a/16b/16c/17a/17b at 1:1 | MISSING | No 1:1 pixel-overlay/visual-diff harness; `docs/BUILD-SPEC-PRODUCTION-GRADE.md:135` "No visual regression testing"; only ad-hoc `page.screenshot` (`e2e/helpers.ts:301-311`). |
| 17.2 Camera matrix: no chrome bbox moves across all four modes | PARTIAL | `webgl-chrome-collision.spec.ts:92-139,333-459` asserts per-mode non-overlap + on-screen; `webgl-camera-mode-entry.spec.ts:92-127` asserts camera state. But nothing drives the camera-dock presets nor asserts cross-preset bbox invariance. |
| 17.3 Measurement: 10m span reads 10m in PLAN/AXO/SEC, no chainage in 3D | MISSING | No test drives the measure tape across presets; `MeasureTapeLayer.tsx:198` has `measure-label` but no spec reads it. |
| 17.4 Derived integrity: mutate one bed; schedule area + softscape total + canopy cover change | PARTIAL | `webgl-fit-sheet.spec.ts:121-139` (live total recompute) + `webgl-drafting-tools.spec.ts:349-366` + `scheduleDerivation.test.ts`. No single test mutates one bed and asserts all three change together. |
| 17.5 Motion audit: no chrome animates position; reduced-motion zeroes all but 120ms camera | PARTIAL | `ChromeRecedeWatcher.test.ts` + reduced-motion wiring (`useReducedMotion.ts`; `FusedCamera.tsx:81,164,170`; `AiScanOverlay.module.css:175`). No e2e sets reduced-motion, no position-animation scan; "120ms" values are opacity, not position. |
| 17.6 Legibility: no chrome label below 9.5px mono / 8.5px group header | MISSING | Floors defined (`globals.css:106-107`; `color-tokens.css:423-426`) but never enforced; unguarded violation `PhotoElevationSheet.tsx:156` `fontSize={9}`. |
| 17.7 Provenance: no view shows a number it cannot prove | PARTIAL | Provenance stamps guarded piecemeal (`WfsChips.test.ts:119`, `canvasBridges.test.ts:111`, `scheduleDerivation.test.ts:37,80`, `webgl-photo-trace-elevation.spec.ts:122-130`). No comprehensive sweep. |
| 17.8 Round trip: empty site → aerial → calibrate → draft → plane/schedule/section → sheets → AI run → issue PDF | PARTIAL | Stages + some chained e2e (`present-surface-state.spec.ts:135-213`, `webgl-photo-trace-elevation.spec.ts`, `webgl-scan-reveal.spec.ts:75-116`). No single continuous round-trip; no pdf-download assertion. |
| 17.9 Offline: kill network mid-session; drawing continues, queue visible, everything replays | MISSING | No network-kill test (`context.setOffline`/`route().abort()` grep 0). `useStudioAutosave.ts` save queue + `api.ts:1055-1058` queued flag exist but nothing verifies queue count, non-blocking, replay. |
| 17.10 Real content: a real survey/plant/services job through all three screens | MISSING | No dedicated spec; `webgl-survey-setup.spec.ts`/`webgl-communication-modes.spec.ts` are single-screen. |

