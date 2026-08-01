# Master gap analysis — 2026-08-02

**Branch:** `sketch/chrome-cleanup` @ `d53c4eb`
**Prior audits superseded:** `TIER1-AI-CANVAS-GAP-AUDIT.md` (2026-07-19), `TIER1-GAP-ANALYSIS-2026-07-27.md`, `IMPLEMENTATION-STATUS.md`, `docs/GAP-ANALYSIS.md`
**Method:** code-read against current `features/*` tree + `packages/*` + `apps/api` + `apps/mobile`

---

## 0. Two-app architecture

| App | Package | Platform | Tech |
|-----|---------|----------|------|
| **Mobile** | `@workstream/mobile` | iOS / Android (native) | Expo 52, React Native 0.76, expo-router, Reanimated, Gesture Handler, Bottom Sheet |
| **Desktop** | `@workstream/web` | Browser (desktop-first) | Next.js 16, React 19, Turbopack |

Shared: `@workstream/ui` (tokens + 5 RN components), `@workstream/domain`, `@workstream/contracts`, `@workstream/cad`

### Mobile screens (17 routes)
- Project list (FlatList, FAB, long-press delete + haptics)
- New project, confirm pin
- Recording (voice walkthrough with VAD, live metering, clip detection — 853 lines)
- Processing, project detail (2,565 lines)
- Design studio (605 lines: SVG canvas, place/draw/select/measure, ghost scan, bottom sheet, offline queue)
- Measure photo, grid soil
- Settings (crew, rate card, plant palette, MYOB, integrations)

### Mobile strengths
- Voice recording with real-time VAD, ambient noise detection, clipping alerts, haptic feedback
- Offline queue with AsyncStorage — drawings survive offline
- `@gorhom/bottom-sheet` for asset palette
- `react-native-gesture-handler` pan gestures for sketch
- `expo-haptics` throughout
- `SafeAreaView` on every screen

---

## 1. Unified dark grey identity (shipped this session)

### What changed (6 files)

- **`packages/ui/src/tokens.ts`** — Complete palette rewrite from blush pink to dark grey. Surface `#14171C`/`#1B1E24`/`#0F1115`, ink `#E8E9EC`/`#9AA0AC`/`#6B7078`, accent `#5A789B` (blueprint slate), radius `5/7/10/14` (sharper, matching web). Elevation shadows pure black. Single source of truth both apps consume.
- **`apps/web/src/styles/globals.css`** — Flipped `--surface-*`, `--ink-*`, `--line-*`, `--accent-*`, `--semantic-*` from light to dark. Portal sheet pinned to light (`#FAFAF8`). Elevation shadows deepened.
- **`apps/web/src/styles/color-tokens.css`** — `:root` default flipped from `--gray-l-*` to `--gray-d-*`. CAD vector colors use dark-optimized variants.
- **`apps/web/src/components/canvas/handoff/handoffStudio.module.css`** — `--hc-*` chrome tokens flipped from `--gray-l-*` to `--gray-d-*`. Gallery frame is now default, not a dark-mode toggle.
- **`packages/ui/src/components/Button.tsx`** — Primary text uses `surface.inverted`; tertiary uses `accent.bright`.
- **`apps/mobile/app/_layout.tsx`** — `StatusBar` flipped to `"light"` icons.

### Verification
- Typecheck: 13/13 packages green
- Lint: clean
- Hex-color gate: 483 files clean

### Token alignment (before → after)

| Dimension | Mobile (old) | Web (old) | Unified (now) |
|-----------|-------------|-----------|---------------|
| Surface base | `#F3ECEF` (pink-cream) | `#f1f0ec` (warm grey) | `#14171C` (dark grey) |
| Surface elevated | `#FFF9FB` (pink-white) | `#ffffff` (white) | `#1B1E24` |
| Ink primary | `#1A1218` (warm black) | `#1b1c1e` (cool black) | `#E8E9EC` (light) |
| Accent | `#D4849A` (blush pink) | `#4f6a89` (slate) | `#5A789B` (blueprint slate) |
| Radius | `10/14/20` (round) | `5/7/10` (sharp) | `5/7/10/14` (sharp) |

---

## 2. Feature gap scorecard (current tree)

