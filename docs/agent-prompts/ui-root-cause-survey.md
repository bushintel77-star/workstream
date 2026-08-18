# UI root cause & dependency survey — rendering and layout pipeline

Read-only survey (no component code modified). Method: read/grep/glob with
`file:line` evidence; three evidence buckets: **verified** (read in code),
**docs claim** (doc only), **unverified** (needs a runtime probe). Date
2026-08-18, `main` @ `7030c4c` + in-session working-tree edits (delete
primitive + doc drift fixes, unrelated to this survey).

## 0. Scope corrections — premises that were wrong before the audit

1. **There is no `apps/web/src/components/layout/`.** Verified: the directory
   does not exist. The app shell is `components/AppNav.tsx`,
   `ProjectBreadcrumb.tsx`, `ToastHost.tsx` + the canvas chrome
   (`WebGLStudioPreview.tsx`, `PerimeterTabStrip.tsx`, `StudioToolRail.tsx`,
   `CameraChrome.tsx`, `GlassCard.tsx`). Any "layout shell" work must target
   the canvas chrome, not a nonexistent folder.
2. **The WebGL surface imports no CSS modules.** Verified: zero
   `*.module.css` imports and zero `.module.css` files under
   `components/canvas/webgl/`. All WebGL chrome styling is inline
   `style={{}}` + shared tokens (`styles/globals.css`, `app.module.css`).
   "Audit StudioToolRail CSS rules" therefore means inline style objects.
3. **There are two top bands.** The WebGL product surface has the
   `PerimeterTabStrip` glass strip (modes | meta tabs | trailing status
   cell); the SVG `?svg=1` fallback has the `Tier1TopBar` (three zones).
   "Saved" is a status chip, not a tab, in both.

---

## 1. Layout shell architecture

### 1.1 Why Quote and Survey render as centered absolute overlays over the canvas

**Root cause: the entire top band is one absolutely-positioned,
horizontally-centered column.** The chip strip AND its drop-down panel live
in a single container at `WebGLStudioPreview.tsx:790-804`:

- `position: absolute; top: 12; left: 50%; transform: translateX(-50%)`
  (`:792-795`), `display: flex; flexDirection: column; alignItems: center;
  gap: 6` (`:796-799`), `zIndex: 6` (`:801`), `pointerEvents: none` with
  children opting in (`:800`).

The panel that drops beneath the chips is `:1728-1781` (and the bare variant
`:1712-1726`): `data-testid="perimeter-panel"`, `role="dialog"`,
`aria-label="Canvas surface panel"`, `position: relative` (in flow under the
strip), `width: min(340px, calc(100vw - 32px))`,
`maxHeight: min(420px, calc(100dvh - 240px))`, `overflowY: auto`, paper
frost (`--gs-panel-grad`, `--gs-shadow-2`), close button (`:1752-1777`).

- **Survey** body: "Import site truth (Vicmap)" button + `SurveyChecklist`
  (imported from the classic feature folder,
  `WebGLStudioPreview.tsx:90,917-980`; `onClose` returns to sketch mode
  `:977`). The checklist's own CSS declares no positioning ("Position owned
  by RightDataLane", `surveyChecklist.module.css:1-11`) — it fills the
  panel. The "2/5" survey-progress pill is SVG-studio only
  (`HandoffDesignStudio.tsx:3702-3733`); the WebGL strip has no survey
  progress surface. `app/projects/[id]/survey/page.tsx:3-9` is a pure
  legacy redirect to `?mode=survey`.
- **Quote** body: the fit-sheet (empty state "Add accepted planting…" +
  "Open CAD drafter" `:1690-1706`; live itemized sheet `FitSheetCard`,
  `GlassCard position={{position:"relative"}} width 272`,
  `FitSheetCard.tsx:166-169`, in the **bare** panel variant `:1660-1726`).
  `QuoteBuilder`/`QuoteLineRow`/`QuoteTotalsBar`/`LiveCostRail` are
  SVG-studio only (`HandoffDesignStudio.tsx:6357-6381`); `QuotePortal` is
  the public `/portal/quote/[token]` page, not canvas chrome.
- The mode-body IIFE (`:912-981`) builds `body` per `activeMode`; the panel
  wrapper is shared by every mode (survey, cad drafter, elevation, garden,
  quote) — one seam for all of them.
- **Bonus finding — broken containing block:** `StudioElevationCard`
  hard-centres itself (`top: 50%; left: 50%; translate(-50%, -50%)`,
  `StudioElevationCard.tsx:60-67`) but its containing block is the
  `position: relative` perimeter panel, not the canvas — the centring is
  relative to a 340px panel, i.e. the card's own box miscentres. This is a
  latent layout defect the dock refactor must fix while moving it.

**Why centered, not docked:** the strip is deliberately the single chrome
anchor ("One browser-tab-family chip strip hugs the top edge",
`PerimeterTabStrip.tsx:3-12`); there is no right-dock slot in the WebGL
surface — the only right-side element is the trailing status cell inside the
same strip (`PerimeterTabStrip.tsx:250-262`, `marginLeft: auto`). The left
edge holds the tool rail (`StudioToolRail.tsx:266-284`, `left: 8, top: 152`,
`zIndex: 5`). So the top-centre column is the ONLY panel surface, and every
mode surface hangs from it.

**Shell fact:** the operator shell is `ProjectChrome` (`ProjectChrome.tsx:
19-21`, breadcrumb + status row, `project-layout.module.css:5-17`), and the
WebGL page mounts as a **fixed full-viewport `<main>` that covers even the
breadcrumb** (`app/projects/[id]/page.tsx:155`, `position: "fixed"; inset:
0`) — the canvas chrome is full-bleed by law (`globals.css:249-267`). The
fit-sheet open state is set from four places: the Fit meta tab
(`:842-847`), the rail Quote tool (`StudioToolRail.tsx:251-263`), the
`?mode=quote` deep-link (`WebGLStudioPreview.tsx:255-256`), and the Quote
tab (`:288-289`) — all on one `fitSheetOpen` store flag
(`WebGLStudioPreview.tsx:215`).

**Supporting primitives:** `GlassCard.tsx:34-40` positionMap includes
`center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }`
— unused by WebGL cards (all four GlassCard call sites are
`position="top-right"`, `InspectorCard.tsx:159,290,413,431`), but the
pattern exists and the classic studio's `CameraChrome` defaults to the same
centered transform (`handoff/CameraChrome.tsx:145`), so "centered overlay"
is the house default for any panel without an explicit dock.

**Structural dependencies (what a right-dock refactor must touch):**
`WebGLStudioPreview.tsx:790-804` (container) + `:1712-1781` (shared panel
render) + `PerimeterTabStrip.tsx` (strip itself) + the mode-body IIFE
(`:912-981`) + `GlassCard.tsx` position contract + z-index scale (strip 6,
rail 5, share 6, photo sheet 7, present deck 8 — `WebGLStudioPreview.tsx:
801,278,1897,1863,1930`) + the chrome-coverage ratchet
(`e2e/canvas-checklist-s6.spec.ts` COVERAGE_BASELINE: survey 4.1% / sketch
4.4% / cad 2.3% / elevation 0.1% per OUTSTANDING) + `webgl-chrome-collision`
gate.

### 1.2 StudioToolRail button layout — why long labels break/spill inside pills

