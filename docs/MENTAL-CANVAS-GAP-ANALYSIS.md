# Mental Canvas — gap analysis and roadmap (2026-09-03)

Written after a full audit of the design handoff spec
(`design_handoff_landscape_canvas/.../README.md` + `BUILD_CHECKLIST.md`)
against the live codebase. This supersedes the phase status in the older
roadmap sections below.

## What is done

### Sketch-mode core (BUILD_CHECKLIST Phase 10 — Sketch mode 16b)

| Item | Status | Evidence |
|------|--------|----------|
| 10.1 Sketch viewport, measurement chrome off | DONE | `canvas-mode.ts` gates chrome by mode |
| 10.2 Canvases-as-cards rail (74x46) | DONE | `CanvasCardsRail.tsx` (Phase B/B2) |
| 10.3 Canvas placement: lay flat / stand up, gizmo, live readout | DONE | `CanvasPlacementFlyout.tsx`, `HingeProjectionGizmo.tsx`, `ParallelProjectionHandle.tsx` (Phase A) |
| 10.4 Presets, naming required on create | DONE | `canvasPlacement.ts` presets, flyout disabled until named (Phase A1) |
| 10.5 Stroke transfer (lock view, project) | DONE | `StrokeTransferLayer.tsx` (pre-existing) |
| 10.7 Angle-based opacity, NARROW/BALANCED/WIDE | DONE | `AngleOpacityShader.ts` + `FalloffPicker` (Phase E) |
| 10.8 Faded canvas keeps 1px edge + list row | DONE | `CanvasCardsRail.tsx` eye toggle, `hiddenCanvasIds` |
| 10.10 Viewpoint filmstrip (82x52), capture, walkthrough | DONE | `ViewpointFilmstrip.tsx`, `FlythroughRig.tsx` (Phase C/C2) |
| 10.11 Mode switch converts nothing | DONE | stroke IDs stable across mode switches |

### Entry and calibration (Phase 11 — partial)

| Item | Status | Evidence |
|------|--------|----------|
| 11.1 First run: empty site, pen lit, one line, three entries | DONE | `firstSketchGuide.ts`, `canvas-mode.ts` (Phase F) |
| 11.2 Sketch-first: open, drop aerial, draw | DONE | Sketch always unlocked (Phase F) |
| 11.3 UNSCALED badge doubles as calibrate entry | DONE | `WfsChips`, `CalibrateModal.tsx` (Phase D) |
| 11.6 Calibrate later: two points + distance, one undo | DONE | `CalibrateModal.tsx`, `commitCalibration` (Phase D2) |
| 11.7 Calibration commit states FROM->TO + hazard | DONE | `CalibrateModal.tsx` SCALE THEM / KEEP HEIGHTS |

### Numeric entry (Phase 4.12 — was blocked)

| Item | Status | Evidence |
|------|--------|----------|
| 4.12 Tap-to-type numeric entry on every flyout parameter | DONE | `NumericSlider.tsx` on all 5 flyout sliders (Phase K) |

### Pre-existing foundations

| Feature | Status |
|---------|--------|
| R3F scene shell, plane stack, FusedCamera | EXISTS |
| Plane-locked ruler as scene geometry (not DOM) | EXISTS (`SketchCanvasGroup.tsx`, `stationing.ts`) |
| Crosshair + E/N/Z coordinate chip | EXISTS (`NibCrosshair`, `metaChips.ts`) |
| Snapping from stationing | EXISTS (`snapWorld.ts`) |
| Pen-down quiet state | EXISTS (`penDown` in store, `ToolRibbon`/`CameraDock`/`WfsChips` respond) |
| Four nibs (pen, charcoal, marker, stipple) | EXISTS |
| Stroke→object promotion | EXISTS (`sketchCad.ts`, `scheduleVectorize`) |
| Schedule with tabs (planting/hardscape/services) | EXISTS (`ScheduleSheet.tsx`, `scheduleDerivation.ts`) |
| Section view (cut lines, cut/fill hatch) | EXISTS (`SectionLayer.tsx`, `cutFill.ts`) |
| Ghost review (dashed ghost + confidence) | EXISTS (`GhostOverlay.tsx`, confidence floor in store) |
| Command palette (Cmd+K) | EXISTS (`StudioCommandPalette.tsx`) |
| Scan reveal (staged import) | EXISTS (`scanReveal.tsx`, `AiScanOverlay.tsx`) |
| Flora ring | EXISTS (`FloraRingLayer.tsx`) |
| Depth rail | EXISTS (`DepthRail.tsx`) |
| Layers panel | EXISTS (`LayersPanel.tsx`) |
| Bird's-eye HUD | EXISTS (`BirdsEyeHud.tsx`) |
| Draw/View camera mode | DONE (Phase G) |
| Selection Mode + boolean ops | DONE (Phase H) |
| Brushes panel parity | DONE (Phase I) |
| Visibility Panel (per-bookmark) | DONE (Phase J) |

## What is not done — the real gaps

### Gap 1: Chrome contract per camera state (BUILD_CHECKLIST Phase 6, spec §11c)

**This is the largest structural gap.** The spec requires every chrome element
to have one of four behaviours per camera state (same / convert / lock / hide),
driven by a single `chromeContract.ts`. None of this exists.

Missing items:
- 6.1 Port `chromeContract.ts`; drive every camera-dependent element from it
- 6.2 Ruler converts to horizon band with bearings only in 3D
- 6.3 Coordinate chip converts to eye height / bearing / fov in 3D
- 6.4 Dimensions billboard, prefix approximate, marked indicative in 3D
- 6.5 GRADE + MEASURE lock in 3D with lock glyph + one reason line
- 6.6 Weight control converts mm to screen px in 3D and says so
- 6.7 Depth rail skews to a stack in 3D; band selector in SEC
- 6.8 Suncast + drainage hide in SEC
- 6.9 Test: every ChromeElement has an entry for all four modes
- 6.10 Test: no chrome element bounding box changes between camera states