```text
Canvas-first / chrome     █████████░ 4.5
AI-first HITL             ████████░░ 4.0
Material / cost engine    █████████░ 4.2
Quote builder / biz loop  ████████░░ 4.0  (was 3.0 — editable + persisted)
Compliance foresight      ████████░░ 3.8
Drafting (Workflow 1)     ████████░░ 3.7
Site intelligence         ███████░░░ 3.4
Persistence / share       ████████░░ 3.8
Paper / Fit sheet         ████████░░ 4.0
Responsive / mobile       ██████░░░░ 3.2  (was 2.0 — bottom sheet, compact nav)
Immersive walk / clay     ████░░░░░░ 2.5  (was 1.0 — AR birdseye, tilt, viewpoint)
Stage 2 CAD / twin        █████░░░░░ 2.8  (was 1.5 — glTF, UE5 sync, telemetry, DXF)
```

### Gaps closed since 2026-07-27

| Gap | Status | Evidence |
|-----|--------|----------|
| G1 — Quote builder editable | **Closed** | `QuoteBuilder.tsx` + `useQuoteDoc.ts` + API persist + 4 e2e specs |
| G2 — Mobile/responsive | **Substantially closed** | `useStudioLayout`, `data-layout="phone"` CSS, `StudioSheetHost`, `CompactModeNav` |
| G3 — Asset menu command-first | **Substantially closed** | `StudioCommandPalette` primary placement, `AssetPanel` collapsed rail |
| G4/G5 — Dwelling outline filter | **Closed** | `pickPlausibleBuildingRing` in `vicmap.ts:753` |
| P0.1 — Durable persist | **Closed** | `canvasBridge` + `saveDesignCanvasAction` |
| P0.2 — Share/portal unlock | **Closed** | `ShareSurface` + `cadQuoteAction` |
| P0.3 — AI draft gate on Share | **Closed** | `share-ai-draft-gate` |
| P1.1 — Worker skeletal cost pulse | **Closed** | `useStudioEstimate` + `LiveBomDock` |
| P1.2 — Shade grid on % board | **Closed** | `ShadeGridOverlay` |
| P1.3 — Easement hatch + honesty | **Closed** | hatch + easement lines + DBYD footer |
| P1.4 — Authored DBH for TPZ | **Closed** | place-time field + `ExistTreeInspector` |
| P2.1 — Vision canopy quality | **Closed** | `proposeFromCanopyImage` prefers API clusters |
| P2.2 — Assist grounded in compliance + shade | **Closed** | `buildAssistSiteIntel` |
| P2.3 — Irrigation/lighting secondary BOM | **Closed** | Zone tool → `irrigation_zones` → Advanced BOM |
| P2.4 — Planting palette sun filter | **Closed** | pointer probe / lot-mean when shade mesh on |

### Gaps remaining

| ID | Gap | Priority | Evidence |
|----|-----|----------|----------|
| G6 | Multi-council compliance profiles | P2 | `studio-preemptive-compliance.ts:8-9` hardcodes Stonnington constants |
| G8 | Utilities/DBYD auto-detection | P2 | BYDA trace commands exist; still manual tracing |
| G9 | PDF export pack | P2 | `@media print` CSS exists; no dedicated PDF download |
| G10 | Doc dual-truth | P1 | Prior audit/status docs not annotated as stale |
| G2-rem | Compliance/layers/BOM bottom-sheet variants | P2 | Only assets/data/inbox pages in `StudioSheetHost` |
| G3-rem | Coarse-pointer placement path | P2 | Not explicitly differentiated |

---

## 3. Fortune-500 polish gaps

### Polish scorecard

```text
Token system / design language  █████████░ 4.5  (mature semantic tokens, gallery frame, WCAG)
Studio canvas chrome            █████████░ 4.5  (disappearing UI, frost glass, idle recession)
Landing page                    ████████░░ 4.0  (animated SVG hero, staggered entrance)
Client portal                   ████████░░ 4.0  (dark hero + light sheet, shimmer skeletons)
Quote builder                   ████████░░ 4.0  (responsive, sticky totals, orphan detection)
Dashboard                       ██████░░░░ 3.0  (functional but flat — no hover polish, no skeletons)
Component consistency           ████░░░░░░ 2.5  (no shared primitives; every module re-invents buttons)
Interaction micro-polish        ████░░░░░░ 2.5  (no view transitions, no hover states on cards, native confirms)
Loading / state design          █████░░░░░ 2.5  (inconsistent skeletons; studio mount is blank-then-pop)
Error / empty states            ██████░░░░ 3.0  (error boundary exists; empty states are basic)
Typography system               █████░░░░░ 2.5  (no type scale; font sizes hardcoded per module)
Accessibility polish             ██████░░░░ 3.0  (focus rings, ARIA on toasts; no skip-link, no live regions)
Onboarding / first-run          ███░░░░░░░ 1.5  (coach marks in studio; no guided onboarding, no sample project)
```