**The CSS contract (all inline, `StudioToolRail.tsx:266-341`):**
- nav: `position: absolute; left: 8; top: 152; display: flex;
  flexDirection: column; gap: 2; zIndex: 5; maxHeight: calc(100dvh - 170px);
  overflowY: auto` (`:270-284`).
- button: `width: 42` (fixed), `display: flex; flexDirection: column;
  alignItems: center; gap: 1; padding: "5px 0 4px"` (`:298-316`).
- glyph span: `fontSize: 13; lineHeight: 1` (`:324-326`).
- label span: `fontFamily: var(--font-ui); fontSize: 10.5;
  letterSpacing: 0.04em; lineHeight: 1` (`:327-337`) — **no `white-space`,
  no `overflow`, no `overflow-wrap`, no `text-overflow`, no `min-width`,
  no `maxWidth`**.

**No ambient word-break exists:** `globals.css` has no
`overflow-wrap`/`word-break` anywhere (verified by grep across
`styles/*.css` — only two `white-space: nowrap` hits, both in
`app.module.css` `.pill` classes `:73,226`, not used by the rail). The only
`button` base rule is font inheritance (`globals.css:333-337`).

**Mechanism — settled statically: overflow, not wrap.** CSS wraps only at
soft-wrap opportunities (spaces/hyphens); every rail label is a single
unbroken word and no `overflow-wrap`/`word-break` exists in the cascade
(verified across `styles/*.css`), so the label **cannot wrap**. It renders
at intrinsic width (~65 px for "Underground" at 10.5 px Inter + 0.04 em),
centred over the 42 px pill, and the overhang is **clipped by the nav's
scroll container** (`overflowY: auto` on `StudioToolRail.tsx:281-283`
makes `overflowX` compute to `auto`, clipping horizontally). The observed
"break across lines" is the clipped text visually cutting at the pill edge.
Affected labels: Underground (11 chars, ≈65 px — clearly over), Lighting
(8, ≈43 px), Measure (7, ≈43.4), Marquee (7, ≈44) — borderline; the
practical threshold is ≥ 8 chars. No e2e spec asserts rail label geometry
(the collision spec measures only the nav rect,
`webgl-chrome-collision.spec.ts:36`).

