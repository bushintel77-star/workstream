# Build checklist — Landscape Sketch Canvas

For an autonomous coding agent working the spec end to end. **Work top to bottom.** Phases are ordered by
dependency; items inside a phase can run in parallel unless a dependency is named.

Every item has a **Done when** that is objectively checkable. If you cannot check it, the item is not done.
Do not mark an item complete because the code exists — mark it complete because the test passes.

- Spec: `README.md` (§ refs below)
- Visual truth: `Landscape Canvas.dc.html` — cards `16a` `16b` `16c` `17a` `17b` are the build targets;
  turns 1–15 are rationale, not instructions. **Where they disagree, the canonical card wins.**
- Code shape: `code/` (reference snippets, not a library)

---

## Rules of engagement

**Stop and ask** — do not guess — if you hit any of these:

1. A numeric parameter needs tap-to-type entry and no pattern is specified (§5.3 open item).
2. An error or empty state is not drawn (failed import, empty schedule, corrupt underlay, rejected calibration).
3. A permission question — who in a practice may publish a template version, or run `PROMOTE TO v5` (17b).
4. Any element that would need to show a number it cannot prove is true.

**Never do these.** Each was a decided position, not an oversight:

- ❌ Build the ruler as a CSS/DOM overlay. It is scene geometry (§8). The HTML mock's version is a fake.
- ❌ Store a derived value (schedule rows, areas, volumes, canopy cover). Selectors only (§9).
- ❌ Shrink a chrome label below 9.5px mono / 8.5px group header to make something fit (§3).
- ❌ Animate the position of chrome. Opacity only; position belongs to the camera (13b).
- ❌ Move a chrome element between camera states. It converts, locks, or hides (11c).
- ❌ Add a panel. Twelve subsystems and 38 features were mapped onto existing surfaces (§11a, §20).
- ❌ Auto-draw design content, or ship a "typical layout" starter (17, §0.1).
- ❌ Let a template version change a bound drawing without acceptance (17b).

---

## Phase 0 — Foundations

- [ ] **0.1** Scaffold React 18 + TypeScript + R3F + zustand. → **Done when:** `tsc --noEmit` clean, blank R3F canvas renders at `canvas.bg` `#1a1c1e`.
- [ ] **0.2** Port `code/tokens.ts` verbatim; wire Archivo + IBM Plex Mono. → **Done when:** a grep for `#` hex literals outside `tokens.ts` returns zero hits in `src/`.
- [ ] **0.3** Port `code/state.ts` store skeleton. → **Done when:** `schedule`, `grading`, `area` exist only as selectors — no setter writes them.
- [ ] **0.4** Add a lint rule or test forbidding hex literals, `px` font sizes below 9.5 in chrome, and `transition: transform` on chrome. → **Done when:** the rule fails on a deliberate violation.
- [ ] **0.4b** Implement the two active-state classes from §4 as shared primitives (`EngagedControl`, `SelectedContent`). → **Done when:** every mutually-exclusive selection in the app renders the 18×2px accent pip, and a grep finds no ad-hoc active styling.
- [ ] **0.5** Set the device target: 1194×834 tablet, 426×876 phone. → **Done when:** both viewports render without scrollbars.

## Phase 1 — Scene shell (16a's canvas)

- [ ] **1.1** Plane stack at real z: survey −0.02, ground 0.00, planting +1.50, massing +4.00. → **Done when:** each plane raycasts independently and reports its own z.
- [ ] **1.2** `FusedCamera` with the four rigs (`code/FusedCamera.tsx`). → **Done when:** PLAN/AXO/SEC/3D each land at the specified tilt and projection.
- [ ] **1.3** 320ms projection-matrix blend (420ms to 3D), `cubic-bezier(.32,.72,0,1)`, no cut. → **Done when:** frame-stepping the transition shows intermediate matrices, not a swap.
- [ ] **1.4** Orbit rules per rig: off / snap-45 / off / free. → **Done when:** dragging in PLAN pans and does not orbit.
- [ ] **1.5** Hotkeys ⌘1–⌘4; long-press active button reverts to `lastMode`. → **Done when:** ⌘4 then long-press returns to the prior rig.
- [ ] **1.6** Vignette, perimeter track (22px inset, 16 radius, 1px `track.border`), ground shadow, horizon. → **Done when:** matches 16a at 1:1 overlay.
- [ ] **1.7** Strokes stay on their planes through every transition. → **Done when:** a stroke drawn in PLAN sits at the same world coords after PLAN→3D→SEC→PLAN.