### P0 — Visible to every user

1. **No shared component primitives** — 5 different button radius values across surfaces. No shared `Button` component for web (mobile has one in `@workstream/ui`).
2. **`window.confirm()` for destructive actions** — `DashboardProjects.tsx:96`, `CrewRemoveButton.tsx`, `IntegrationCard.tsx`, `SheetComposeDock.tsx`. Native dialog breaks visual identity.
3. **No view transitions between modes** — Survey→Sketch→CAD→Quote is an instant state swap.
4. **Studio initial mount is blank-then-pop** — No skeleton/loading indicator during async data load.

### P1 — Noticeable on second/third use

5. **Dashboard project cards have no hover state** — `home.module.css:244` has no `:hover`.
6. **No type scale** — No `--text-xs` through `--text-3xl` tokens. Font sizes hardcoded everywhere.
7. **`<details>` for dropdown menus** — No focus trap, no click-outside, no keyboard nav, no animation.
8. **No loading skeletons on dashboard** — `aria-busy` only, no skeleton rows.
9. **No dark mode outside studio** — Dashboard, settings, portal are light-only (now partially addressed by unified dark grey).

### P2 — Polish that separates "good" from "premium"

10. No tooltip system
11. No keyboard shortcut overlay (`?` key)
12. No data visualization (charts, timelines, progress rings)
13. No print stylesheet for the portal
14. No progressive onboarding (sample project, guided first flow, contextual tips)
15. No optimistic UI in the studio (save pulse is text-only)

### Already at Fortune-500 level (don't break)

- Gallery frame concept (dark frame, cream plan as subject)
- Disappearing interface (idle recession, summoned instruments, progressive disclosure)
- Color token system (semantic, WCAG pairs, `color-mix()` fills, CI gate)
- Landing page (animated SVG hero, staggered entrance, `prefers-reduced-motion`)
- Portal quote (dark surface + light sheet, shimmer skeletons, confidential watermark)
- Quote builder (responsive, sticky totals, orphan detection, honesty caption)
- Toast system (`aria-live`, action buttons, backdrop-filter, safe-area)
- Touch/coarse-pointer adaptation (`data-density="onsite"`, 44/48px tap targets)
- Print CSS for Fit sheet (`:has()` scoping, `print-color-adjust: exact`)

---

## 4. Sun & shadow system

### Architecture (4 layers)

**Domain math** (`packages/domain/src/`):
- `site-environment.ts` — `sunPositionAt(lat, lng, when)` → altitude°, azimuth° (0°=north), 16-point compass. `boardShadowCast()` → dwelling shadow offset + length. `approximateDaylight()`, `melbourneSeason()`. Real solar trig (declination, hour angle, AEDT).
- `plan-sun-cast.ts` — `castRingShadowPct(ring, heightM, alt, az, boardWidthM)` → extruded shadow polygon. `shadowLengthMetres()`, `shadowOffsetPct()`, `canopyFootprintPct()`, `growthHeightFactor()` (0.45/0.75/1.0), `decorativeGlyphShadowOffset()`.
- `shade-grid.ts` — `buildIndicativeShadeGrid(lat, lng, when)` → 8×8 grid of sun-hours cells. North/east bias heuristic. "Not EnergyPlus."

**React overlays** (`features/shade/` + `features/sunGrowth/`):
- `SunCastOverlay.tsx` — SVG shadow polygons for dwelling (5.2m) + every item >1.2m. `feGaussianBlur` penumbra. `mix-blend-mode: multiply`.
- `ShadeGridOverlay.tsx` — 8×8 sun-hours mesh. `color-mix(--hc-ink, alpha%)` per cell.
- `SunMarkerPip.tsx` — Azimuth compass pip at lot centre. Hidden below 2° altitude.
- `SunShadowContext.tsx` — React context. `useGlyphSunShadow()` → all plan glyphs get CSS drop-shadows matching live sun direction.
- `ClimateBedWash.tsx` — Live Open-Meteo frost/heat/humidity gradient inside boundary polygon.

**Control dock** (`SunGrowthDock.tsx`):
- Time scrubber (6:20am–7:40pm) along SVG arc with sun dot
- Play button (auto-advance 4min/80ms)
- Season presets: Today / 20 Mar / 21 Jun / 22 Sep / 21 Dec
- Growth slider: Year 1 / Year 5 / Year 10
- Year 10 canopy conflict warning
- Footer: date + indicative shadow length + honesty caption