**The tokens are dead.** `--studio-toolrail-w: 38px`,
`--studio-toolrail-expanded-w: 152px`, and
`--studio-rightrail-open-w: 248px` (`globals.css:190-192`) have **zero
consumers repo-wide** — the expanded rail and right-rail width are
pre-scaffolded but unused. Both the nowrap+ellipsis contract (the tab
strip's `chipBase` sets `whiteSpace: "nowrap"`, `PerimeterTabStrip.tsx:63`)
and the expanded-rail state are waiting on the rail refactor.

**Touch caveat:** `[data-webgl-chrome] button` gets `min-height: 44px;
min-width: 44px` on coarse pointers (`globals.css:291-297`) — the rail is
inside `data-webgl-chrome` (`WebGLStudioPreview.tsx:778-781,1788`), so on
touch the 42 px buttons stretch to 44 px; the overflow analysis is
unchanged but the pill is wider there.

### 1.3 Architectural requirements for a unified right-hand docking shell

**Floating-card inventory (verified):**

| Card/surface | Mount | Positioning | Width | Mode gate |
|---|---|---|---|---|
| Perimeter panels — Survey, CAD drafter, Elevation, Garden, Quote/Fit, Sketch chip, Terrain meta (Slice/Drainage/Earthworks stacked) | shared panel render `WebGLStudioPreview.tsx:1712-1781` (+ bare `:1660-1726`) | in-flow under the chip strip inside the top-centre container (`:790-804`, `left: 50%; translateX(-50%)`, zIndex 6) | `min(340px, 100vw-32px)`, maxH `min(420px, 100dvh-240px)` | per mode/meta tab |
| FitSheetCard (quote) | bare panel body `:1660-1673` | `GlassCard position={{position:"relative"}}` (`FitSheetCard.tsx:166-169`) | 272 | `fitSheetOpen && items>0 && !splitView` |
| StudioCadCard | cad mode body `:1001-1007` | `GlassCard position={{position:"relative"}}` (`StudioCadCard.tsx:89`) in-flow; the PANEL is centred → at 1280×720 the 340px panel spans x≈470-810 / y≈46-466, through the board centre (the marquee-in-cad blocker) | 300 | `activeMode==="cad"` (always open) |
| StudioElevationCard | elevation mode body `:983` | **broken containing block**: hard-centres itself (`top:50%; left:50%; translate(-50%,-50%)`, `StudioElevationCard.tsx:60-67`) against the 340px panel, not the canvas | `min(860px, 92vw)` | `activeMode==="elevation"` |
| InspectorCard (placement/feature/photo-stroke) | `GlassCard position="top-right"` `InspectorCard.tsx:159,290,413,431` | absolute top-right | 260 | selection-driven (zero-chrome: unmounted when empty) |
| SketchCadReviewCard | own glass div `:895-910` | **in-flow below the strip** (not absolute) | `min(300px, calc(100vw-32px))` | `cadReviewOpen && proposals>0` |
| SurveyChecklist | mode body `:960` | `.root { width:100% }`, no positioning ("Position owned by RightDataLane", `surveyChecklist.module.css:1-11`) — fills the panel | panel width | `activeMode==="survey"` |
| AssetFanOutDock | `:1851` | absolute `bottom:12, left: calc(50% - 85px), translateX(-50%)` (`AssetFanOutDock.tsx:201-207`); armed → pill `:169-194` | `maxWidth min(64rem, calc(100vw-460px))` | `assetsOpen` |
| PhotoTraceHud | `:1854` | absolute `left:50%, bottom:18, translateX(-50%)`, zIndex 5 (`PhotoTraceHud.tsx:77-92`) | `maxWidth min(560px, calc(100%-48px))` | photo trace session |
| PhotoElevationSheet | `:1857-1871` (inset:0, zIndex 7 wrapper) | GlassCard centred (`PhotoElevationSheet.tsx:64-66`); empty → top-centre `:40-42` | `min(880px, 94vw)` | photoSheetId |
| SitePhotoGallery | `:1292` (Studio tab body) | in-flow | — | metaTab==="studio" |
| Studio command palette | `:1874` | absolute `top:110, left:50%, translateX(-50%)`, zIndex 20 (`StudioCommandPalette.tsx:250-256`) | `min(460px, 92vw)` | Cmd/Ctrl+K |
| Selection chip | `:1802-1845` | absolute `left:60, bottom:12` | content | selection non-empty |
| ShareSurface | `:1888-1918` | inset:0 flex-centre scrim, zIndex 6 | wrapper `min(460px, 92vw)` | `activeMode==="share"` |
| PresentSurface | `:1924-1942` | inset:0, zIndex 8, full-bleed | — | `presentationMode` |
| FirstRunHint | `:1961-2003` | absolute `bottom:160, left:50%, translateX(-50%)`, zIndex 5 | content | sessionStorage flag |
| VignetteOverlay | `:783` | inset:0, zIndex 1 (`VignetteOverlay.tsx:57-60`) | — | always |
| SplitViewLens | `:772` | two 50% canvases + label chips, divider zIndex 10 (`SplitViewLens.tsx:40-46,70-118,115`) | 50% each | `splitView` |
| PresentationLens | — | **not a card**: scene-graph visibility filter (`PresentationLens.tsx:9-23,39-54`) | — | present/quote/share |
| MeasureReadoutChip / SaveStatusChip | strip trailing `:885` (+ save in Studio panel `:1174`) | in-flow | content | measure armed / always |

**SVG precedent worth copying:** the classic studio's right-edge `RightDataLane`
is a real dock (`rightDataLane.module.css:1-16`, `--ws-z-lane: 52`, mobile
bottom-sheet variant `:39-51`) hosting `LiveCostRail`/`QuoteBuilder`/
`QuoteLineRow`/`QuoteTotalsBar` (`HandoffDesignStudio.tsx:6357-6381`) and the
SVG `SurveyChecklist` (`:5002-5016`) — the exact surfaces this survey wants
right-docked in WebGL already live in an SVG right lane.

**Requirements a right-dock refactor must satisfy (structural dependencies):**

1. **One seam, one primitive.** All mode/meta surfaces already funnel through
   the shared `perimeter-panel` render (`:1712-1781`); a right dock moves the
   container (`:790-804`) to a right-edge zone and reparents the panel
   primitive. `data-testid="perimeter-panel"`, `role="dialog"`, the close
   button, and `wsPanelIn` animation survive the move (e2e selectors depend
   on them).
2. **The chip strip stays top-centre.** Only the drop-down panel docks
   right; the strip itself (modes | meta | trailing status) is unchanged —
   the trailing status cell (`marginLeft: auto`) is part of the strip, not
   the dock.
3. **Card position contract.** `GlassCard positionMap` (`GlassCard.tsx:
   34-40`) gains the dock placement (or the dock passes explicit
   `CSSProperties`); InspectorCard keeps top-right or joins the dock (product
   call — two right-side surfaces could stack).
4. **z-index budget (full WebGL tier inventory).** Raw inline zIndex tiers:
   1 vignette (`VignetteOverlay.tsx:60`) · 5 rail/hud/hint
   (`StudioToolRail.tsx:278`, `PhotoTraceHud.tsx`, `FirstRunHint`) · 6 strip
   column + share (`WebGLStudioPreview.tsx:801,1897`) · 7 photo sheet
   (`:1863`) · 8 present (`:1930`) · 10 split divider (`SplitViewLens.tsx:
   115`) · 20 palette (`StudioCommandPalette.tsx:256`). **GlassCard sets NO
   zIndex** (the "GlassCards zIndex 2+" comment at `VignetteOverlay.tsx:60`
   is stale) — cards live by mount order inside the overlay. The `--ws-z-*`
   scale (`handoffStudio.module.css:128-142`) and `--gs-z-*` scale
   (`goldStandardStudio.module.css:43-47`) exist but are SVG-only. The dock
   must not disturb the 6-above-5 strip/rail ordering or the palette-above-
   everything rule.
5. **Zero-chrome law + the two gate mechanisms (scope-corrected).** The s6
   coverage ratchet (`canvas-checklist-s6.spec.ts:142-156`, survey 0.6 /
   sketch 4.4 / cad 2.3 / elevation 0.1) audits the **`?svg=1` board only**
   (`:321`); the WebGL surface is gated by the **pairwise chrome-collision
   spec** — a 248 px dock must pass all three viewports it walks
   (`webgl-chrome-collision.spec.ts:190-194`: 2560×1080, 1280×720, 960×640).
   Note the collision spec clicks tools by accessible name `^▸ ${tool}$`
   (`:206-210`) and measures only the nav rect (`:36`) — it cannot see an
   overflowing rail label; a rail-geometry probe is net-new. If a WebGL
   coverage ratchet is wanted, model it on `chromeCoveragePct`
   (`canvas-checklist-s6.spec.ts:176-258`); it is net-new (see change
   order).
6. **Viewport rules.** `maxHeight: calc(100dvh - 170px)` rail pattern and
   `min(420px, 100dvh-240px)` panel pattern; 44 px touch targets on coarse
   pointers (`globals.css:291-307`).
7. **Mode/meta interplay.** The fit-sheet is BOTH a quote mode body and the
   Fit meta tab (same `fitSheetOpen` flag, `:841-847` vs `:1660`); the dock
   must not double-mount it. The marquee-in-cad blocker (panel over board
   centre, `WebGLStudioPreview.tsx:1001-1007`) is resolved as a side effect
   of docking the cad panel right — record it as a product win, not a
   regression.
8. **No portal dependency.** The WebGL surface never uses `CameraChrome`
   (verified: comment-only reference, `DimensionLayer.tsx:14`); the dock is
   plain DOM overlay positioning — simpler than the classic studio's portal
   host polling (`handoff/CameraChrome.tsx:47-92`). **Do NOT introduce
   `camera-chrome-root`/`data-camera-chrome` into WebGL** — the chrome
   detector gate C is SVG-scoped (`canvas-chrome-detector.spec.ts:13-23`);
   add a dock host inside the existing `data-webgl-chrome` overlay instead,
   and never mount chrome inside `.zoomWorld`/the R3F canvas (GlassCard DOM
   Layer 3 law, `GlassCard.tsx:16-18`).
9. **z-index slotting.** WebGL uses raw inline zIndex tiers 5 (rail) / 6
   (strip) / 7 (photo sheet) / 8 (present deck) / 20 (palette); the dock
   must slot **6 < z < 20** (recommend 10-12) — the `--ws-z-*` and
   `--gs-z-*` scales are SVG-studio-only and do not apply.
10. **Dead tokens.** `--studio-rightrail-open-w: 248px` is the natural dock
    width token — zero consumers today (`globals.css:190-192`); the dock
    should adopt it.
11. **Behaviour invariants.** Preserve `unlockedModes` gating and
    Esc-dismiss; the strip's "tabs, not floating cards, exactly one panel"
    contract (`PerimeterTabStrip.tsx:6-11`) is the rule to generalise to
    the right edge.

**Change order for the refactor:** GlassCard dock slot → new
`RightDockShell` → `WebGLStudioPreview` re-homing (the `:778-1943` chrome
zone) → `PerimeterTabStrip` retargeting → `studioStore` dock state → rail
unchanged → SVG path (`CameraChrome`, `HandoffDesignStudio`, s6 spec)
untouched → extend `webgl-chrome-collision` + optional WebGL coverage
ratchet. Fix the `StudioElevationCard` containing block in the same pass.

---

## 2. 3D surface & depth stacking (StudioScene / FusedSketchLayer)

Prior art: `docs/GROUND-PLANE-ALIASING-AUDIT.md` — a previous audit that
fixed the ±10000 ortho span (zebra striping) via
`cameraAnimation.ts:177-182`, `StudioScene.tsx:628-629`,
`WebGLStudio.tsx:212`. This survey builds on it.

### 2.1 Co-planar ground meshes — the y-lift ladder

The ground pipeline is one flat GroundPlane (or TerrainMesh in terrain
mode) at y=0 with a ladder of ad-hoc y-lifts for every overlay. A spatial
**layer contract exists** (`layerContract.ts:20-25` — terrain renderOrder 0 /
draped 1 @ 0.02 m / semantic 2 @ 0.06 m / markers 3 @ 0.08 m), but the
component constants both follow and drift from it: ink 0.02 matches draped,
but FeatureLayer 0.03, DimensionLayer 0.04, TrenchLayer 0.05 and easements
0.05 sit at non-contract lifts, and six overlays share the same y. Full
inventory (transparent/depthWrite/polygonOffset/renderOrder):

| mesh | y (m) | transparent | depthWrite | renderOrder | file:line |
|---|---|---|---|---|---|
| GroundPlane (flat mode) | 0 | true (0.88-1) | true | 0 | `StudioScene.tsx:615-624` |
| TerrainMesh (terrain mode, XOR) | 0 + relief | lerps 0.88-1 | true | 0 | `TerrainMesh.tsx:124-132,54-79` |
| 6 pointer-capture planes (StudioControls, AssetPlace, FusedSketch, MeasureTape, Trench, IrrigationZone) | 0 | true (op 0) | **false** | 0 | `StudioControls.tsx:495-511`, `AssetPlaceLayer.tsx:83-90`, `FusedSketchLayer.tsx:253-262`, `MeasureTapeLayer.tsx:159-168`, `TrenchLayer.tsx:256-265`, `IrrigationZoneLayer.tsx:319-328` |
| ContactShadows | 0.008 | true | false (drei) | 0 | `StudioScene.tsx:239-247` |
| gridHelper (10 m cells) | 0.01 | false | true | 0 | `StudioScene.tsx:626-630` |
| Fallback item discs | 0.01 | true (0.4) | true | 0 | `sceneItems.tsx:747-751` |
| TPZ ring | 0.02 | false | true | 0 | `sceneItems.tsx:341-343` |
| Building ground outline | 0.02 | false | true | 0 | `StudioScene.tsx:504-510,527-529` |
| Sketch ink (FLAT_Y) | 0.02 | true (0.82) | true | 0 | `FusedSketchLayer.tsx:54,388-395` |
| PavingMesh slab | 0.02 base / 0.12 top | false | true | 0 | `sceneItems.tsx:463-481` |
| RegionMesh bed | 0.03 | true (0.5) | true | 0 | `sceneItems.tsx:643,646-657` |
| FeatureLayer linework | 0.03 + drape | true (0.9) | true | 0 | `FeatureLayer.tsx:26,152-159` |
| Slice cut line / drag handle | 0.03 | true | true/false | 0 | `ElevationSliceLine.tsx:35,123-148` |
| DimensionLayer linework | 0.04 | true (0.75) | true | 0 | `DimensionLayer.tsx:37,116-123` |
| RegionMesh lawn | 0.04 | true (0.55) | true | 0 | `sceneItems.tsx:643,646-657` |
| DeckMesh planks | 0.04 base / 0.08 top | false | true | 0 | `sceneItems.tsx:537-555` |
| FloraRing ghost ring/disc | 0.05 / 0.045 | true | **false** | 0 | `FloraRingLayer.tsx:165-183` |
| Trench / stream lines | 0.05 + drape | true | true | 0 | `TrenchLayer.tsx:55,239-249`; `DrainageFlowLayer.tsx:45,114-127` |
| Tape line / pond discs / proposal ring | 0.06 + drape | true | mixed | 0 | `MeasureTapeLayer.tsx:40,172-190`; `DrainageFlowLayer.tsx:46,132-148`; `CadProposalLayer.tsx:18,72-79` |
| IrrigationZone fill / stroke | 0.06 / 0.07 | true | false/true | 0 | `IrrigationZoneLayer.tsx:61,293-311` |
| Easements / Services / Boundary / Overlays | 0.05 / 0.04 / 0.06 / 0.07 + drape | mixed | true | 2 (semantic) | `StudioScene.tsx:342,384,272,434`; `layerContract.ts:23` |
| Origin peg | 0.08 + drape | false | true | 3 (markers) | `StudioScene.tsx:100-127`; `layerContract.ts:24` |
| Earthworks zone mesh / pad mass | +0.04 / 0.02 base | true | false/true | 2/1 | `EarthworksLayer.tsx:43,162-191` |
| Subsurface conduits | -depth + 0.008 | true | — | 1 | `SubsurfaceEngine.tsx:91-120` |
| PhotoTracePlane (vertical) | vertical | true (0.88) | false | 0 | `PhotoTracePlane.tsx:523-542` |

**Same-y z-fight pairs where BOTH sides write depth:** y=0.02 (ink ∩ TPZ
ring ∩ building outline ∩ paving slab underside — ink crossing a pad fights
the slab bottom), y=0.03 (bed ∩ feature linework ∩ slice line), y=0.04
(dim strings ∩ lawn ∩ deck plank bottoms), y=0.05 (trench ∩ streams ∩
easements — three draped line sets), y=0.06 (tape ∩ semantic boundary),
y=0.01 (grid ∩ discs). The six capture planes sit exactly on the ground but
`depthWrite: false`, so they cannot fight visually; raycast ties are
resolved by mount order (`StudioControls.tsx:292-294`). FloraRing
0.045/0.05 and zone fill/stroke pairs don't write depth (rely on transparent
sort).