### Gap 2: 21-material palette + dash signatures (Phase 8, spec §7.1/§8c)

Missing items:
- 8.1 21-material palette, grouped, 22px swatches, no colour wheel
- 8.2 Build-up ramp at 0.22 / 0.42 / 0.62 / 0.82 / 1.0
- 8.3 Dash signatures mandatory for every semantic markup material
- 8.4 Signature scales with stroke weight, not zoom
- 8.5 Greyscale proof: every semantic line distinguishable
- 8.6 Asset bento (CANOPY/SHRUB/HARD/FURN/SYM) with real dimensions
- 8.7 Drag to active plane, ghost readout, mature-spread ring
- 8.8 Snap canopy grid 3m, scatter x5
- 8.9 Stroke→object promotion chip at nib (110ms) — the promotion logic exists but the quiet chip UI does not
- 8.10 Cmd+Z reverts promotion to ink, byte-identical

### Gap 3: History scrub (Phase 13.4-13.5, spec §8a)

Missing items:
- 13.4 History scrub: segmented by activity, ghost-ahead compare, volume delta, 1:1 with finger, zero easing
- 13.5 Branch-on-edit: releasing the head with work ahead offers a branch, never silent overwrite

### Gap 4: Sync + collaboration (Phase 13.6-13.7, spec §8b)

Missing items:
- 13.6 Four sync states: Synced / Syncing / Offline / Conflict
- 13.7 Comments pinned to a point on a plane

Note: CLAUDE.md says "Real-time multi-user sync. The store is single-tenant."
This is out of scope for the current platform. The sync *states* (offline
queue, conflict UI) could be built without real-time sync, but the full
collaboration model is explicitly deferred.

### Gap 5: Strike chip + conflict card (Phase 12.5-12.6, spec §11a)

Missing items:
- 12.5 Strike chip in top bar; tap cycles camera; in-scene pulse halo-opacity only
- 12.6 Conflict card: utility, trench depth, clearance, tolerance, severity + REROUTE / DEEPEN / FLAG

### Gap 6: Office template (Phase 15, spec §17a/17b)

Missing items:
- 15.1-15.11 Template editor, binding, overrides, version diff, issued-sheet freeze

### Gap 7: Sheet composition / issue PDF (Phase 16, spec §18a)

Missing items:
- 16.1-16.12 Live viewports, auto legend, title block, sheet set rail, crop-not-rescale, issue PDF

### Gap 8: AI run from camera dock (Phase 16b, spec §18b)

Missing items:
- 16b.1-16b.9 AI run entry on camera dock, inputs listed with counts, staged progress, drawing continues, drawing↔render scrub, two refusals

### Gap 9: Site mode / phone capture (Phase 14, spec §16c)

Missing items:
- 14.1-14.9 Portrait phone shell, outdoor palette, heading-oriented plan, four tabs, four capture actions, offline queue

Note: `apps/mobile` (Expo) is the separate mobile surface. This may be
partially covered there, but the spec's site-mode capture flow is not
confirmed in the WebGL studio.

### Gap 10: Error and empty states (spec "Open before the sprint starts" item 2)

The spec lists this as a blocking open item:
> Error and empty states — only WFS failure is drawn. Failed import, empty
> schedule, corrupt underlay, rejected calibration are not.

### Gap 11: Real project content (spec "Open before the sprint starts" item 3)

> Real project content — every number on the canonical screens is
> representative. Run one real job through all three before locking layout.

### Gap 12: Acceptance pass (Phase 17)

None of the 10 acceptance tests (17.1-17.10) have been run.

## Suggested build order

Ordered by dependency and impact. Each phase is independently shippable.

### Phase L — Chrome contract per camera state (Gap 1)
The largest structural gap. Without this, the chrome doesn't behave
correctly under camera state changes. This is a build contract, not a
feature — it governs every existing chrome element's behaviour in 3D/SEC.

### Phase M — Material palette + dash signatures (Gap 2)
The 21-material palette and dash signatures are foundational for the
drafting surface. Without them, the stroke engine lacks the semantic
markup that makes the schedule and sheet legible.

### Phase N — Strike chip + conflict card (Gap 5)
The services/subsurface system exists (TrenchLayer, SubsurfaceEngine)
but the operator-facing strike chip and conflict card are missing.

### Phase O — Error and empty states (Gap 10)
The spec's blocking open item. Every failed import, empty schedule,
corrupt underlay, and rejected calibration needs a drawn state.

### Phase P — History scrub (Gap 3)
Segmented session track with ghost-ahead compare and branch-on-edit.

### Phase Q — Sheet composition / issue PDF (Gap 7)
Live viewports, auto legend, title block, sheet set rail, PDF issuance.

### Phase R — Office template (Gap 6)
Template editor, binding, overrides, version diff.

### Phase S — AI run from camera dock (Gap 8)
No prompt box, inputs from the drawing, staged progress, scrub.

### Phase T — Acceptance pass (Gap 12)
Run all 10 acceptance tests from BUILD_CHECKLIST Phase 17.

### Deferred (per CLAUDE.md or spec "Out of v1")
- Sync + collaboration (Gap 4) — single-tenant store, explicitly deferred
- Site mode / phone capture (Gap 9) — separate Expo surface
- Panel customisation, light canvas theme, desktop layout — "Out of v1, on purpose"