## Phase 2 — Scene-space measurement (§8) — **the hard one**

- [ ] **2.1** `stationAt()` as the single source of truth for chainage. → **Done when:** ruler, crosshair, coordinate chip and snap markers all call it; no second implementation exists.
- [ ] **2.2** Ruler as line geometry parented to the active `SketchCanvasGroup`. → **Done when:** at AXO 22° the chainage tilts with the site edge and a measured 10m span still reads 10m.
- [ ] **2.3** Stationing: 10m per 100px at 1:200, major tick 100px, minor 20px at 26% band, tick 0 at site origin. → **Done when:** tick positions match 16a within 1px.
- [ ] **2.4** Labels via `troika-three-text`, billboarded upright. → **Done when:** labels stay readable under orbit and never mirror.
- [ ] **2.5** Ruler retargets when the active plane changes. → **Done when:** activating Planting +1.50 moves the band to that plane.
- [ ] **2.6** Crosshair + `E · N · Z` chip riding the nib. → **Done when:** values match a hand-computed position at three sample points.
- [ ] **2.7** Snapping (default 1.0m) derived from the same stationing. → **Done when:** a snapped vertex lands exactly on a major tick.

## Phase 3 — Stroke engine

- [ ] **3.1** Four nibs: drafting pen 0.3mm, 6B charcoal, alcohol marker, procedural stipple (§7.1).
- [ ] **3.2** Telemetry bindings per nib — pressure→width+opacity, tilt→spread, velocity. → **Done when:** the flyout meters move with real pen input.
- [ ] **3.3** Marker uses multiply / `THREE.CustomBlending`; overlaps build up. → **Done when:** two crossing marker strokes darken at the intersection.
- [ ] **3.4** Drafting pen is scale-invariant with zero opacity bleed and ignores pressure. → **Done when:** stroke width is identical at 3 zoom levels.
- [ ] **3.5** Weight expressed in **mm at scale**, not px (`mmToPx`). → **Done when:** a 0.5mm line measures 0.5mm on an issued A1 at 1:200.
- [ ] **3.6** Live sample per nib row drawn by its own engine. → **Done when:** changing a binding changes the sample.
- [ ] **3.7** Drawing always lands on the active plane. → **Done when:** switching planes mid-session changes the target with no other action.

## Phase 4 — Tool ribbon (16a / 4a / 4b)

- [ ] **4.1** 88px vertical ribbon, hand-opposite, **top-aligned at inset 30px** — not vertically centred.
- [ ] **4.2** Groups and tiles per `code/tradePacks.ts`; tile geometry per §4 Geometry.
- [ ] **4.3** Trade-pack scoping, and `assertFits()` runs in CI. → **Done when:** an over-budget pack fails the build with the px overflow named.
- [ ] **4.4** Verify the canonical measurement: full CAD pack on 1194×834 ends **74px clear of the bottom edge / 52px clear of the track**. → **Done when:** measured, not assumed.
- [ ] **4.5** Three widths: rail 56 (pen down) · standard 88 (rest) · named 236 (400ms dwell or ⌘K). **No manual collapse control.**
- [ ] **4.6** Width change 160ms, labels cross-fading at 70% of the change. → **Done when:** no label pops.
- [ ] **4.7** Active tool: accent fill, dark glyph, `0 4px 14px accent/.35`, 4px corner triangle when it has a flyout.
- [ ] **4.8** Active tool's **group header turns accent** — the only wayfinding at rail width. → **Done when:** true in all three widths.
- [ ] **4.9** Utility row: Layers + History as two 28px tiles.
- [ ] **4.10** Only the active tool may bloom a flyout; 238px (296 for media/assets), arrow tip on the tile's centre line, shadow offset right/down.
- [ ] **4.11** Flyout bloom 140ms scale .96→1 from its own arrow — never a slide-in.
- [ ] **4.12** ⚠ **Blocked** — tap-to-type numeric entry on every flyout parameter. Resolve stop-condition 1 before finishing this phase.