### 2.2 Camera near/far ratios and depth precision

- **Scratch cameras:** ortho `new THREE.OrthographicCamera(-1,1,1,-1,-240,240)`
  (`cameraAnimation.ts:168`), persp `new THREE.PerspectiveCamera(30,1,0.1,
  10000)` (`:169`) — near/far overwritten every frame by the envelope code.
  `distance = max(1, halfWorldH/tan(15°))` (`:283-291`), where
  `halfWorldH = (viewSize · boardAspect)/(2 · zoom)` (`:191`).
- **Ortho (plan + elevation):** `near = -2·distance, far = +2·distance`
  (`cameraAnimation.ts:198-199`), linear span 4·d. At scaleM=110
  (`page.tsx:141`), zoom 1 → d ≈ 207-267 m → span 827-1067 m →
  **49-64 µm per 24-bit depth unit** — the 10 mm grid lift = 157-203 units,
  safe in plan/elevation. (The old ±10000 span that gave 1.19 mm/unit and
  zebra striping is fixed.)
- **Persp (3D tilt):** `near = 0.1, far = 4·distance`
  (`cameraAnimation.ts:221-222`) → **ratio ≈ 40·d ≈ 8,272:1 to 10,672:1**.
  Precision at distance z ≈ z²/(0.1·2²⁴): **25.5 mm/unit at the lot centre
  (z≈207)**, 102 mm at 2d, 408 mm at 4d. Zoom clamp is 0.1-50
  (`cameraRigGesture.ts:88`) — at zoom 0.1 the ratio ≈ 82,720:1 with
  **2.55 m/unit at the lot centre: the whole 10-80 mm lift stack is inside
  one depth bucket.**
- The projection is an **element-wise matrix lerp**
  (`cameraAnimation.ts:263-275`), so persp nonlinearity grows with
  `viewBlend` — the 10/20 mm lifts are 0.4-0.8 depth buckets at lot-centre
  distance at zoom 1, i.e. genuinely marginal as soon as the camera tilts
  (matches `GROUND-PLANE-ALIASING-AUDIT.md:36-37`). The elevation snap lerps
  back to ortho (`FusedCamera.tsx:209-225`) → linear again.
- The R3F canvas props `near: 0.1, far: 500` (`WebGLStudio.tsx:212`) are
  **never updated** — FusedCamera writes only projectionMatrix/Inverse
  (`FusedCamera.tsx:228-230`), so any envelope fix belongs in
  `cameraAnimation.ts:221-222`. `cameraRig.ts` has no near/far adjustments.

### 2.3 polygonOffset

**Zero occurrences of `polygonOffset` in `apps/web/src`** (verified by
grep). Co-planar separation is entirely the ad-hoc y-lift ladder
(0 → 0.008 → 0.01 → 0.02 → 0.03 → 0.04 → 0.05 → 0.06 → 0.07 → 0.08) plus
`renderOrder`, which is used in only 4 places (`layerContract.ts:21-24`,
`TerrainMesh.tsx:131`, `EarthworksLayer.tsx:162,179`,
`SubsurfaceEngine.tsx:117`). The prior audit listed polygonOffset as a
deprioritised fallback (`GROUND-PLANE-ALIASING-AUDIT.md:91-93`); it was
never adopted.