**Date engine** (`sunDatePreset.ts`):
- Melbourne TZ-aware with DST probing (4-iteration convergence)
- `sunDateFromPreset(preset, sunMin)` → UTC Date

### Test coverage
- `site-environment.test.ts` — season, noon altitude, daylight hours, shadow direction, lengthens when low, suppresses below horizon
- `resolveBoardSunCast.test.ts` — null when off, live cast when on, mature > plant
- `sunDatePreset.test.ts` — today keeps date, solstice/equinox correct, wall-clock applied
- `growthTemporal.test.ts` — stage index round-trip

### Limitations (by design)
- Shade grid is coarse 8×8 (not ray-trace)
- No neighbour building occlusion
- Dwelling height fixed at 5.2m
- No annual cumulative
- No export to Fit sheet (screen-only)

---

## 5. 3D system

### In-studio 2.5D tilt lens (CSS 3D — no WebGL)

**`tiltMath.ts`** (275 lines, tested):
- `wallQuadMatrix3d(ax, ay, bx, by, eavePx)` — true 3D wall quad via column-major `matrix3d`
- `poleMatrix3d(x, y, eavePx)` — corner posts
- `tiltSkinScale()` — oversizes parchment for foreshortening
- `wallLightness()` — directional shading per facet from live sun azimuth (0.72–1.0)
- `billboardStyle()` — standing sprite for planted items
- Garden viewpoints: N/E/S/W cardinal axon (yaw + tilt 55°)
- Tilt 55° default, 60° max, snap-flat at 15°. Editing locked while tilted.

**`TiltBuildingExtrusion.tsx`** — dwelling ring → extruded walls + corner posts + roof cap. Translucent ink wash (CAD grid shows through). Ground plate fallback when dwelling empty.

**`TiltBillboard.tsx`** — each item with height gets standing sprite. Plan glyph stays as dimmed footprint.

### Client share twin (Three.js WebGL)

**`ClientShareTwin.tsx`** (572 lines):
- `THREE.WebGLRenderer` with antialias, shadow maps, pixel ratio capped at 2
- `PerspectiveCamera(42°)` at `(6.5, 8.5, 7.5)`
- `AmbientLight` + `DirectionalLight` with 1024² shadow map
- Ground: `CircleGeometry(14, 48)` PBR roughness 0.92
- Boundary: `ExtrudeGeometry` 0.08m depth
- Dwelling: `ExtrudeGeometry` 1.1m depth, accent material
- Placements: `CylinderGeometry` per item (planting or lighting with emissive)
- Lighting fixtures: `PointLight(0xffd9a0, 0.85, 4.5, 2)` each
- Live sun: `sunPositionAt()` → light position + intensity + scene background shifts (night→day)
- Atmosphere pigment swatches (cherry, etc.) — PBR material switch
- Lighting toggle (fixtures on/off)
- WebGL fallback → `SharePlanSvg`
- AR bird's-eye overlay (rear camera + SVG plan + footprint occlusion + IoU alignment)

### glTF 2.0 export

**`export-gltf.ts`** (389 lines, tested):
- `cadDocumentToGltf(doc)` → glTF 2.0 JSON with embedded base64 buffer
- Polylines → extruded walls, circles → cylinders, inserts → cylinders
- 6 PBR materials (structures, planting, hardscape, water, services, ground)
- Ghosts excluded
- `asset.extras.sync_assets` — stable entity/symbol IDs for UE5 remapping
- Honesty: "Working plan metres — confirm on site"

### UE5 live-sync manifest

**`cad-sync.ts`** (133 lines, tested):
- `buildCadSyncManifest(doc)` → JSON for Unreal/Datasmith importer
- `gltf_path` + `dxf_path` + `poll_hint_s: 15`
- Per-entity: `entity_id`, `proxy` (slab/wall/ribbon/cylinder/skip), `height_m`, `radius_m`
- `ghost_count` + `honesty: "working_plan"`

### DXF export

**`export-dxf.ts`** (144 lines) — ASCII DXF R12, metres, ghost layers with `-GHOST` suffix.

### Live telemetry (IoT twin)

- Sensor ingest: soil moisture, thermal comfort, flow, sediment
- Board wash: dot + halo per sensor
- `buildTwinPerformanceAlerts()` from thresholds
- Demo seed button

### 3D status summary