## Phase 5 — Quiet state (4d)

- [ ] **5.1** Port `code/useQuietState.ts`. Pen contact only — never a user control.
- [ ] **5.2** On pen down (120ms): ribbon→rail, WFS chips→20%, camera dock + corner readouts→hidden, track→5%.
- [ ] **5.3** Nib readout stays fully live: `CONTOUR · 1.75 → 2.00 · 0.62p · 41°` + `len 38.4m · slope 1:14`.
- [ ] **5.4** Restore 180ms after a fixed 240ms delay, **in place**. → **Done when:** a diff of element bounding boxes before/after is zero.
- [ ] **5.5** `prefers-reduced-motion`: all durations 0 except camera at 120ms.

## Phase 6 — Chrome contract (11c)

- [ ] **6.1** Port `code/chromeContract.ts`; drive every camera-dependent element from it.
- [ ] **6.2** Ruler converts to a horizon band with **bearings only** in 3D, cross-fading at 60% of the 420ms.
- [ ] **6.3** Coordinate chip converts to eye height / bearing / fov in 3D.
- [ ] **6.4** Dimensions billboard, prefix `≈`, marked indicative in 3D — and are not issuable.
- [ ] **6.5** GRADE + MEASURE lock in 3D with a lock glyph and **one stated reason line**.
- [ ] **6.6** Weight control converts mm→screen px in 3D **and says so**.
- [ ] **6.7** Depth rail skews to a stack in 3D; becomes the band selector in SEC.
- [ ] **6.8** Suncast + drainage hide in SEC.
- [ ] **6.9** Add a test asserting every `ChromeElement` has an entry for all four modes. → **Done when:** adding a new element without a rule fails the test.
- [ ] **6.10** Assert no chrome element's bounding box changes between camera states. → **Done when:** the test passes for all four modes.

## Phase 7 — Planes, layers, depth (6a / 10c)

- [ ] **7.1** Layers panel (`L`): four planes, row anatomy = drag handle · z · name · `n strokes · n objects` · opacity · eye · lock.
- [ ] **7.2** Ground shows the `DRAWING` badge; Survey base is `IMPORTED`, read-only, lock in hazard colour.
- [ ] **7.3** `STATE` (existing/proposed/both) and `STAGE` (01/02/FUT) filters.
- [ ] **7.4** `WFS OVERLAYS · READ-ONLY` rows with source + pull time; **failures shown honestly** (`retry 04:12`, toggle off).
- [ ] **7.5** `ANALYSIS · DERIVED` section: subsurface (with per-type sub-toggles), strikes, overland flow, earthworks, suncast.
- [ ] **7.6** `⌥ eye` isolates a plane; drag reorders z.
- [ ] **7.7** Two-way depth rail: +4.00 / +1.50 / GRD / −0.35 comms / −0.45 gas / −0.60 water / −1.20 sewer, divider at ground, coloured by utility type.

## Phase 8 — Objects, materials, assets

- [ ] **8.1** 21-material palette, grouped, 22px swatches, no colour wheel. Active ring per §4.
- [ ] **8.2** Build-up ramp at 0.22 / 0.42 / 0.62 / 0.82 / 1.0.
- [ ] **8.3** **Dash signatures are mandatory** for every semantic markup material (8c); softscape stays hue-only.
- [ ] **8.4** Signature scales with stroke weight, **not zoom**. → **Done when:** dash length is constant across 3 zoom levels.
- [ ] **8.5** Greyscale proof: render the palette to greyscale; every semantic line is still distinguishable.
- [ ] **8.6** Asset bento (CANOPY/SHRUB/HARD/FURN/SYM) with real dimensions on each tile.
- [ ] **8.7** Drag → raycast to active plane; ghost carries its own readout; dashed mature-spread ring on the ground.
- [ ] **8.8** Snap `canopy grid 3m`; `⌥ drop` scatters ×5.
- [ ] **8.9** Stroke→object promotion: loop detection → quiet chip at the nib (110ms) with area, perimeter, plane → `⏎` promotes, `ESC` keeps ink. Non-modal.
- [ ] **8.10** `⌘Z` reverts a promotion to ink with the stroke intact. → **Done when:** the original stroke geometry is byte-identical.