### 2.4 Moiré sources

| Source | Density mechanism | Zoom behaviour | Risk |
|---|---|---|---|
| terrainMaterial shader | none — slope-albedo only (`terrainMaterial.ts:24-58`); "contour banding" comments at `TerrainMesh.tsx:15-17` are stale | — | none |
| TerrainMesh tessellation | 60×60 segs over 3× board (`terrainMath.ts:36`, `TerrainMesh.tsx:65`) ≈ 5.5 m cells at scaleM 110; fixed world spacing | constant | low |
| gridHelper | 10 m cells at y=0.01 (`StudioScene.tsx:628-629`), flat mode only; 33 lines over 330 m | <2 px spacing at plan zoom-out beats the pixel grid | medium |
| TactileGround (SVG fallback) | step from `pickMetricStepM` (`TactileGround.tsx:73-76`, `groundMetrics.ts:35-46`), minor = step/5, 1 px non-scaling strokes (`:143-195`) | quantised zoom LOD, density scales | medium (SVG only) |
| GroundRulerOverlay | DOM labels per stepPct (`GroundRulerOverlay.tsx:50-68`) | label crowding, not line Moiré | low |
| DrainageFlowLayer / flowField | 60 segs over 3× board (`flowField.ts:157,80-85`) — same 5.5 m cells as terrain (aligned, no beat); world-fixed dashes 0.8/0.6 m (`DrainageFlowLayer.tsx:122-124`) + animated dashOffset (`:43,91`) | on-screen dash frequency ∝ zoom → sub-pixel dash crawl at zoom-out | medium-high |
| Trench dashes | 1.2-3 m world-fixed (`TrenchLayer.tsx:47-52,244-246`) | dash crawl at zoom-out | medium |
| IrrigationZone dashes | 0.5/0.35 m (`IrrigationZoneLayer.tsx:270-272,306-308`) | dash crawl | medium |
| Deck planks | 0.16 m stride (`sceneItems.tsx:519-521`) | beats the pixel grid at plan zoom-out | medium |
| Textures | none tiled (zero minFilter/magFilter/anisotropy; aerial retired, `layerPolicy.ts:9`) | — | none |

### 2.5 Structural dependencies (in order a depth-budget fix would touch)

1. `cameraAnimation.ts` near/far (`:198-199` ortho, `:221-222` persp) —
   consumers `FusedCamera.tsx:182-225`, tests `cameraAnimation.test.ts:
   176-199`, cosmetic Canvas props `WebGLStudio.tsx:212`.
2. Zoom bounds `cameraRigGesture.ts:88`, `photoTraceMath.ts:394-397`.
3. `layerContract.ts` SPATIAL_LAYER offsets (`:20-25`) as the re-budget
   anchor.
4. The per-layer y constants (`FusedSketchLayer.tsx:54`,
   `FeatureLayer.tsx:26`, `DimensionLayer.tsx:37`,
   `ElevationSliceLine.tsx:35`, `MeasureTapeLayer.tsx:40`,
   `DrainageFlowLayer.tsx:45-46`, `TrenchLayer.tsx:55`,
   `IrrigationZoneLayer.tsx:61`, `CadProposalLayer.tsx:18`,
   `EarthworksLayer.tsx:41-43`, `sceneItems.tsx:643,467,537,748,342`,
   `StudioScene.tsx:240,508,629`, `FloraRingLayer.tsx:165,175`).
5. `renderOrder` discipline (SPATIAL_LAYER tiers + the 3 ad-hoc uses — the
   flat GroundPlane and gridHelper share tier 0 with a traversal-order
   tie-break).
6. `polygonOffset` (zero adoption; fallback per
   `GROUND-PLANE-ALIASING-AUDIT.md:91-93`).
7. Regression tests (`cameraAnimation.test.ts`, `terrainDrape.test.ts:47`,
   `measurement-integrity.test.ts`).

**Hard constraint:** every lifted-line change must respect the shared
sampler contract (`terrainMath.ts:99-100` — "bit-identical drape/slice") or
draped lines re-intersect the terrain (`terrainDrape.test.ts:8-14`).

---

## 3. Spatial overlay collision (DimensionLayer / HTML overlays)

### 3.1 Projection chain for dimension badges

`DimensionLayer.tsx` (verified): pure board-% geometry → world metres →
rendered in-canvas as drei `<Html>` chips — **screen-projected DOM labels,
not world-space text**.

1. **Board-% geometry.** `edgeSegments(boundaryPct, "B", scaleM, boardAspect)`
   yields per-edge segments with `lengthM`, `mid`, `rotDeg`
   (`handoff/geometry/polygon.ts:157-178`); `buildOutsideDims` computes the
   label anchor `labelX/labelY` = edge midpoint + outward normal ×
   (`offsetPct 2.4` + `labelExtraPct 1.5`)
   (`handoff/geometry/outsideDims.ts:111-112`, defaults `:66-68`).
2. **Declutter.** `declutterOutsideDims(dims)` flags `visible`
   (`DimensionLayer.tsx:71-92`), filtered at `:92`.
3. **Board-% → world metres.** `pctToWorld({x: labelX, y: labelY}, scaleM,
   boardAspect)` (`DimensionLayer.tsx:125-129`) → `[wx, wz]`; the badge
   anchor is `[wx, DIM_Y + 0.05, wz]` (`:133`). `pctToWorld` is the linear
   lot-centred board-%→metre map (`coordTransform.ts:39-49`); `worldToPct`
   (`:55-67`) is used only for pointer raycasts (`MeasureTapeLayer.tsx:
   96-99`), never for labels.
4. **World → screen.** drei `<Html position center zIndexRange={[20, 10]}>`
   (`DimensionLayer.tsx:131-141`). Inside drei, `defaultCalculatePosition`
   runs `objectPos.project(camera)` per frame and writes
   `transform: translate3d(xpx, ypx, 0)` (`@react-three/drei` web/Html.js),
   updated in `useFrame`. The label div portals into
   `gl.domElement.parentNode` — the `data-testid="webgl-studio"` container
   (`WebGLStudio.tsx:207`), not the chrome overlay. Chips are constant
   screen px (10.5 px font, `DimensionLayer.tsx:39-50`). The projection
   camera is the r3f camera whose matrix `FusedCamera` lerps between ortho
   and perspective every frame (`FusedCamera.tsx:199-204,227-230`).

**`CameraChrome` is NOT the WebGL mechanism** — it is the classic studio's
portal (`handoff/CameraChrome.tsx`, `place` kinds `dock`/`frame`/`project`
`:20-34`, `boardPctToClientOffset` `:132-154`, host polled via
`[data-testid=camera-chrome-root]` `:47-92`, updates on React re-render
only). There is **no dedicated WebGL world→screen util** — drei Html's
built-in projection is the only one; the classic `boardPctToClientOffset`
models only the 2D zoomWorld CSS camera and cannot model the fused
ortho/persp camera or split view.

### 3.2 Collision avoidance — a board-% declutter exists, but it is zoom-blind, per-ring, and never screen-space