| Layer | Status | Notes |
|-------|--------|-------|
| CSS 2.5D tilt | **Shipped** | Real `matrix3d` walls, sun-shaded, billboards. View-only. |
| Three.js twin | **Shipped** | Full WebGL, PBR, live sun, shadows, fixtures, atmosphere, AR. Fallback. |
| glTF 2.0 export | **Shipped** | Embedded buffer, 6 materials, UE5 asset IDs. |
| UE5 sync manifest | **Shipped** | Poll-based, proxy types, honesty. |
| DXF export | **Shipped** | R12 ASCII, metres, ghost layers. |
| AR bird's-eye | **Shipped** | Rear camera, footprint occlusion, IoU alignment. |
| Live telemetry | **Shipped** | Sensor ingest, board wash, alerts. |
| 1:1 plan ↔ 3D AI sync | **Not started** | Tilt + twin are view-only. No 3D editing loop. |
| Clay walkthrough | **Deferred** | Share copy: "coming on geo survey." |
| True 3D editing | **Not started** | Tilt locks editing. Twin is view-only. |
| Neighbour buildings | **Missing** | No neighbour occlusion in shadows or twin. |
| Topography/terrain | **Stage 2** | Flat ground. No contour mesh. Correctly deferred. |

---

## 6. New work since 2026-07-27 (not in prior analysis)

- **Fit sheet pens:** Rough.js freehand, watercolour, grey wash, deep chalk, technical CAD furniture, dark-concept, compose margins, brochure elev pick
- **Sketch:** Procreate-style dock, image underlay layers into save/load
- **Artboards:** session strip for plan and elevation views
- **Lighting:** LV spline wires + per-run overload pulse
- **Canopy:** growth-scrubbed canopy and root rings on plan
- **Irrigation:** spray uniformity wash
- **Share:** twin surface (Three.js)
- **CAD gates 3-6:** glTF export, UE5 sync, telemetry ingest, performance alerts, AR birdseye
- **Command palette:** 20+ commands including tilt, garden viewpoints, scheme save, lifecycle phase, irrigation uniformity, live telemetry, AR birdseye, artboard plan

---

## 7. Recommended sequence (highest leverage first)

### Already shipped this session
1. ✅ Unified dark grey token system (mobile + web)

### Next — Fortune-500 polish
2. **Shared Button + Input + Dialog primitives** for web — extract one set, replace ad-hoc instances. Raises consistency from 2.5 to 4.0.
3. **Replace `window.confirm` with branded Dialog** — eliminate most jarring UX moment.
4. **Studio mount skeleton** — structured placeholder during initial data load.
5. **Dashboard card hover + skeleton loading** — second-highest-traffic surface, currently flat.
6. **View transitions between modes** — cross-fade or slide on mode switch.
7. **Type scale tokens** — `--text-xs` through `--text-3xl`, replace hardcoded sizes.
8. **Popover/Dropdown component** — replace `<details>` menus with focus-managed popovers.
9. **Dark mode sweep** — extend to remaining surfaces (partially done by token unification).

### Product gaps
10. **G10** — Annotate prior audit/status docs as historical.
11. **G6** — Parameterize compliance beyond Stonnington.
12. **G9** — Dedicated PDF download alongside browser print.
13. **G2-rem** — Bottom-sheet variants for compliance/layers/BOM docks.
14. **Tests** — Component tests for QuoteBuilder, e2e for phone layout, `pickPlausibleBuildingRing` coverage.

### Stage 2 (firewalled — do not build on % board)
- Metre grid origin / PostGIS / EPSG:7855
- Cut-fill / contour grading
- DXF paper space, dim styles, revision clouds
- Full irrigation hydraulic design
- Survey-locked lodgement sheets
- True 3D editing loop
- Neighbour building occlusion
- Topography/terrain mesh

---

## 8. Verification commands

```bash
pnpm typecheck          # 13 packages
pnpm lint               # eslint api/domain/contracts
pnpm test               # vitest
pnpm run ci             # full gate (install + mobile placeholder + portal edge + typecheck + lint + vitest)
node scripts/check-handoff-chrome-colors.mjs   # hex gate
```

---

## 9. Human-only checklist (not code)

| Action | Where |
|--------|-------|
| Clerk live + Fly/Railway secrets | API + web |
| Redis URL + worker scale | Railway/Fly |
| Sentry DSNs | Both apps |
| Single API machine | `flyctl scale count 1` |
| EAS init + Apple/Google credentials | `apps/mobile` |
| Branch protection on `main` | GitHub Settings (Pro) |
| External keys (OpenAI, Anthropic, Mapbox, Stripe, OTEL) | Fly/Railway secrets |