## Phase 9 — Schedule and section

- [ ] **9.1** Schedule as the **only light surface** (`paper.bg`), 622px, grouped, with the totals band.
- [ ] **9.2** Tabs `PLANTING · HARDSCAPE · SERVICES`; every number derived from geometry.
- [ ] **9.3** Read-only in that direction — no cell edits geometry. → **Done when:** there is no write path from a row to an object.
- [ ] **9.4** 80% transformer rule is the one number allowed to turn red.
- [ ] **9.5** CSV + PDF export.
- [ ] **9.6** Section: existing dashed, proposed solid 3.4px accent, cut hatch redline 45°, fill hatch −45°, soil stipple.
- [ ] **9.7** RL datums in **one column with a single left margin** (a fixed defect — do not regress).
- [ ] **9.8** Cut/fill volumes recomputed on stroke commit; `bal` stated.
- [ ] **9.9** Left rail becomes section selector, right rail becomes band selector; strokes drawn here land on the section plane.

## Phase 10 — Sketch mode (16b)

- [ ] **10.1** Sketch viewport at `canvas.bg.sketch`; all measurement chrome off.
- [ ] **10.2** Sketch trade pack; canvases-as-cards rail (74×46) replacing the z-list.
- [ ] **10.3** Canvas placement: **lay flat** at a height or **stand up** on a bearing; gizmo shows live `vertical · 6.2 × 4.4 m · bearing 018°`.
- [ ] **10.4** `⌥` lay flat · `⇧` snap 15° · double-tap fit to site; presets; **naming required on create**.
- [ ] **10.5** Stroke transfer: `⇧V` locks view, `⌥`-drag projects. Commit card states **target canvas, distance, implied scale factor** before `⏎`, with `KEEP SIZE`.
- [ ] **10.6** From the authoring camera the projected drawing is pixel-identical. → **Done when:** a pixel diff before/after transfer is empty.
- [ ] **10.7** Angle-based opacity with NARROW/BALANCED/WIDE (balanced = half at 46°).
- [ ] **10.8** A faded canvas keeps a **1px edge and its list row**. → **Done when:** at 0% stroke opacity the canvas is still selectable.
- [ ] **10.9** Opacity never blocks input — drawing toward a faded canvas snaps the camera to face it first.
- [ ] **10.10** Viewpoint filmstrip (82×52), capture, walkthrough playback, fly-to 600ms catmull-rom, **no roll ever**.
- [ ] **10.11** Mode switch converts and redraws nothing. → **Done when:** stroke IDs and geometry are identical across DRAFT→SKETCH→DRAFT.

## Phase 11 — Entry, site truth, calibration

- [ ] **11.1** First run (9a): empty site, ground plane at true extent, only the pen lit, one line of copy, three entries. **No tour, no modal, no sample project.**
- [ ] **11.2** Sketch-first (15a): open → drop an aerial → draw. Underlay gets **exactly one control** (fade) plus replace.
- [ ] **11.3** `UNSCALED` badge doubles as the calibrate entry; strokes still bind to GROUND.
- [ ] **11.4** Every derived number has an unscaled rendering — not a hidden state. → **Done when:** no unscaled view shows a metric value.
- [ ] **11.5** Setup (9b): source · scale by known distance · north · boundary. All revisable, all skippable, never a gate.
- [ ] **11.6** Calibrate later (15c): two points + real distance → ratio → scales strokes, canvases, spreads, areas **together**, as one undoable action.
- [ ] **11.7** Calibration commit states **FROM → TO** and what changes, and surfaces the hazard: **canvases placed by eye move too**, offering `SCALE THEM` / `KEEP HEIGHTS`.
- [ ] **11.8** Scan reveal (12c): staged cadastre → parcels → services → terrain → flora, each naming source and count, drawable during, skippable. **Never a spinner**; a stalled fetch shows a stalled sweep.

## Phase 12 — Services and provenance