The only label-collision logic anywhere is `declutterOutsideDims`
(`outsideDims.ts:171-206`) with `approxLabelBox` (`:149-159`) and
`boxesOverlap` (`:161-163`) — **greedy keep-longest, hide-the-rest,
axis-aligned board-% boxes**. Everything else matching
collision/overlap/offset/priority/hide is chrome-collision specs, spatial
layer clearance, or the planting-guard canopy check — no screen-space
overlap detection, no leader lines, no above/below offsets, no
hide-when-overlapping rule in the WebGL render path.

**Concrete failure mode (numbers):** a chip `"B1 · 12.34 m"` is ~60-85 px
wide at 10.5 px Space Grotesk incl. `padding 0 5px` (`DimensionLayer.tsx:
41,47-48`). The declutter box is fixed `halfWPct 4.2`/`halfHPct 1.1` =
8.4% × 2.2% of the board (`outsideDims.ts:183-184`) — 8.4 m × 2.2 m on a
100 m lot, **independent of zoom**. `DimensionLayer` calls it with no
options (`:75,90`) inside a `useMemo` keyed only on geometry (`:68-93`), so
it never re-runs on camera state. The classic studio passes zoom-derived
boxes (`CadPlanBoard.tsx:796-802`, clamped [1.2, 6.5], "Labels reappear as
zoom increases"); the WebGL caller does not. Consequences: zoomed out →
chips cover far more board-% than the box, so **overlapping labels both
survive**; zoomed in → **labels are hidden that would not overlap on
screen**; in 3D perspective the board-% model maps to screen not at all. At
1-5 m survey vertex spacing the adjacent boxes always overlap, so the
greedy pass **suppresses** the shorter edge's label — suppression, never
offset. There is no per-label offset direction (chips are always
`center`-anchored, `:134`; `rotDeg`/`readableUpDeg` are computed but unused
in the WebGL render, `:124-143`), no leader line, and the only stacking
device is `zIndexRange`.

**Cross-ring and cross-layer:** boundary and building are decluttered
**separately** (`:75` vs `:90`), so a B label and an F label can share one
screen point. The measure-tape readout (`MeasureTapeLayer.tsx:191-200`),
flora ring card (`FloraRingLayer.tsx:186`), snap glyph
(`FusedSketchLayer.tsx:538`), CAD proposal chip (`CadProposalLayer.tsx:94`),
and zone/trench draft labels (`IrrigationZoneLayer.tsx:354`,
`TrenchLayer.tsx:284`) all share the identical drei-Html constant-px
projection and participate in no collision system and are never checked
against the dim labels. `FeatureLayer` has no labels at all
(`FeatureLayer.tsx:76-88`). Tests: no `DimensionLayer.test.ts` exists;
`outsideDims.test.ts:79-144` tests board-% boxes only; e2e
`webgl-cad-annotations.spec.ts` seeds a wide 60%×70% rectangle (`:48-65`)
and asserts only `count >= 3` (`:85-86`) — tight spacing and zoom visibility
are never exercised.

**Classic SVG studio comparison — three mechanisms the WebGL layer
dropped:** (a) zoom-aware declutter boxes from layout px + `planZoom` into
the same `declutterOutsideDims` (`CadPlanBoard.tsx:794-804`); (b) a semantic
LOD — `resolveAnnotationLod`/`filterDimsForAnnotationLod`
(`handoff/geometry/annotationLod.ts:68-120`: dims hidden at overview, only
the longest 6 at mid zoom, cross-faded opacity); (c) screen-px colliders for
other label families — `placeScheduleCards` (lot/dwelling/outdoor chips,
`handoff/features/surfaces/scheduleCardLayout.ts:55-89`) and
`placeSpeciesLabels` (16 px screen-Y gap,
`handoff/features/render/speciesLabels.ts:29-57`), both fed by
`pxPerMetre` (`handoff/features/tilt/tiltMath.ts:102`). Classic dim labels
are rotated to the edge (`readableUpDeg` + `planRotateDeg`,
`CadPlanBoard.tsx:2304,2326`) and, like the WebGL board-% declutter, the
classic 2D CSS projection breaks under tilt — which is why classic
suppresses dims under tilt (`CadPlanBoard.tsx:615-618,816`). The WebGL
studio **cannot** take that escape hatch: its fused camera is always
perspective-based (the ortho view is a perspective frustum with an ortho
matrix lerped in), so under tilt the WebGL dims stay on and their board-%
declutter is simply wrong — the tilt case has no suppression path at all.

### 3.3 Structural dependencies (in order a label-collision system would touch)

1. `webgl/coordTransform.ts` — a screen-space collider needs a new
   world→screen projection (r3f `Vector3.project(camera)`); none exists as
   a webgl util.
2. `handoff/geometry/outsideDims.ts` — `declutterOutsideDims` must become
   zoom/screen-aware (classic pattern `CadPlanBoard.tsx:796-802`) or be
   replaced by a screen-space pass.
3. `webgl/DimensionLayer.tsx` — call sites `:75,90` (zoom-derived boxes or a
   camera hook), render `:124-143` (offset/leader/priority options), store
   subscription `:65` (adds `liveRig.zoom`/`viewBlend`, published at
   `FusedCamera.tsx:167-169`).
4. `handoff/geometry/annotationLod.ts` — port the LOD (classic-only today).
5. Label chrome — no shared label component; each layer inlines its chip
   style (`DimensionLayer.tsx:39-50`, `MeasureTapeLayer.tsx:44-55`).
6. `scheduleCardLayout.ts` / `speciesLabels.ts` — the classic screen-px
   colliders to port if measure/flora/future labels must participate.
7. Tests — `outsideDims.test.ts` (zoom-mismatch cases), a new
   `DimensionLayer` unit test (none exists), `webgl-cad-annotations.spec.ts`
   (tight vertex spacing + zoom-dependent counts).
8. `handoff/CameraChrome.tsx` — relevant only if WebGL moves off drei Html
   to a DOM-project portal (not the current mechanism; leave untouched).

---

## 4. Navigation structure — top bar pill list (Survey through Saved)

Two studios, two top bands. WebGL is the product surface.

### 4.1 WebGL perimeter tab strip (`PerimeterTabStrip.tsx`, mounted
`WebGLStudioPreview.tsx:805-888`, container zIndex 6 `:801`)

**Primary modes (all 8 from one `CANVAS_MODES.map`, `:117-198`; order from
`lib/canvas-mode.ts:11-20`; unlock law `unlockedModes` `:35-51`):**

| Pill | testid | Category | Unlock |
|---|---|---|---|
| Survey | `mode-tab-survey` | stage 1 core | always (`canvas-mode.ts:36`) |
| Sketch | `mode-tab-sketch` | stage 2 core | aerial/title (`:37-42`) |
| CAD | `mode-tab-cad` | stage 3 core | aerial/title |
| Elevation | `mode-tab-elevation` | auxiliary (vertical view) | aerial/title |
| Garden | `mode-tab-garden` | auxiliary (3D eye-level) | aerial/title |
| Quote | `mode-tab-quote` | stage 4 core | accepted CAD (`:43-46`, `modeLockCopy.ts:20`) |
| Present | `mode-tab-present` | auxiliary (client lens) | accepted CAD (`modeLockCopy.ts:21`) |
| Share | `mode-tab-share` | auxiliary (portal) | costed quote (`:47-49`, `modeLockCopy.ts:22`) |

