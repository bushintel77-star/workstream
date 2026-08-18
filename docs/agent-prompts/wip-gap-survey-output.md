# WIP and gap survey — end-to-end pipeline integrity audit (2026-08-18, main @ 7030c4c)

Survey of the Workstream monorepo against the mission in `docs/agent-prompts/wip-gap-survey.md`.
Method: read/grep/glob only; no code or doc edits; every claim carries `file:line` (or git output).
Evidence buckets used throughout: **verified** (read in code, wired, reachable), **docs claim** (stated in a
doc, not confirmed in code), **unverified** (could not confirm this session — no dev server, no Playwright,
no gate run this session).

---

## 1. Executive summary

### Pipeline health map

| Stage | Status | Evidence (verified this session) |
|---|---|---|
| 1. Title data / site truth | **Verified working** | Keyless DELWP WFS via GetCapabilities self-discovery (`apps/api/src/lib/vicmap.ts:15`, `:412-473`); keyless hydrate route `/:projectId/keyless-hydrate` (`apps/api/src/routes/keyless.ts:10`) with `DEFAULT_KINDS` incl. `native_vegetation` (`apps/api/src/lib/keyless-job.ts:22-29`); boundary GET/PUT/auto-trace (`apps/api/src/routes/boundary.ts:20-70`); web import `webgl/siteTruthImport.ts`; per-edge world segments via `pctToWorld` in `DimensionLayer.tsx:98,125`; live smoke tests gated behind `VICMAP_LIVE=1` (`vicmap.live.test.ts`, `vicmap.keyless.live.test.ts`). Live-verified on production per handover (`docs/SESSION-HANDOVER-2026-08-18-CONTINUATION.md:41-45`). |
| 2. Sketch | **Verified working** | Freehand ink on GL (`FusedSketchLayer.tsx`, mounted `StudioScene.tsx:851`); `sketchMode` store state (`studioStore.ts:214`, `:748-753`); ink persisted as `DesignCanvas.strokes` through autosave (`useStudioAutosave.ts:225`); extrude-to-mass, terrain drape. |
| 3. CAD parsing | **Verified working** | `POST /:projectId/design/sketch-cad` (`apps/api/src/routes/design-sketch-cad.ts:11-13`) → `formalizeSketchToCad` with heuristic fallback (`apps/api/src/lib/claude.ts:979,1014-1144`; tested `claude-sketch.test.ts:34-62`); WebGL rail Tidy → `tidySketchToCad` (`studioStore.ts:1165-1189`) → accept mints placement + mirrored Polygon feature (`studioStore.ts:1193-1217`, `sketchCad.ts:176-209`); one-click convert persists features and keeps ink (`studioStore.ts:1263-1284`); photo-trace strokes stamped scoped-out (`sketchCad.ts:153-159`); e2e `webgl-sketch-to-cad.spec.ts:17-18` (tidy → accept/reject → persisted contract → selection survives mode switches). |
| 4. Elevation tracing | **Verified working** (committed) | Photo pins as calibrated vertical plane (`PhotoTracePlane.tsx`); reference-line calibration (`PhotoTraceHud.tsx`); boundary snap `snapPhotoPlaneToBoundary` (`photoTraceMath.ts:79`, `:216`) with honest stamps when unsnapped (`PhotoTraceHud.tsx:126-133`, `PhotoElevationSheet.tsx:94-107`); `site-photos.ts` route + tests; persisted in `DesignCanvas.photo_elevations` (`useStudioAutosave.ts:228`); e2e `webgl-photo-trace-elevation.spec.ts:10`. **Note:** ONBOARDING §3 and OUTSTANDING still say this is uncommitted working-tree code — it is committed on `main` (`0b37127`). |
| 5. Inspector + selection | **Verified working** (single-select; bulk-edit deferred) | Click/shift-click/Esc picking (`selectionPick.ts:19-24`, `:46-50`; `WebGLStudioPreview.tsx:417-430` per `inspector-scope-output.md`); `InspectorCard` mounts at `WebGLStudioPreview.tsx:1820`; numeric/text field editing (`InspectorCard.tsx:179-278`); boundary re-clamp on geometry-affecting edits (`inspectorPolicy.ts:28-29`, `studioStore.ts:806-836`); marquee box-select shipped and reachable (see §2). Bulk-edit does NOT exist — many-refs selection shows a read-only summary (`InspectorCard.tsx:425-443`, `:452-453`). |
| 6. 3D render | **Verified working** (polish + scale gaps) | Fused ortho↔persp camera (`FusedCamera.tsx`, `cameraAnimation.ts`, `cameraRig.ts`), real sun (`sunLight.ts`, `StudioScene.tsx:34`), terrain (`TerrainMesh.tsx` mounted `StudioScene.tsx:724`), split view (`SplitViewLens.tsx`, mounted `WebGLStudioPreview.tsx:744`), live itemized fit-sheet/BOM (`FitSheetCard.tsx`, mounted `WebGLStudioPreview.tsx:1635`; e2e `webgl-fit-sheet.spec.ts`). Foliage is per-placement meshes, not instanced (`sceneItems.tsx:272-406`); foliage "murk" ramp polish is open (OUTSTANDING ranked #3). |

### Operator question — direct verdict

**Can a user edit in 3D today? Can they add assets, and do canvas logic and inventory/BOM work to the Gold Standard 2026 bar?**

- **Add assets: yes, verified.** Click-to-place from the asset fan-out (`AssetPlaceLayer.tsx:46-76`), flora ring accept (`FloraRingLayer.tsx:148-160`), and sketch→CAD accept (`studioStore.ts:1193-1217`); placement persists through autosave and reload (e2e `webgl-asset-fanout.spec.ts:15-16`).
- **Edit in 3D: partial — attributes yes, space no.** The inspector edits `symbol_id`, `scale`, `rotation_deg`, `label`, `height_m`, `canopy_radius_m` as fields (`InspectorCard.tsx:179-278`; policy `inspectorPolicy.ts:19-37`). There is **no positional editing of any kind**: no gizmo/TransformControls anywhere in `apps/web/src` (only a comment, `inspectorPolicy.ts:18`), no drag-move of placements or features in either studio, and `x_pct`/`y_pct` are deliberately excluded from editing (`inspector-scope-output.md:140`). `rotation_deg`/`scale` are numeric spins, not manipulators. A tree placed in the wrong spot **cannot be moved today** — it must be deleted and re-placed. This is the single biggest edit gap.
- **Canvas logic: largely at the bar.** Selection is one state across placements/features/photo-strokes (`selectionPick.ts:19-24`), survives mode switches (e2e `webgl-sketch-to-cad.spec.ts:18`), marquee is shipped (§2), sketch→CAD both classifier paths are wired and tested, boundary reconciliation runs on the paths where it is enforced (photo planes, CAD proposals, inspector clamps) — but has **silent non-reconciliation gaps** on direct asset placement, flora accept, and trench/zone traces (see §4, best-practice finding BP-5).
- **Inventory/BOM: works, on honest-but-canned pricing.** The live fit-sheet recomputes from canvas geometry client-side (`fitSheet.ts`, `FitSheetCard.tsx`; e2e `webgl-fit-sheet.spec.ts:23-24`), and quote math is real — but supplier prices are canned DEV rows (`apps/api/src/lib/suppliers.ts:61-97`, honesty flag `:45-46`), the Melbourne trade catalog is a static bundled array (`apps/api/src/lib/melbourne-trade-catalog.ts:15,58-113`), plant carbon is a 7-SKU stub (`packages/domain/src/carbon.ts:42-48`), polygon difference is a stub (`packages/domain/src/geometry.ts:160-165`), and survey utilities are a stub (`packages/domain/src/preemptive-risk.ts:145`). These are all documented as placeholders in OUTSTANDING ("Production placeholders" §), not hidden — the numbers are honest about their provenance.
- **Bottom line:** the pipeline is a real, mostly-integrity vertical slice from title → sketch → CAD → elevation → inspector → 3D render. The claim that **marquee is absent is false** (it shipped on main). The claim that **gizmos are absent is true and is the key parity gap** — it is the only interaction gap of the three that actually blocks end-to-end completion today (you can build and attribute-edit a design, but you cannot spatially edit it). Section/cut is a working slice instrument, not a full cut system — a differentiator-scope item, not a completion blocker.

### Parity claim verdicts (one line each)

1. **Gizmos (move/rotate/scale in 3D): CLAIM VERIFIED** — no gizmo, no drag-move, no position edit anywhere in `apps/web/src`; `@react-three/drei` is available (`apps/web/package.json:15`) so the library blocker is absent; the exact gap is "no spatial manipulation of placed geometry at all".
2. **Marquee (bulk selection): CLAIM REFUTED** — the marquee tool is shipped, reachable, and e2e-probed on main (`78864ae`, `webgl-marquee-select.spec.ts`); the docs saying "deliberately not used"/"in build"/"no marquee" are stale; the real remaining item is bulk-edit, which is genuinely not built (many-refs summary is read-only).
3. **Section/cut: CLAIM PARTIALLY TRUE** — a draggable, live "elevation slice" instrument exists and works (`ElevationSliceLine.tsx`, `SliceProfileCard.tsx`), but the full cut system (persistent named cut planes, plan section marks, saved section views on a sheet, annotation/dimensioning) does not; it is scoped as a held differentiator (`differentiator-backlog.md:32-36`).

### Top WIP items

- **Gizmo phase (parity gap #4)** — the only real completion blocker of the three claims; position editing is the prerequisite for the inspector to be a complete editing surface (`differentiator-backlog.md:27-28`, `inspectorPolicy.ts:18`).
- **Bulk-edit after marquee** — marquee selection currently lands in a read-only many-refs summary only (`InspectorCard.tsx:425-443`); bulk-apply is documented post-marquee (`inspector-scope-output.md:215-216`).
- **Foliage "murk" polish** — ranked #3 (OUTSTANDING:17), ground-bounce/`d-*` ramp in `sceneItems.tsx` FOLIAGE + `--gs-ground-bounce`.
- **Premium assets, signoff record trace, Phase 4 Build Pack** — ranked #2/#4/not-built (OUTSTANDING:15-20).
- **Human-owned ops** — CI live-verify after the GitHub billing freeze, Clerk keys, Sentry DSNs, Redis worker env, Litestream bucket, branch protection, EAS credentials (OUTSTANDING:888-899).
- **Test debt** — `webgl-asset-fanout.spec.ts` positional flake (OUTSTANDING:303-311); classic-studio e2e debt (OUTSTANDING:313-326); no e2e probe for the section/slice tool (this survey).

---

## 2. Parity claim verdicts

### 2.1 Gizmos (move/rotate/scale in 3D) — CLAIM VERIFIED

**Code.** A repo-wide grep for `TransformControls|gizmo|Gizmo` in `apps/web/src` returns exactly one match: a comment in `inspectorPolicy.ts:18` — "Placement fields the inspector can edit (v1 — position is the gizmo phase)". There is no transform-control component, no drag-move handler, and no position mutation action anywhere. `@react-three/drei` (which ships `TransformControls`) is already a dependency (`apps/web/package.json:15`), so the claim "no library blocker" is verified.

**Wiring / reachability.** Every drag path in the WebGL surface is a camera gesture, a tool trace, or a new-object placement, never a move of an existing object: pan/orbit (`StudioControls.tsx:303-327,360-372`), marquee box (`StudioControls.tsx:314-327,438-463`), sketch strokes (`FusedSketchLayer.tsx:121`), measure tape (`MeasureTapeLayer.tsx:101-122`), trench trace (`TrenchLayer.tsx:168-192`), irrigation zone (`IrrigationZoneLayer.tsx:169-199`), elevation slice line (`ElevationSliceLine.tsx:95-113`), asset placement (`AssetPlaceLayer.tsx:46-76`). `updatePlacementField` only patches the six inspector fields and never `x_pct`/`y_pct` (`studioStore.ts:806-836`); the store test locks this — "`p.x_pct` … 2 // untouched — locked classification" (`studioStore.test.ts:367-368`). The classic SVG fallback is no different: a grep for placement drag-move in `components/canvas/handoff` finds none (its `startCornerDrag` calls at `CadPlanBoard.tsx:2185,2217` edit boundary/building polygon corners, not placements).

**Object rotation vs camera rotation.** The claim warns not to count `rotateDeg` in `cameraRig.ts` as object rotation — verified: `cameraRig.ts:26-27` is the plan-view camera azimuth (`rotateDeg`), and `tiltDeg` (`:28-29`) is the camera pitch. Placement rotation exists only as the numeric `rotation_deg` field (`InspectorCard.tsx:208-229`).

**Snap / undo surface.** `snapWorld.ts` powers draw-time snap visuals and the measure tape, not a move tool (`OUTSTANDING:840-843` describes it as "draped, ephemeral" tape + sketch snap). Undo/redo exists in the store (`studioStore.ts:896-924`) and would cover a future gizmo, but there is nothing to undo a move today.

**Test.** No e2e or unit probe for a gizmo (none exists to probe); `inspectorPolicy.test.ts` covers the field classification only. **Docs claim.** `differentiator-backlog.md:27-28` (parity gap #4: "rotate / scale / vertex manipulators with their own picking, snapping, and undo surface"), `inspector-scope.md:13-14` (gizmos "EXPLICITLY OUT of scope"), `inspector-scope-output.md:140,204-207` (position fields belong to the gizmo phase). All consistent with code.

**Verdict (confidence: high).** The claim is verified, and it is stronger than "no gizmos": there is **no way to reposition a placed asset in either studio at all** — not by gizmo, not by drag, not by numeric x/y field. The exact gap versus a v1 gizmo: **translate is entirely missing**; rotate exists only as a numeric field (no rotate manipulator); scale exists only as a numeric field (no scale manipulator); vertex editing of feature geometry is also absent (`inspector-scope-output.md:146` — "vertex tweak = gizmo phase"). The library dependency is present, so a v1 translate+rotate gizmo is unblocked technically; the undo surface (`historyPast`/`historyFuture`) and snapping (`snapWorld.ts`) already exist to plug into.

### 2.2 Marquee — CLAIM REFUTED (shipped and reachable; bulk-edit is the real gap)

**Code.** `marqueeSelect.ts` is a pure, unit-tested module: box normalization (`:28-35`), min-area gate `MIN_MARQUEE_AREA_PCT = 0.25` (`:25-26`), Liang-Barsky segment clip (`:51-74`), point-in-polygon + "box inside ring" (`:77-102`), `featureInBox` (`:106-123`), and the Option-A scope — placements + features only (`marqueeSelectRefs`, `:143-153`). Colocated tests `marqueeSelect.test.ts` exist.

**Wiring.** Store: `marqueeActive`/`marqueeDraft` fields (`studioStore.ts:455-460`, initialised `:708-709`), `setMarqueeActive` with mutual exclusion against sketch/asset/measure/trench/zone tools (`:872-884`), `setMarqueeDraft` (`:885`), `marqueeSelectBox` — replace or shift-union via `dedupeSelection` (`:886-895`). Pointer plumbing: tool-gated pointerdown starts the box in board-% (`StudioControls.tsx:314-327`), pointermove updates the draft box (`:360-372`), pointerup finalizes into `marqueeSelectBox` or clears (`:438-463`). Rail tool: `id: "marquee"`, title "Drag a box to select placements and features (shift adds)" (`StudioToolRail.tsx:121-128`). Scene overlay: dashed Signal Blue `MarqueeBoxLayer` (`StudioScene.tsx:285-319`), mounted at `StudioScene.tsx:797`. Plain drag still pans when the tool is disarmed (`StudioControls.tsx:464-471` — click path; pan path `:377-393`), protected by the pan-commit gate (`webgl-pan-zero-commit.spec.ts`).

**Reachability.** A user arms Marquee from the rail, drags a box, and lands in the inspector's many-refs summary: `InspectorCard.tsx:425-443` (`SelectionSummary`: "{n} selected", entity list, "Select one entity to edit its properties"), with the single-vs-many switch at `:451-453`. Selection chip/count testids render at `WebGLStudioPreview.tsx:1776,1796`. Commit `78864ae` is on `main` and in sync with origin (git log/`rev-list` output: 0/0).

**Test.** e2e `webgl-marquee-select.spec.ts:15-16` ("a drag box selects placements, lands in the summary card, and never pans"): seeds two centre placements + one far placement (`:35-68`), arms via `rail-marquee` (`:85`), drags a box (`:94-97`), asserts "2 selected" (`:99-102`) and the summary hint (`:105-107`), Esc clears (`:109-111`), re-drag replace path (`:116-123`), shift-additive dedupe (`:126-134`), no fatal console errors (`:137-143`). Unit coverage: `studioStore.test.ts:497-558` (marquee fields, replace/union, draft clearing).

**Docs claim — two live drifts remain; one was corrected in-session.** `AGENTS.md:113-118` previously said "marquee is deliberately not used: plain drag pans and mod-drag orbits, so a marquee tool would need its own rail tool" — that sentence was **false on main** and was **corrected during this session** (the file now states "A tool-gated marquee rail tool is implemented … Bulk-editing a marquee selection is deferred — the inspector shows a read-only many-refs summary until bulk-edit lands", which matches code exactly). `differentiator-backlog.md:18-21` — marquee listed as parity gap #2 "In build: one drag lands in the inspector's read-only many-refs summary" — **false: it is built and landed**. `inspector-scope.md:15-16` — "No marquee" — stale (predates the build).

**Known open items (verified as open).** (a) **Bulk-edit is not built**: the many-refs summary is read-only by design (`InspectorCard.tsx:452-453`); bulk-apply ships "after the marquee tool" (`inspector-scope-output.md:194-196,215-216`) and is still absent — a marquee selection cannot yet edit, only summarize. (b) **Marquee in cad mode**: the always-open CAD drafter panel covers the board centre, so a centre marquee in cad mode is blocked — documented as a chrome issue, not marquee scope, with the e2e deliberately run in sketch mode (`differentiator-backlog.md:64-68`; `webgl-marquee-select.spec.ts:71-76`; panel mount `WebGLStudioPreview.tsx:973-979`). Verified as still true: `StudioCadCard` is mounted whenever `activeMode === "cad"` (`WebGLStudioPreview.tsx:973-979`). (c) The differentiator-backlog's own verification note that "selection survives mode switches is PARTIALLY verified" (`differentiator-backlog.md:57-60`) is now superseded — the shipped e2e title covers it (`webgl-sketch-to-cad.spec.ts:18`), though a spec asserting same-refs preservation across every mode transition is still future work.

**Verdict (confidence: high).** The claim "no marquee" is refuted: code → wiring → reachability → unit tests → e2e probe all exist and are on main. What the claim was really pointing at — bulk selection feeding downstream editing — remains partially open: selection yes, bulk-edit no. The AGENTS.md sentence is the highest-profile false premise in the repo's agent guidance and should be corrected.

### 2.3 Section/cut — CLAIM PARTIALLY TRUE (slice instrument shipped; cut system is a held differentiator)

**Code.** The rail tool exists: `id: "section"`, label "Section", title "Elevation slice" (`StudioToolRail.tsx:219-225`), gated behind `showTerrainTools` which requires a heightmap (`WebGLStudioPreview.tsx:1761` — `heightmapPoints.length > 0`). Store: `sliceActive`/`sliceAxis: "x" | "z"`/`slicePosM` (`studioStore.ts:219-223`, defaults `:652-654`, setters `:774-776`). Scene: a draggable axis-aligned cutting line on the terrain (`ElevationSliceLine.tsx:49-51,64-84,95-113`, mounted `StudioScene.tsx:731`). DOM: `SliceProfileCard.tsx` — live 80-sample 2D profile from the shared `terrainMath` sampler (`:41-70`), ×3 vertical exaggeration labelled (`:134`), datum, min/max ticks, Δ real-metre readout (`:137-187`), mounted `WebGLStudioPreview.tsx:1614`. Earthworks cut/fill math + render: `cutFill.ts`, `EarthworksLayer.tsx`, `EarthworksCard.tsx` (per OUTSTANDING:829-836, mounted `StudioScene.tsx:749`, `WebGLStudioPreview.tsx:1625`).

**Wiring / reachability.** The slice is draggable in 3D and the profile redraws live; this works. But: (a) **`setSliceAxis` has no callers anywhere in `apps/web/src`** (grep: only the declaration `studioStore.ts:510` and implementation `:775`) — the axis is permanently `"z"` (E↔W cut); a user cannot choose a N↔S or angled cut. (b) **Nothing is persisted**: no slice/cut/section fields exist in `packages/contracts` (grep of `schemas/` finds only unrelated `presentation-document.ts:169` plan-dissection tags and quote-doc sections) — the cut position, axis, and profile vanish on reload. (c) **No section marks on plan, no saved section views on a sheet, no annotation/dimensioning of the cut** — exactly the scope the differentiator backlog names as the gap versus a true cut system (`differentiator-backlog.md:32-36`).

**Test.** No e2e or unit probe touches the slice tool: grep of `apps/web/e2e` for `slice|section|rail-section|SliceProfile` finds nothing WebGL-related (`sheet-presentation.spec.ts:79-89` `fit-elev-section-A` is the classic SVG elevation sheet's callouts). `cutFill.ts`/`flowField.ts` have unit tests; the slice instrument itself is untested at the probe level. **Docs claim.** `differentiator-backlog.md:32-36` scopes the full system ("persistent named cut planes, saved section views on the elevation sheet") as held differentiator #1; ONBOARDING §2/§5 and OUTSTANDING describe the slice as a shipped instrument ("elevation-slice instrument (ElevationSliceLine + SliceProfileCard: draggable axis-aligned cut + live SVG profile", OUTSTANDING:823-824) — consistent with code.

**Verdict (confidence: high).** The claim "no section/cut" is partially true. The repo holds a **working, reachable elevation-slice instrument** (not "absent"), but it is an ephemeral analysis view: single hardcoded axis, unpersisted, no plan marks, no sheet, no annotation — so as *architectural documentation* ("standard section documentation"), the capability is absent. The operator's framing conflict (section/cut claimed as both parity — "standard architectural documentation" — and as differentiator #1) is real; the facts: the instrument is shipped, the system is not, and the backlog holds the system as tier-above scope. This survey states both sides and does not decide the parity-vs-differentiator classification.

---

## 3. WIP register

**Git state (verified).** `main` @ `7030c4c`, in sync with origin (0/0 unpushed/unpulled). Working tree clean except two untracked items: `.zcode/` and the task file itself (`docs/agent-prompts/wip-gap-survey.md`). **There is no uncommitted feature code.** The photo-trace capstone, inspector, and marquee are all committed on main (`0b37127`, `a6f6646`, `78864ae`).

| # | Item | Owner | State (verified) | Next action |
|---|---|---|---|---|
| 1 | Gizmo phase (position editing) | code | Parity gap #4 (`differentiator-backlog.md:27-28`); no code anywhere (`inspectorPolicy.ts:18`; grep clean) | Scope pass; drei already a dep (`apps/web/package.json:15`); snap (`snapWorld.ts`) + undo (`studioStore.ts:896-924`) exist to plug into |
| 2 | Bulk-edit after marquee | code | Not built; marquee lands in read-only summary (`InspectorCard.tsx:425-443,452-453`); documented sequence `inspector-scope-output.md:215-216` | Build per-entity patch application over the many-refs selection |
| 3 | Foliage "murk" polish | code | Ranked #3 (OUTSTANDING:17); `sceneItems.tsx` FOLIAGE + `--gs-ground-bounce` dark-era ramp | Lift foliage to `l-*` ramp, neutralise olive ground bounce |
| 4 | Premium assets | code/product | Ranked #2 (OUTSTANDING:16) | Species depth, thumbnails, curated palettes |
| 5 | Signoff record trace | code | Ranked #4 (OUTSTANDING:18); unverified that signoff freezes the accepted quote | Operator `SignoffCard` vs portal deposit must share one record |
| 6 | Phase 4 Build Pack | code | Not built (OUTSTANDING:20; WIP-AND-GAP-2026-08-17 §3.1) | Compliance audit + contractor CAD/spec bundle export |
| 7 | Presentation Lens polish | code | Polish-only (OUTSTANDING:20; `PresentationLens.tsx:62` gates present/quote/share) | Storytelling-lens pass |
| 8 | Floating tool ribbon (Polyline/Curve) on GL | code | Not built; GL has freehand only (`FusedSketchLayer.tsx:29,142`); WIP-AND-GAP §3.2 | Polyline/curve tools on the GL surface |
| 9 | Stage 2 CAD | code | Product-gated (OUTSTANDING:20; CLAUDE.md "Do not implement Stage 2 fields without a schema brief") | Schema brief first |
| 10 | Mobile offline-first sync | code | Design doc only (`docs/SYNC-LAYER-DESIGN-OFFLINE-FIRST.md`) | Implementation not started |
| 11 | CI live-verify on GitHub | human | Blocked on billing freeze (OUTSTANDING:15; handover:49-76) | Dispatch Actions on main once the card clears |
| 12 | Clerk live keys | human | dev-user fallback active (`apps/api/src/plugins/auth.ts:14,94`) | Set `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` on Railway |
| 13 | Sentry DSNs | human | Scaffold only (`apps/api/src/lib/sentry.ts`, `apps/web/src/instrumentation.ts`) | Set `SENTRY_DSN` on both services |
| 14 | Redis worker env | human | Code path ready: BullMQ when `REDIS_URL` set, else inline (`apps/api/src/lib/queue.ts:2,31,120`; `pipeline-idempotency.ts:15`) | Provision Redis + enable worker |
| 15 | Litestream bucket | human | Config + docs exist (`docs/litestream.example.yml`) | Bucket credentials + sidecar |
| 16 | Branch protection on `main` | human | Requires GitHub Pro (OUTSTANDING:89-90) | Enable in repo settings |
| 17 | Mobile EAS distribution | human | `apps/mobile/eas.json` configured (OUTSTANDING:69-73) | EAS init + Apple/Google credentials |
| 18 | Single API replica (P0) | human | SQLite is single-writer (OUTSTANDING:46-47) | Keep one replica on Railway |
| 19 | `webgl-asset-fanout.spec.ts` positional flake | code | Tracked, not fixed (OUTSTANDING:303-311); reproduces with sketch-to-CAD excluded | Fix save-debounce vs reload race in the spec |
| 20 | Classic-studio e2e debt | code | Tracked, lowest priority (OUTSTANDING:313-326) | `quote-tier1` `?svg=1` routing, council tip, fit-sheet strip |

**Env-gated paths that silently change behaviour (verified).** `CLERK_SECRET_KEY` unset → `dev-user` auth (`apps/api/src/plugins/auth.ts:14,94`; `lib/auth-config.ts:1`); `REDIS_URL` unset → inline pipeline execution (`lib/queue.ts:2,31`, `pipeline-idempotency.ts:15`); vision key absent → heuristic sketch-CAD fallback (`apps/api/src/lib/claude.ts:1014-1144`; `claude-sketch.test.ts:34-62`); `NEXT_PUBLIC_E2E === "1"` gates the quiet Vicmap auto-trace (`WebGLStudioPreview.tsx:354-373`, sessionStorage key `gs-truth-autotrace-${projectId}`); `VICMAP_LIVE=1` gates the live WFS smoke tests; `SUPPLIERS_LIVE` never makes canned rows "live" (`suppliers.ts:112,209,248-256`); `MELBOURNE_TRADE_CATALOG_PATH` overrides the bundled trade cache (`melbourne-trade-catalog.ts:58-113`); `DEV_USER_ID` default `dev-user` (`plugins/store.ts:20`).

**TODO/FIXME/HACK in the WebGL surface.** None found — grep for `TODO|FIXME|HACK|not wired|unimplemented|deferred` in `webgl/` returns only the deliberate "scoped out" stamping comments (e.g. `sketchCad.ts:149-158`) and the lint `_sunMin` default (`StudioScene.tsx:655`). The WebGL surface is clean of wiring markers.

**Shipped-inert candidates.** The reachability gate (`scripts/check-feature-reachability.mjs`) scans **only** `handoff/features` (`:32`) — the WebGL product surface is outside the gate. Manual mount check this session: every major WebGL component is genuinely mounted — `TerrainMesh`/`ElevationSliceLine`/`DrainageFlowLayer`/`EarthworksLayer`/`DimensionLayer`/`MeasureTapeLayer`/`TrenchLayer`/`IrrigationZoneLayer`/`AssetPlaceLayer`/`FloraRingLayer`/`FeatureLayer`/`CadProposalLayer`/`FusedSketchLayer`/`PhotoTracePlane` (`StudioScene.tsx:724-860`), `SplitViewLens`/`InspectorCard`/`SketchCadReviewCard`/`SitePhotoGallery`/`SliceProfileCard`/`DrainageFlowCard`/`EarthworksCard`/`FitSheetCard`/`AssetFanOutDock`/`PhotoElevationSheet`/`StudioCommandPalette`/`PhotoTraceHud`/`PerimeterTabStrip` (`WebGLStudioPreview.tsx:744,777,880,1264,1614-1846,1820,1826`). The one allowlisted unmounted component is `StudioCoachMarks` (`check-feature-reachability.mjs:40-45`), deliberately unwired per OUTSTANDING:475-483. Two static-gate blind spots remain: (a) the gate does not cover `webgl/`, and (b) an import rendered behind a never-true condition is invisible to it (`check-feature-reachability.mjs:20-25`) — the classic "one connection missing" failure mode still needs runtime probes.

---

## 4. Gap analysis (ranked by how each blocks a real end-to-end project)

### Parity (blocks completion)

1. **Spatial editing / gizmos — blocks "edit in 3D".** No way to move, rotate-by-gesture, or scale-by-gesture a placed asset; no vertex editing of features; position fields excluded from the inspector (`inspectorPolicy.ts:18`, `inspector-scope-output.md:140,146`). A 200+ planting design that needs a tree nudged 1.5 m must delete and re-place it. Effort: the pieces (drei `TransformControls`, `snapWorld.ts`, undo store) already exist.
2. **Bulk-edit — blocks "edit 200+ plantings in one gesture".** Marquee selects many refs but editing stops at the read-only summary (`InspectorCard.tsx:452-453`); the documented sequence is "single-select inspector, then marquee, then bulk-edit" (`inspector-scope-output.md:194-196,215-216`) and the last step is missing.
3. **Marquee in cad mode (chrome)** — the always-open `StudioCadCard` covers the board centre (`WebGLStudioPreview.tsx:973-979`; `differentiator-backlog.md:64-68`); a product call (closeable/auto-collapsing panel) unblocks centre marquee in cad mode.
4. **Slice tool hardening** — axis toggle unreachable (`setSliceAxis` dead — `studioStore.ts:510,775`), nothing persisted (no contracts fields), no probe. Blocks "section documentation" only in the weak sense that the instrument exists but cannot be part of a deliverable sheet.

### Differentiators (tier-above, held)

- Section/cut **system** (persistent named cut planes, plan marks, saved section views, annotation/dimensioning) — `differentiator-backlog.md:32-36`.
- Live AI ghost suggestions in-sketch (`differentiator-backlog.md:37-38`).
- Persistent camera bookmarks (`differentiator-backlog.md:39-41`).
- Photo-trace plane-to-ground projection (facade → plan) — **blocked on the product depth-rule decision** (`differentiator-backlog.md:22-26`); the standing title-boundary rule binds it (`AGENTS.md` "Title-boundary reconciliation rule").

### Product-gated scope (not gaps)

- Stage 2 true CAD (survey coordinates, named layer export, dim styles) — schema-gated (CLAUDE.md; OUTSTANDING:20).
- Mobile field bridge AR — explicitly not built by design (OUTSTANDING:870-878).
- Phase 4 Build Pack — ranked as the largest remaining stage gap (WIP-AND-GAP-2026-08-17 §3.1) but documented, not claimed.

### Where this survey contradicts the repo's own gap docs

- **`differentiator-backlog.md:18-21`** (marquee "In build") — false; built and e2e-probed.
- **`inspector-scope.md:15-16`** ("No marquee") — stale (pre-build).
- **`AGENTS.md:112-113`** ("marquee is deliberately not used") — was false; **corrected in-file during this session** (`AGENTS.md:113-118` now matches code).
- **`ONBOARDING.md:93-97`** (photo-trace "uncommitted working-tree code … PR not yet opened") and **`OUTSTANDING.md:22-24`** ("implemented in the working tree, commit/PR pending") — stale; committed on main (`0b37127`) and pushed (0/0 vs origin).
- **`ONBOARDING.md:147-165`** §7 stale-comment register — itself now stale on `stateBridge.ts` (the comment was corrected — see §5).
- **`WIP-AND-GAP-ANALYSIS-2026-08-17.md:49-52`** (photo-trace "working-tree implementation, PR pending") — stale for the same reason.

---

## 5. Docs-vs-code drift register

| # | False premise / stale text | Location | Correction (verified this session) |
|---|---|---|---|
| 1 | "Marquee is deliberately not used" | `AGENTS.md:112-113` (pre-correction) | Shipped on main: rail tool `StudioToolRail.tsx:121-128`, pointer plumbing `StudioControls.tsx:314-327,360-372,438-463`, store `studioStore.ts:886-895`, e2e `webgl-marquee-select.spec.ts`. **Corrected in-file during this session** — `AGENTS.md:113-118` now describes the implemented tool and the deferred bulk-edit accurately |
| 2 | Marquee "In build: one drag lands in the inspector's read-only many-refs summary" | `differentiator-backlog.md:18-21` | Built and landed; summary exists (`InspectorCard.tsx:425-443`); the open item is bulk-edit, not the marquee |
| 3 | "No marquee" | `inspector-scope.md:15-16` | Stale (scoping doc predates `78864ae`) |
| 4 | Photo-trace is "uncommitted working-tree code, PR not yet opened" | `ONBOARDING.md:93-97`; `OUTSTANDING.md:22-24`; `WIP-AND-GAP-ANALYSIS-2026-08-17.md:49-52` | Committed on main `0b37127`; working tree clean (git status) |
| 5 | "SVG-only modes fall back to the classic studio; otherwise `?mode=` silently does nothing" | `apps/web/src/app/projects/[id]/page.tsx:129-134` | All 8 modes are native WebGL (`canvas-mode.ts:102-111`); `?svg=1` is the only classic route (`page.tsx:135-139`) |
| 6 | "Classic-board modes navigate to `?svg=1&mode=…`"; `NativeWebGLMode` = 5 modes | `PerimeterTabStrip.tsx:13-15,30-33` | `webglStudioSupportsMode` returns true for all 8 modes (`canvas-mode.ts:113-114`); `isNativeWebGLMode` delegates to it (`PerimeterTabStrip.tsx:35-37`) |
| 7 | "Context for persistence + the aerial underlay" | `studioStore.ts:18` | Aerial underlay retired (PR #199; handover:33) |
| 8 | "Tuned conservative for the dark Studio aesthetic" | `WebGLStudio.tsx:113-114` | Studio Paper pivot (PR #189); dark-era phrasing |
| 9 | "55 = default oblique" tilt comment | `cameraRig.ts:28` | Matches `DEFAULT_CAMERA_RIG` but the 55° cap era is gone — ONBOARDING §7 itself flags this; still present as listed |
| 10 | "Binding: ARCHITECTURE §5 (state layer unchanged)" | `stateBridge.ts:11` (as listed in ONBOARDING §7) | Already corrected to "(two stores, one persisted canvas)" (`stateBridge.ts:11` now accurate) — ONBOARDING §7's register entry is itself stale (drift-of-drift) |
| 11 | "Selection survives mode switches is PARTIALLY verified" | `differentiator-backlog.md:57-60` | Shipped e2e covers it (`webgl-sketch-to-cad.spec.ts:18`); a same-refs-across-every-mode spec is still future work |
| 12 | Task anchor: hydrate route `apps/api/src/routes/site-boundary.ts` | `docs/agent-prompts/wip-gap-survey.md:103` | No such route file; hydrate is `routes/keyless.ts` (`/:projectId/keyless-hydrate`) + `routes/boundary.ts`; `site-boundary.ts` is the **contracts schema** (`packages/contracts/src/schemas/site-boundary.ts`) |

---

## 6. Best-practice findings

### Per stage

**Stage 1 — title/site truth: strong.** Contract-first (Zod schemas; handover #201 fixed a hydrate-schema drift), keyless by design (GetCapabilities self-discovery, `vicmap.ts:15,412-473`), live smoke tests gated behind an env flag (`vicmap.live.test.ts`, `vicmap.keyless.live.test.ts`), honest honesty-footers (EVC links, `SESSION-HANDOVER-2026-08-18-CONTINUATION.md:34`). The auto-trace bootstrap is session-gated and quiet (`WebGLStudioPreview.tsx:354-373`) — consistent with the no-surprise law.

**Stage 2 — sketch: strong.** Pure draped ink, mutual tool exclusion (`studioStore.ts:748-753,783-788`), ink kept as provenance on both convert paths (`sketchCad.ts:22-25`).

**Stage 3 — CAD parsing: strongest in the repo.** Pure classifier + direct-convert modules with colocated tests (`sketchCad.test.ts`, `claude-sketch.test.ts`), stamped photo-scope notice (`sketchCad.ts:153-159`), accept mints placement + mirrored Polygon feature with shared id (`studioStore.ts:1193-1217`, `sketchCad.ts:176-209`), undoable (history push at `:1206`), e2e end-to-end including reload persistence (`webgl-sketch-to-cad.spec.ts:83-96`).

**Stage 4 — elevation tracing: strong.** Reference-line calibration with honest indicative stamps (`PhotoElevationSheet.tsx:8-12,94-107`), boundary snap recorded as `boundary_snap` (`photoTraceMath.ts:216`) and consumed by HUD/sheet/gallery (`PhotoTraceHud.tsx:126-133`, `SitePhotoGallery.tsx:282-284`), full e2e probe (`webgl-photo-trace-elevation.spec.ts:10`).

**Stage 5 — inspector/selection: strong on single-select, weak on bulk.** Pure pick math + tests (`selectionPick.test.ts`), locked field-classification policy module (`inspectorPolicy.ts` — the "tested code module, not doc claim" rule from `differentiator-backlog.md:50-53`), fingerprint covers every inspector field (`useStudioAutosave.ts:78-150` — the Step 0 prerequisite from `inspector-scope-output.md:10-23` landed in `a0c8a63`), re-clamp path verified by store test (`studioStore.test.ts:389`). Weak: bulk edit absent; marquee unit tests live in the store spec rather than the pure module's own file (minor).

**Stage 6 — 3D render: strong correctness, open scale+polish.** Real sun + VSM shadows, shared terrain sampler (bit-identical drape/slice, `terrainMath.ts:100`), zero-commit camera pan gate (`webgl-pan-zero-commit.spec.ts`), fit-sheet recompute from geometry (`fitSheet.ts`). Open: **foliage is per-placement meshes — a `TreeMesh` builds a trunk + multi-lobe canopy cluster with individual meshes and shadows (`sceneItems.tsx:272-406`, `castShadow` at `:326,342`) — no instancing anywhere (grep for `InstancedMesh` in `webgl/` is empty), so a 200+ planting site means thousands of draw calls**; bundle budget is 8 MB total / 7 MB JS (`scripts/bundle-size-budget.json:2-6`) with the CI gate (`scripts/check-bundle-size.mjs`, OUTSTANDING:198-200); the "murk" ramp is an open polish item.

### Cross-cutting

1. **BP-1 (strongest, protect): the pure-module + colocated-test pattern.** `marqueeSelect`, `selectionPick`, `photoTraceMath`, `cutFill`, `flowField`, `snapWorld`, `trenchPath`, `lightingPath`, `irrigationZonePath`, `cameraRig`, `terrainMath` all exist with tests. This is what makes the parity claims checkable at all.
2. **BP-2 (strongest, protect): reachability-adjacent honesty.** The shipped-inert history is documented with root causes (OUTSTANDING "Shipped inert" §), the reachability gate refuses stale allowlist entries (`check-feature-reachability.mjs:137-160`), and the gate's own limits are stated (`:20-25`).
3. **BP-3 (weakest, fix): the reachability gate does not scan `webgl/`.** `FEATURES = "apps/web/src/components/canvas/handoff/features"` (`check-feature-reachability.mjs:32`); the product surface is exempt. A shipped-inert WebGL component would pass CI exactly as the original six did.
4. **BP-4 (weakest, fix): title-boundary reconciliation is not universal.** Enforced on: photo planes (`snapPhotoPlaneToBoundary`), CAD proposals (`sketchCad.ts:95-101`), inspector geometry edits (`studioStore.ts:816-828`). **Not enforced, and no indicative stamp:** direct asset placement (`AssetPlaceLayer.tsx:46-76` clamps to board-% `[0,100]` only, no lot-polygon check), flora-ring accept (`FloraRingLayer.tsx:148-160` guards TPZ/canopy conflicts but not the boundary), trench traces (`TrenchLayer.tsx:168-192`), irrigation zones (`IrrigationZoneLayer.tsx:169-199`), extruded pads. Per the standing rule (AGENTS.md "Title-boundary reconciliation rule"), placing outside the lot or across the building without snap-or-stamp is a defect finding. The repo itself records the same gap for the future gizmo (`inspector-scope-output.md:140`: "when gizmos land, position edits clamp") and the known extent-overflow limitation (`inspector-scope-output.md:148-152`).
5. **BP-5 (weakest, fix): persistence integrity is good on the WebGL hot path.** Autosave fingerprint + debounce + backoff + `stale_client` short-circuit (`useStudioAutosave.ts:157-160,269-308`), full-canvas PUT through `saveDesignCanvasClient`, design-VCS tip revision + three-way merge with surfaced conflicts (`packages/db/src/memory.ts:1697-1730`, `packages/domain/src/design-canvas-merge.ts:137-230`, tested `design-canvas-diff.test.ts:55-145`). No off-journal mutation path found in the WebGL surface this session.
6. **BP-6: test probes map cleanly to stages** — title (live-gated + default-mount smoke), sketch (photo-sketch-flow), CAD (sketch-to-cad), elevation (photo-trace-elevation), inspector/marquee (marquee-select, sketch-to-cad), render/BOM (fit-sheet, split-view, terrain-instruments, cad-annotations, flora-ring, asset-fanout, pan-zero-commit, chrome-collision, contrast-aa). **No probe for the slice/section tool** (this survey). Known flakes: `webgl-asset-fanout` (OUTSTANDING:303-311); classic-studio debt incl. `quote-tier1` `?svg=1` routing (OUTSTANDING:313-326).
7. **BP-7: accessibility.** AA contrast gate exists and is kept green (`e2e/canvas-contrast-aa.spec.ts`, `webgl-contrast-aa.spec.ts`; OUTSTANDING:243-253). No regressions assessed this session (did not run the suite).
8. **BP-8: honesty / placeholders.** All OUTSTANDING "production placeholders" verified still present and still honestly labelled: supplier prices (`suppliers.ts:61-97,186-188`), Melbourne trade catalog (`melbourne-trade-catalog.ts:15,58-113`), carbon stubs (`carbon.ts:42-48`), polygon-difference stub (`geometry.ts:160-165`), utility stub (`preemptive-risk.ts:145`). Each hits the pipeline exactly where the doc says: quotes via suppliers/catalog, quote footer discloses the carbon stub (`output-generators.ts:269`), survey-job works around the polygon stub by using the title ring with house-as-inner-ring (OUTSTANDING:629-635).

---

## 7. Recommendations (ranked; no code changed this session)

1. **Ship a v1 translate gizmo (S, high value, unblocks "edit in 3D").** Effort S–M; low technical risk — drei `TransformControls` is a dependency (`apps/web/package.json:15`), snapping exists (`snapWorld.ts`), undo exists (`studioStore.ts:896-924`). Land in `StudioControls.tsx`/`StudioScene.tsx` (scene-side) + `studioStore.ts` (a `movePlacement`/`moveFeature` action that clamps via `constrainAssetCentre` per the rule — `inspector-scope-output.md:140` already commits to clamping position edits). Add a `move` e2e probe; extend the reachability gate to `webgl/` in the same change.
2. **Bulk-edit after marquee (S–M, completes the selection story).** Apply the single-select inspector's field patch over a many-refs selection; the read-only summary (`InspectorCard.tsx:425-443`) is the natural scaffold. Keep the clamp policy per-entity.
3. **Close the boundary-reconciliation gaps (M, rule compliance).** Decide and implement snap-or-stamp for direct placement (`AssetPlaceLayer.tsx:46-76`), flora accept (`FloraRingLayer.tsx:148-160`), trench/zone traces, and pads — or explicitly stamp locational-indicative. This is the standing rule; silent non-reconciliation is a defect per AGENTS.md.
4. **Extend `check-feature-reachability.mjs` to `webgl/` (S, cheap insurance).** Add the folder to the scan; handle the deliberate exceptions (e.g. layer components mounted by a switch) with the existing ALLOW ratchet.
5. **Fix or scope the slice tool (S).** Either wire `setSliceAxis` to a UI control, persist `sliceActive`/`slicePosM` in the canvas doc (contracts change), add a probe, and treat the instrument as a parity item; or keep it ephemeral-analysis-only and say so in the backlog. Currently it is a shipped tool with a dead axis action and no test.
6. **Section/cut system scoping pass (M, differentiator).** Per `differentiator-backlog.md:47` ("Each item gets its own scoping pass in a fresh context before build"): decide the parity-vs-differentiator classification, then scope persistent named cut planes + plan marks + saved sheet views.
7. **Instancing for foliage (L, the 200+ bar).** Convert `TreeMesh`/`HedgeMesh` lobe geometry to instanced meshes or merged geometry with material-per-instance attributes; keep the seasonal lerp (`sceneItems.tsx:232-237`). Watch the 8 MB bundle budget (`bundle-size-budget.json:2-6`).
8. **Human ops queue (unblocking).** CI live-verify, Clerk keys, Sentry DSNs, Redis worker, Litestream bucket, branch protection, EAS credentials, single API replica — all tracked in OUTSTANDING:888-899; none are code.
9. **Doc corrections (S).** Fix the remaining false premises in §5 (`differentiator-backlog.md:18-21` "In build", `inspector-scope.md:15-16` "No marquee", ONBOARDING §3 status-honesty + §7 register entries) — the AGENTS.md marquee sentence was already corrected in-file during this session (`AGENTS.md:113-118`).

---

## 8. Evidence index

### Gizmos (claim 2.1)
- `apps/web/src/components/canvas/webgl/inspectorPolicy.ts:18` — position is "the gizmo phase" (only gizmo mention in `apps/web/src`)
- `apps/web/package.json:15` — `@react-three/drei` ^10.7.8 present
- `apps/web/src/components/canvas/webgl/studioStore.ts:806-836` — `updatePlacementField` never patches `x_pct`/`y_pct`
- `apps/web/src/components/canvas/webgl/studioStore.test.ts:367-368` — "x_pct … untouched — locked classification"
- `apps/web/src/components/canvas/webgl/InspectorCard.tsx:191-277` — numeric scale/rotation/height/canopy fields; `:208-229` rotation numeric spin
- `apps/web/src/components/canvas/webgl/cameraRig.ts:26-29` — `rotateDeg` = plan camera rotation, `tiltDeg` = camera pitch (not object rotation)
- `apps/web/src/components/canvas/webgl/StudioControls.tsx:303-327,360-372,438-473` — drags are camera/marquee only
- `apps/web/src/components/canvas/webgl/AssetPlaceLayer.tsx:46-76` — placement is create-only, no move
- `apps/web/src/components/canvas/handoff/features/cadPlan/CadPlanBoard.tsx:2185,2217` — SVG `startCornerDrag` edits boundary/building corners, not placements
- `apps/web/src/components/canvas/webgl/studioStore.ts:896-924` — undo/redo history (exists for a future gizmo)
- `docs/agent-prompts/differentiator-backlog.md:27-28`, `docs/agent-prompts/inspector-scope.md:13-14`, `docs/agent-prompts/inspector-scope-output.md:140,146,204-207` — docs claims

### Marquee (claim 2.2)
- `apps/web/src/components/canvas/webgl/marqueeSelect.ts:18-153` — pure hit tests; `:25-26` min area; `:51-74` Liang-Barsky; `:143-153` Option A scope
- `apps/web/src/components/canvas/webgl/marqueeSelect.test.ts` — unit tests
- `apps/web/src/components/canvas/webgl/StudioControls.tsx:314-327,360-372,438-463` — tool-gated pointer plumbing
- `apps/web/src/components/canvas/webgl/studioStore.ts:455-462,708-709,872-895` — `marqueeActive`/`marqueeDraft`/`marqueeSelectBox`
- `apps/web/src/components/canvas/webgl/studioStore.test.ts:497-558` — store tests
- `apps/web/src/components/canvas/webgl/StudioToolRail.tsx:121-128` — rail tool `"marquee"`
- `apps/web/src/components/canvas/webgl/StudioScene.tsx:285-319,797` — dashed box overlay + mount
- `apps/web/src/components/canvas/webgl/InspectorCard.tsx:425-453` — many-refs read-only summary; single-vs-many switch
- `apps/web/src/components/canvas/webgl/WebGLStudioPreview.tsx:1776,1796` — `selection-chip`/`selection-count` testids
- `apps/web/e2e/webgl-marquee-select.spec.ts:15-16,85-143` — e2e probe
- `AGENTS.md:112-113`, `docs/agent-prompts/differentiator-backlog.md:18-21,64-68`, `docs/agent-prompts/inspector-scope.md:15-16` — docs drift
- `apps/web/src/components/canvas/webgl/WebGLStudioPreview.tsx:973-979` — cad-mode drafter panel mount (marquee-in-cad blocker)
- git: `78864ae` marquee commit on main; `55461b3`/`55463cf` e2e commits

### Section/cut (claim 2.3)
- `apps/web/src/components/canvas/webgl/StudioToolRail.tsx:219-225` — `"section"` rail tool
- `apps/web/src/components/canvas/webgl/WebGLStudioPreview.tsx:1761` — `showTerrainTools` gating
- `apps/web/src/components/canvas/webgl/studioStore.ts:219-223,652-654,774-776` — slice state; `:510,775` — `setSliceAxis` dead (no callers)
- `apps/web/src/components/canvas/webgl/ElevationSliceLine.tsx:49-51,64-84,95-113` — draggable cut line
- `apps/web/src/components/canvas/webgl/SliceProfileCard.tsx:41-70,103,134,137-187` — live profile, ×3 vert, Δ readout
- `apps/web/src/components/canvas/webgl/StudioScene.tsx:731` — slice mount; `:749` EarthworksLayer
- `apps/web/src/components/canvas/webgl/cutFill.ts`, `EarthworksLayer.tsx`, `EarthworksCard.tsx` — cut/fill math (OUTSTANDING:829-836)
- `packages/contracts/src/schemas/` — no slice/cut fields (grep)
- `apps/web/e2e/` — no slice probe (grep; `sheet-presentation.spec.ts:79-89` is classic-studio callouts)
- `docs/agent-prompts/differentiator-backlog.md:32-36` — full-cut-system scope gap

### Pipeline stages
- Title: `apps/api/src/lib/vicmap.ts:15,412-473`; `apps/api/src/routes/keyless.ts:10`; `apps/api/src/lib/keyless-job.ts:22-29`; `apps/api/src/routes/boundary.ts:20-70`; `apps/web/src/components/canvas/webgl/siteTruthImport.ts`; `DimensionLayer.tsx:98,125`; `vicmap.live.test.ts:28`; `vicmap.keyless.live.test.ts:25`
- Sketch: `FusedSketchLayer.tsx:29,121,142`; `studioStore.ts:214,748-753`; `StudioScene.tsx:851`; `useStudioAutosave.ts:225`
- CAD parsing: `apps/api/src/routes/design-sketch-cad.ts:11-13,22,43`; `apps/api/src/lib/claude.ts:41-42,601,979,1014-1144`; `apps/api/src/lib/claude-sketch.test.ts:34-62`; `apps/web/src/components/canvas/webgl/sketchCad.ts:78-122,129-145,153-159,176-209`; `studioStore.ts:1165-1284`; `WebGLStudioPreview.tsx:880,1769`; `StudioToolRail.tsx:129-144`; `StudioCommandPalette.tsx:108`; `SketchCadReviewCard.tsx:55-57`; `studioStore.test.ts:202-261`; `apps/web/e2e/webgl-sketch-to-cad.spec.ts:17-18,83-96`
- Elevation: `photoTraceMath.ts:79,216`; `PhotoTraceHud.tsx:112-133`; `PhotoElevationSheet.tsx:8-12,86-107,134-144,177-204`; `SitePhotoGallery.tsx:143-169,282-284`; `FusedCamera.tsx:144`; `studioStore.ts:991-1007`; `useStudioAutosave.ts:228`; `apps/api/src/routes/site-photos.ts` (+test); `apps/web/e2e/webgl-photo-trace-elevation.spec.ts:10`
- Inspector/selection: `selectionPick.ts:19-24,46-50,150-156,163-183`; `WebGLStudioPreview.tsx:1820,417-430` (via `inspector-scope-output.md:40-47`); `InspectorCard.tsx:152-465`; `inspectorPolicy.ts:19-48,61-82`; `studioStore.ts:806-836,1193-1257`
- Render/BOM: `FusedCamera.tsx`, `cameraAnimation.ts`, `cameraRig.ts:36-40`; `sunLight.ts`; `TerrainMesh.tsx:81`; `StudioScene.tsx:705,724`; `sceneItems.tsx:272-406` (per-placement meshes, no instancing); `SplitViewLens.tsx:67`, mounted `WebGLStudioPreview.tsx:744`; `FitSheetCard.tsx:100-121`, mounted `WebGLStudioPreview.tsx:1635`; `fitSheet.ts`; `scripts/bundle-size-budget.json:2-6`
- Persistence/VCS: `useStudioAutosave.ts:78-150,157-160,213-248,269-308,320-337`; `apps/api/src/routes/design-canvas.ts:44-65`; `packages/db/src/memory.ts:1534-1647,1697-1765`; `packages/domain/src/design-canvas-merge.ts:137-230`; `packages/domain/src/design-canvas-diff.test.ts:55-145`

### WIP / env gates / placeholders
- git: clean tree, `main` @ `7030c4c`, 0/0 vs origin; photo-trace/marquee/inspector commits `0b37127`/`78864ae`/`a6f6646`
- `apps/api/src/plugins/auth.ts:14,94`; `apps/api/src/lib/queue.ts:2,31,120`; `apps/api/src/lib/pipeline-idempotency.ts:15`; `apps/web/src/components/canvas/webgl/WebGLStudioPreview.tsx:354-373`
- `apps/api/src/lib/suppliers.ts:45-46,61-97,180-188,209,248-256`; `apps/api/src/lib/melbourne-trade-catalog.ts:15,58-113`; `packages/domain/src/carbon.ts:42-48`; `packages/domain/src/geometry.ts:160-165`; `packages/domain/src/preemptive-risk.ts:145`; `apps/api/src/lib/output-generators.ts:269`
- `scripts/check-feature-reachability.mjs:32,40-45` (gate scope + `StudioCoachMarks` allowlist); `OUTSTANDING.md:303-311,313-326,475-483,888-904`

### Drift register (§5)
- `AGENTS.md:113-118` (marquee — corrected in-file this session; previously `:112-113` false); `docs/agent-prompts/differentiator-backlog.md:18-21,57-60`; `docs/agent-prompts/inspector-scope.md:15-16`; `ONBOARDING.md:93-97,147-165`; `OUTSTANDING.md:22-24`; `WIP-AND-GAP-ANALYSIS-2026-08-17.md:49-52`; `apps/web/src/app/projects/[id]/page.tsx:129-139`; `apps/web/src/components/canvas/webgl/PerimeterTabStrip.tsx:13-15,30-37`; `apps/web/src/lib/canvas-mode.ts:102-114`; `studioStore.ts:18`; `WebGLStudio.tsx:113-114`; `cameraRig.ts:28`; `stateBridge.ts:11`; `docs/agent-prompts/wip-gap-survey.md:103` vs `packages/contracts/src/schemas/site-boundary.ts`

### Unverified this session (honesty)
- Greenness of local gates (typecheck/lint/vitest) and e2e runs — reported green at handoff (`SESSION-HANDOVER-2026-08-18-CONTINUATION.md:17-20`) but not re-run (no gates executed this session per mission constraints).
- Production `/readyz` health and the live auto-trace/placement behaviour — reported live-healthy at handoff (handover:16) and live-verified (handover:37-45); not re-probed.
- Whether GitHub Actions CI passes once the billing freeze clears (human-owned; handover:49-76).
- Slice-profile visual correctness at high tilt (no probe; instrument untested at e2e level).