- [ ] **12.1** SERVICE + WATER ribbon groups behind the civil pack.
- [ ] **12.2** Utility hairlines with per-type dash signatures; every run labelled `type ⌀size · depth · measured|assumed · source`.
- [ ] **12.3** **Provenance is stated, never implied.** → **Done when:** no run renders without a source and a measured/assumed flag.
- [ ] **12.4** Canvas carries `indicative only · not a substitute for locating`, clear of the ruler band and the camera dock.
- [ ] **12.5** Strike chip in the top bar; tap cycles and flies the camera; in-scene pulse is **halo-opacity only, 1400ms — no scale, no colour flash**.
- [ ] **12.6** Conflict card: utility, trench depth, clearance, tolerance, severity + REROUTE / DEEPEN / FLAG, labelled `indicative`.

## Phase 13 — Review, history, collaboration

- [ ] **13.1** One ghost-review language for tidy / stitch / AI: dashed ghost + confidence badge, one count chip, accept-by-confidence primary.
- [ ] **13.2** Threshold slider states the consequence before committing ("18 will accept / 5 stay for review").
- [ ] **13.3** **Ink is never destroyed** — accepted strokes remain the object's source and unstitch back; one ⌘Z reverts the batch.
- [ ] **13.4** History scrub segmented by activity, ghost-ahead compare, volume delta (`then` vs `Δ now`), 1:1 with the finger, **zero easing**.
- [ ] **13.5** Releasing the head with work ahead offers a **branch** — never a silent overwrite.
- [ ] **13.6** Four sync states: Synced / Syncing / Offline / Conflict. Never a silent spinner, never a blocked canvas.
- [ ] **13.7** Comments pinned to a point on a plane; they hold through camera moves.
- [ ] **13.8** Command palette (⌘K): context-first with **computed consequences**, then recents, then everything; every row carries its group badge and hotkey; `⇥` scopes to selection. 120ms opacity + y−6, no row stagger.

## Phase 14 — Site mode (16c) — a separate product

- [ ] **14.1** Portrait phone shell; outdoor palette; chrome labels 11px; accent lightness +0.04.
- [ ] **14.2** **All targets ≥56px and inside the bottom third.** → **Done when:** an automated pass finds no interactive element above 60% viewport height or under 56px.
- [ ] **14.3** Plan rotates to device heading **with the bearing stated** and the rotation named ("north is 14° left of up").
- [ ] **14.4** Four tabs: PLAN · UNDER (strikes first) · LIST (read-only tickable set-out) · NOTES.
- [ ] **14.5** Four capture actions only, each recording its own GPS accuracy (`±1.4 m`).
- [ ] **14.6** Sync state permanently visible with the **queue count as the message**.
- [ ] **14.7** Assume no signal: offline queue survives a cold app kill. → **Done when:** captures replay after force-quit + relaunch.
- [ ] **14.8** Everything captured lands as a comment pinned to a plane — **no separate site inbox**.
- [ ] **14.9** Phone sketch (15b) opens on the iPad as a sketch canvas with the photo as its underlay.

## Phase 15 — Office template (17a / 17b)

- [ ] **15.1** Port `code/officeTemplate.ts`. Template holds **conventions only** — assert it can hold no geometry.
- [ ] **15.2** Editor on `panel.bg` with the section rail carrying live counts. Not a new surface class.
- [ ] **15.3** Sections: planes · trade packs · materials · line weights + signatures · sheet & title block · schedule codes · defaults.
- [ ] **15.4** Weights stated in **mm at issued scale**; changing one re-renders bound drawings at next open and **never edits geometry**.
- [ ] **15.5** Binding is a reference. → **Done when:** editing the template updates all bound projects with no per-project write.
- [ ] **15.6** Overrides name what, who, when, why; `null` reason renders as "no reason given" — never hidden.
- [ ] **15.7** Override count appears in the project chip; revert is one action per item.
- [ ] **15.8** New version is an **offer with a diff**, item by item, each stating its computed consequence.
- [ ] **15.9** Destructive changes (renumbering, anything touching an issued revision) default to **unchecked**.
- [ ] **15.10** **Sheets already issued keep the version they were issued at**; the version prints in the title block.
- [ ] **15.11** ⚠ **Blocked** — `PROMOTE TO v5` needs a permission model. Resolve stop-condition 3.