Locked tabs render a disabled span with `lockReasonForMode` tooltip
(`:121-138`); native modes render buttons (`:141-168`); the `<a
href="?svg=1&mode=…">` branch (`:170-197`) is **dead** —
`isNativeWebGLMode` delegates to `webglStudioSupportsMode`, true for all 8
(`canvas-mode.ts:102-115`). The `NativeWebGLMode` type (5 members,
`PerimeterTabStrip.tsx:30-33`) is stale vs the runtime (8).

**Meta tabs (right cluster, `role=group`, `:211-248`; labels from
`WebGLStudioPreview.tsx:810-859`):** Studio (workspace context; undo/redo/
zoom `:1246-1291`), Sun (canvas surface), Growth (canvas surface), Layers
(view tool), Site (workspace context), Fit (view tool/quote artifact,
active = `fitSheetOpen`, `:841-847`), Terrain (canvas surface, only with
heightmap `:848-858`).

**Trailing status cell (`:250-262`, `marginLeft: auto`):** canvas summary
(`strip-stats` `:862-883`, "B{n}·I{n}·S{n}" + strikes + scale), save status
(`SaveStatusChip.tsx:31-64`, `save-status-chip`, role=status — Saved /
Saving… / Retrying… / Save failed / Refresh needed / Offline; "Saved Ns
ago" `formatSavedAge` `:116-124`), measure readout (`:2065-2094`, only while
measure armed). SaveStatusChip renders a second time inside the Studio panel
(`:1174`).

**Left rail (second tool surface, `StudioToolRail.tsx`, zIndex 5 `:271-278`,
testid `rail-{id}` `:293`):** present lens `:85-94`, sketch `:95-110`,
measure `:111-119`, marquee `:120-128`, tidy `:129-144`, trench `:145-153`,
zones `:154-162`, lighting `:163-171`, assets `:172-184`, underground
`:185-193`, split `:194-202`, dims `:203-215`, section `:216-226`, flow
`:227-237`, earth `:238-250`, quote `:251-263` (toggles `fitSheetOpen`,
gated on items>0 `:1792`).

### 4.2 SVG fallback Tier1TopBar (`Tier1TopBar.tsx` zIndex 22, assembled
`HandoffDesignStudio.tsx:3691-3943`)

Left zone: brand+address, survey progress "2/5" (`survey-progress-pill`
`:3722`, survey mode only), cadastral meta, lifecycle phase
(`HeaderPhaseSelect.tsx:136-162`, `phase-manager-toggle`), paper A3/A4 +
Elev toggle (fit sheet open only). Centre zone: mode strip
(`MODE_TABS` `studioCatalog.ts:338-347`, `canvas-mode-{m}` `:3804`; compact
variant `CompactModeNav.tsx:41-97`, phone only). Right zone: Ask AI pill,
View menu (`HeaderViewMenu.tsx:122-150`; 17 items), live cost chip
(`header-cost-chip` `:3858`), save (`UnifiedSaveStatus.tsx:39-133`,
`autosave-tick`), share button (`share-top` `:3903`, disabled without costed
BOM). Context strip below (`StudioContextBreadcrumb.tsx:60-104`).

### 4.3 Grouping analysis (verified redundancies)

1. **Present** is a mode tab AND a rail lens — one `presentationMode` state,
   two affordances, two testids.
2. **Quote/fit-sheet has three WebGL affordances** — `mode-tab-quote`,
   `rail-quote`, `meta-tab-fit` — the last two toggle the same
   `fitSheetOpen` flag (`StudioToolRail.tsx:258`; `WebGLStudioPreview.tsx:
   845-846`).
3. **Sketch** is a mode tab AND a rail tool (`:284-288` vs
   `StudioToolRail.tsx:100-107`).
4. **Two independent save machines**: WebGL `SaveStatusChip` (zustand
   `studioStore.saveStatus/savedTick/saveErrorKind`) vs SVG
   `UnifiedSaveStatus` (reducer props, mode-switched
   `HandoffDesignStudio.tsx:3872-3875`); different testids.
5. **Mode order disagrees between studios**: `CANVAS_MODES` puts elevation
   before garden; `MODE_TABS` swaps them (`studioCatalog.ts:338-347`).
6. **No digit shortcuts in WebGL**; SVG uses keys 1-8 by `MODE_TABS` index
   (`:1637-1646`), colliding latently with paint swatch digits 1-9
   (`:1964-1987`).
7. z-index: strip 6, rail 5, share overlay 6, photo sheet 7, present deck 8
   (`WebGLStudioPreview.tsx:801,278,1897,1863,1930`).

### 4.4 Grouping proposal input (three zones)

1. **Primary mode strip** — Survey → Share in one canonical order
   (`canvas-mode.ts`), unlock law preserved. Decision: keep auxiliary modes
   (elevation, garden, present, share) in the strip for their locked-pill
   affordance, or demote to a secondary strip (changes digit-index
   expectations); delete the dead `?svg=1` branch and fix the stale
   `NativeWebGLMode` type.
2. **View tools zone** — split the rail into craft tools vs view toggles;
   drop the mode duplicates (`rail-present`, `rail-quote`, `rail-sketch`).
   Meta tabs (Sun/Growth/Layers/Site/Terrain/Fit) stay contextual chips.
3. **Workspace status zone** (right-aligned) — save status, stats, phase,
   context, live cost. Moves: bring lifecycle phase select into WebGL (it
   is SVG-only today even though the canvas persists `lifecycle_phase`,
   `siteTruthImport.ts:287`), unify the two save machines, optionally
   surface survey progress in WebGL. Conflicts: Present mode-vs-lens; the
   three quote affordances (suggest: Quote mode tab owns the surface); one
   canonical mode order; e2e testids on any rename.

---

## 5. Phased architectural proposal (for review — no code changed)

### Phase 0 — premise and dead-code fixes (S, zero risk)
- Remove the dead `?svg=1` link branch (`PerimeterTabStrip.tsx:170-197`) and
  fix `NativeWebGLMode` to match `webglStudioSupportsMode`.
- Reconcile mode order between `canvas-mode.ts` and `studioCatalog.ts`.
- Update `ONBOARDING.md` §7 stale-comment register (stateBridge entry) and
  the "uncommitted photo-trace" claims (committed `0b37127`).

### Phase 1 — rail text contract (S, fixes the pill overflow)
- Add `whiteSpace: "nowrap"` + `overflow: "hidden"` +
  `textOverflow: "ellipsis"` (+ `maxWidth: "100%"`) to the rail label span
  (`StudioToolRail.tsx:327-337`), mirroring `chipBase`
  (`PerimeterTabStrip.tsx:63`). Mechanism is settled (§1.2): labels overflow
  the 42 px pill and are clipped by the nav scroll container — no wrap
  property exists anywhere, so the fix is the explicit text contract.
- Decide the expanded-rail state: either consume
  `--studio-toolrail-expanded-w: 152px` (labels inline when expanded) or
  keep glyph-only pills and use `title` for long names. All three rail
  tokens are currently dead (`globals.css:190-192`) — this phase activates
  the contract, no token churn.
- Add a rail-geometry assertion to `webgl-chrome-collision.spec.ts` (none
  exists today).

### Phase 2 — right-hand docking shell (M, the "centered overlay" fix)
- Move the perimeter panel container from the top-centre column
  (`WebGLStudioPreview.tsx:790-804`) to a right-edge dock zone; the shared
  `perimeter-panel` render (`:1712-1781`) moves with it — one seam.
- Keep `GlassCard positionMap` as the card contract; add a `right-dock`
  placement; fix the `StudioElevationCard` broken containing block
  (`StudioElevationCard.tsx:60-67`) in the same pass.
- Gates: the s6 coverage ratchet is `?svg=1`-scoped and untouched; the
  WebGL gate is the pairwise `webgl-chrome-collision` spec — the 248 px dock
  must pass all three viewports it walks. z-index: dock slots 6 < z < 20
  (recommend 10-12); rail 5 and overlays (share 6 / photo 7 / present 8)
  unchanged. Adopt `--studio-rightrail-open-w: 248px`.
- Do NOT touch the frame-drawer top band (SVG-only) and do NOT introduce
  `camera-chrome-root` into WebGL — dock inside `data-webgl-chrome`.
- Structural order: GlassCard slot → `RightDockShell` →
  `WebGLStudioPreview` re-homing (`:778-1943`) → `PerimeterTabStrip`
  retargeting → `studioStore` dock state → rail unchanged → SVG untouched →
  extend `webgl-chrome-collision`.

### Phase 3 — depth budget (M, Moiré / z-fighting)
- Add per-layer `polygonOffset` (or `renderOrder` + `depthWrite`) discipline
  for the visible flats (sceneItems 0.01/0.02/0.04, DimensionLayer 0.04)
  instead of raw y-lift.
- Re-evaluate near/far: consider `logarithmicDepthBuffer` or a tighter
  near for the plan rig (`WebGLStudio.tsx:212`; `cameraAnimation.ts:198-222`).
- Address the line-density Moiré sources from §6 (terrain grid, flow grid,
  TactileGround) with zoom-aware density.

### Phase 4 — label collision (M)
- Add a screen-space declutter pass over the drei `<Html>` labels (the plan
  pass exists at `outsideDims.ts`; the tilt case does not), with per-label
  offset/leader rules and hide-below-zoom priority.
- Share it across dimension, measure, feature, and flora labels.

### Phase 5 — navigation regrouping (M, after 1-4)
- Dedupe rail/tab mode duplicates (present, quote, sketch).
- Bring phase select + survey progress into WebGL (zero-chrome budget
  permitting); unify the two save machines; one canonical mode order.
- Update e2e testid selectors in the same change.

**Verification per phase:** typecheck + touched unit tests + the kept e2e
probes (`webgl-chrome-collision`, `canvas-checklist-s6`, `webgl-cad-
annotations`, `webgl-default-mount`, `webgl-marquee-select`); every phase
keeps the chrome-coverage baseline and the AA contrast gate green.

---

## 6. Sub-survey appendices

- §6.1 Layout shell — integrated into §1 (mount inventory, the
  `StudioElevationCard` broken containing block, the `data-webgl-chrome`
  dock host, ratchet scope correction, z-index slotting, change order).
- §6.2 Depth — integrated into §2 (co-planar ladder table, near/far
  precision, Moiré source table, dependency list).
- §6.3 Overlay collision — integrated into §3 (projection chain, declutter
  zoom-blindness, classic-studio comparison, dependency list).

---

## 7. Execution status — phases shipped in-session (2026-08-18)

Implemented in the autonomous push that followed this survey. Gates at time
of writing: web typecheck green, 47/47 touched unit tests green, eslint
`--max-warnings 0` on all touched files, kept e2e probes executed (see
below).

- **Phase 0 — shipped.** `PerimeterTabStrip.tsx`: dead `?svg=1` link branch
  removed, `NativeWebGLMode` type + `isNativeWebGLMode` deleted, `projectId`
  prop dropped, header comment corrected (all 8 modes native).
  `studioCatalog.ts` `MODE_TABS` reordered elevation/garden to match
  `canvas-mode.ts` `CANVAS_MODES` (canonical order; the SVG digit shortcuts
  follow the canonical index). Stale comments fixed: `page.tsx` SVG-fallback
  wording, `studioStore.ts:18` aerial underlay, `WebGLStudio.tsx:114` dark
  aesthetic, `cameraRig.ts:28` tilt note. Docs: ONBOARDING §3 status
  honesty + §7 register (resolved) + OUTSTANDING photo-trace status.
- **Phase 1 — shipped.** `StudioToolRail.tsx` label span now carries the
  text contract (`whiteSpace: nowrap; overflow: hidden;
  textOverflow: ellipsis; maxWidth: 100%`); a rail-geometry probe was added
  to `webgl-chrome-collision.spec.ts` (pills stay ≤ 43 px, labels
  single-line).
- **Phase 2 — shipped.** Right-hand dock: the top-centre container is now
  strip-only; a right dock (`top: 152; right: 12; width: 360; zIndex: 10`)
  hosts the mode/meta bodies, the CAD review card, and the selection
  InspectorCard (now in-flow `position: relative`). Elevation mode renders
  as a centred overlay against the full canvas — the old broken containing
  block (`StudioElevationCard.tsx:60-67`) is fixed by relocation. Side
  effect: the CAD drafter no longer covers the board centre (the
  marquee-in-cad blocker is resolved). Deviation from the plan: the dock is
  360 px, not the dead 248 px token — the docked surfaces (340 px panel,
  260 px inspector, 272 px fit sheet) cannot fit 248; the token stays unused
  for a future collapsed state.
- **Phase 3 — shipped (safe subset).** `cameraAnimation.ts` persp
  `far: 4d → 3d` (ratio 40d → 30d; the 3× board terrain envelope still fits
  inside 3d at every zoom). polygonOffset and near-plane tightening are
  deferred — they change visuals and need a screenshot pass.
- **Phase 4 — shipped (zoom-aware declutter).** New pure module
  `webgl/dimensionLod.ts` (`dimDeclutterBoxForZoom` — classic 1/zoom boxes,
  clamped [1.2, 6.5] / [0.4, 2.2]) with colocated tests; `DimensionLayer`
  subscribes to a quantised zoom (0.5 steps — preserves the zero-commit pan
  law) and passes the box to `declutterOutsideDims` for both rings. The
  screen-space pass, the annotation-LOD port, and leader lines remain
  future work (the tilt case is still plan-space by design).
- **Phase 5 — NOT built (product call).** Rail/tab mode duplicates
  (present, quote, sketch), the WebGL phase select, the survey-progress
  pill, and the save-machine unification all change UX and e2e selectors;
  they need product sign-off on which affordance wins before
  implementation.
- **Pre-existing spec fix (not caused by this push).** `webgl-fit-sheet
  .spec.ts` asserted the fit sheet is "open by default", but the studio
  opens in sketch mode and the fit sheet is a quote-mode-owned surface —
  the premise was stale on main (reproduced on clean HEAD during this
  push). The spec now drives the Quote tab first; the mode-owned-panel
  behaviour is the product intent per this survey's Phase 5 direction.
- **P1 spatial gizmo (shipped after this survey — the §2.1 parity gap).**
  `PlacementGizmo.tsx` mounts drei `TransformControls` on the single
  selected placement: translate (0.5 m snap) and rotate (45° snap), with
  per-frame title-boundary clamping via `constrainAssetCentre` (the gizmo
  "slips" along the edge; crimson notice on snap) and ONE undo step per
  drag (`beginPlacementTransform` → transient updates → `endPlacementTransform`).
  Move/Rotate chips live in the right-docked placement inspector; camera
  gestures stand down while the drag is in flight. E2e probe:
  `webgl-gizmo-move.spec.ts`. Deferred from P1: scale mode, vertex
  editing, shift-to-boundary-vector lock, and the crimson in-scene snap
  highlight (the notice is the current snap surface).