## Phase 16 — Issue and presentation (18a)

- [ ] **16.1** Sheets are **live viewports onto the same canvas** — never copies. → **Done when:** editing the canvas changes the sheet with no re-import.
- [ ] **16.2** Viewport chrome states camera, scale-at-sheet-size, and LIVE.
- [ ] **16.3** Legend auto-builds from the materials actually used, carrying the dash signatures.
- [ ] **16.4** Title block: project / sheet / scale / date / rev / north / **template version**.
- [ ] **16.5** Sheet set rail + paper size + orientation; one action issues the whole set as PDF.
- [ ] **16.6** Greyscale proof of an issued sheet is legible and every semantic line is distinguishable.
- [ ] **16.7** Sheet is the second and last light surface. → **Done when:** a grep finds `paper.bg` used only by the schedule and the sheet.
- [ ] **16.8** Slots are read from the bound office template; the drag tray lists every available viewport plus site photos and schedule extracts.
- [ ] **16.9** Dropping inside a slot follows the standard; dropping outside marks the sheet with an override in 17b's language.
- [ ] **16.10** **Crop, never rescale.** → **Done when:** a viewport dropped into a smaller frame keeps its scale and crops, and the stated scale still measures true on the printed sheet.
- [ ] **16.11** The dragged frame states what the scale *would* become, and the change is offered as a decision — never applied.
- [ ] **16.12** Viewports live until issued, then the issued revision is frozen. → **Done when:** editing the canvas after issue changes the working sheet and not the issued PDF.

## Phase 16b — AI run (18b)

- [ ] **16b.1** Entry lives on the camera dock beside the time pill. **No new panel, no prompt box.** → **Done when:** there is no free-text input anywhere in the flow.
- [ ] **16b.2** Inputs are read from the file — geometry, materials, species, sun, growth year — and each is **listed with its count** before the run.
- [ ] **16b.3** Staged progress with real per-stage completion and elapsed time. → **Done when:** a stalled stage shows as stalled, never as a moving spinner.
- [ ] **16b.4** Drawing continues during a run; a stroke committed mid-run joins the **next** run, and the UI says so.
- [ ] **16b.5** Result is a derived view with a drawing↔render scrub; at 0 the ink is untouched underneath.
- [ ] **16b.6** **Refusal 1:** an unspecified bed renders empty. → **Done when:** a bed with no species produces no planting.
- [ ] **16b.7** **Refusal 2:** the run cannot write geometry. → **Done when:** no code path from the run touches `objects` or a stroke.
- [ ] **16b.8** Anything placed on a sheet from a run carries `indicative render · not a construction document`.
- [ ] **16b.9** A run records its inputs so it can be reproduced or invalidated when the drawing changes. → **Done when:** editing a bed marks the placed render stale, with the reason named.

## Phase 17 — Acceptance pass

Run these against the finished build, in order. All must pass.

- [ ] **17.1** Overlay each of `16a` `16b` `16c` `17a` `17b` against the running app at 1:1. Report every delta over 2px.
- [ ] **17.2** Camera matrix: no chrome bounding box moves across all four modes.
- [ ] **17.3** Measurement: a known 10m span reads 10m in PLAN, AXO and SEC, and reads no chainage at all in 3D.
- [ ] **17.4** Derived integrity: mutate one bed's geometry; schedule area, softscape total and canopy cover all change with no explicit refresh.
- [ ] **17.5** Motion audit: no chrome element animates position anywhere; `prefers-reduced-motion` zeroes everything but the 120ms camera.
- [ ] **17.6** Legibility: no chrome label below 9.5px mono / 8.5px group header, anywhere, in any state.
- [ ] **17.7** Provenance: no imported or derived element renders without its source; no view shows a number it cannot prove.
- [ ] **17.8** Round trip: empty site → sketch over an aerial unscaled → calibrate → draft → plane, schedule, section → compose sheets → AI run → issue PDF. No dead ends, no unspecified interaction.
- [ ] **17.9** Offline: kill the network mid-session. Drawing continues, queue count is visible, nothing blocks, everything replays.
- [ ] **17.10** Real content: run one real job — survey, plant list, services — through all three screens. Layout breaks that invented data hid are found here, not in the field.
