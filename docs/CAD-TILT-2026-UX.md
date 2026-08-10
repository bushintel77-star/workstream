# CAD tilt → 2.5D-first pivot, 2026 UX (proposal, not yet binding)

**Status:** Draft design proposal. Not binding until reviewed and merged into
[CAD-AI-2026-UX.md](./CAD-AI-2026-UX.md)'s gap tracker.
**Companions:** [CAD-AI-2026-UX.md](./CAD-AI-2026-UX.md) (target-loop item 5,
"environmental stress test — sun / season / growth scrubbers"; gap tracker row
"1:1 CAD plan ↔ 3D AI lock — Not started (Workflow 1 2D)") ·
[STUDIO-PRODUCT-PHASES.md](./STUDIO-PRODUCT-PHASES.md) (Workflow 1 / Stage 2
boundary — **binding**, this proposal must stay inside Workflow 1) ·
[STUDIO-STYLING-AND-UX.md](./STUDIO-STYLING-AND-UX.md) (chrome/token laws).

## 0. Scope guard — read this before anything else

This is a **Workflow 1** proposal. It must not require:
- Survey-grade coordinates, DXF layers, dimension styles (Stage 2 territory
  per `STUDIO-PRODUCT-PHASES.md`).
- WebGL / three.js / a 3D asset pipeline. Workstream's Workflow 1 canvas is
  deliberately DOM/SVG + CSS 3D transforms, no WebGL dependency (see
  `TactileGround`'s own tooth-grain comment for precedent).

Workstream **already has a separate, shipped Stage 2 "AI CAD" 3D story** —
`cadDocumentToGltf`, glTF export, a UE5 live-sync manifest, AR bird's-eye
overlay (`STUDIO-PRODUCT-PHASES.md` Phase 2/3/6). That is a *different
product surface* (`/projects/:id/design/cad`, new data model). This proposal
is **not** that. It strengthens the in-studio, view-only 2.5D camera that
already exists in Workflow 1 (`features/tilt/`) — nothing here exports a
file or requires Stage 2's metre-origin `CadDocument`.

If future work wants Tier B (limited in-tilt editing) or a bridge to Stage
2's glTF pipeline, that is a **separate proposal** requiring its own
schema/architecture brief, per the Engineering checklist in
`STUDIO-PRODUCT-PHASES.md`.

---

## 1. What already exists (foundation)

| Piece | File | What it does |
| --- | --- | --- |
| Tilt camera math | `features/tilt/tiltMath.ts` | Continuous drag 0–60°, snap-flat <15°, `TILT_DEG=55` settle, reduced-motion aware |
| Cardinal presets | `tiltMath.ts` (`gardenViewpointCamera`) | N/S/E/W "garden viewpoint" — same look convention as `ElevationBoard` |
| Wall extrusion | `features/tilt/TiltBuildingExtrusion.tsx`, `wallQuadMatrix3d` | True `matrix3d` vertical quads, ground→eave, shares world-Z with roof `translateZ` — no drift |
| Planting billboards | `features/tilt/TiltBillboard.tsx`, `billboardStyle` | Height/spread-true standing sprites, camera-facing |
| Skin scale | `tiltSkinScale` | Keeps the parchment/mesh oversized under rotateX+zoom so no "postage stamp" edge reveals |
| Activation | `HandoffDesignStudio.tsx` (`runTiltView`, `useGardenViewpoint`) | Cmd+K toggle, cardinal viewpoint picks, client-view auto-tilt-in |
| **Current posture** | same file | **View-only.** `isTiltActive` locks selection; entering select/calib/level tools auto-flattens to 0°. Tilt is a flourish you glance at, not a place you work. |

This is a real, working 2.5D axonometric renderer. The gap is entirely in
**how central it is to the workflow and what it shows**, not in the
underlying camera math.

---

## 2. The pivot: from flourish to companion view

### 2.1 Persistence, not a toggle
Today: Cmd+K in, editing tool out — tilt never coexists with drafting.
**Proposed:** a dockable tilt panel (picture-in-picture, bottom-right,
resizable) that stays live *while* the operator drafts in plan — same
underlying camera, same board-selection lock rule (still view-only for now),
but visible continuously instead of summoned-and-dismissed. This directly
answers the CAD-AI-2026-UX gap tracker's "1:1 CAD plan ↔ 3D AI lock" line —
"1:1" doesn't require edit-in-3D, it requires *simultaneous, synced* view.

### 2.2 Existing vs proposed — carry the plan convention into 3D
`TiltBillboard`/wall extrusion currently render every item at one visual
weight. `CadPlanBoard` already distinguishes existing (crimson,
`--existing-stroke`) from proposed (cobalt, `--proposed-stroke`) —
`ElevationBoard` doesn't carry this either (flagged separately in the
elevation gap analysis). Fix both surfaces from the same token pass:
retained mature trees and structures render in the existing-family tone;
new plantings/structures in proposed-family tone. This is the
highest-value, lowest-risk item in this whole proposal — it's a token swap
on already-rendering geometry, not new geometry.

### 2.3 Sun-cast in 3D
`plan-sun-cast.ts` already computes live azimuth/shadow for `CadPlanBoard`
(`data-sun-azimuth`, `sun-shadow` ellipses). None of that reaches the tilt
camera today. Project the same sun vector onto the extruded wall/billboard
geometry (a `boxShadow`/gradient-based CSS shadow on the 3D quads, keyed off
the same azimuth) so a "shade canopy for afternoon sun" placement actually
demonstrates shade in the view operators glance at most. Directly satisfies
CAD-AI-2026-UX's target-loop item 5 ("sun / season / growth scrubbers") for
the sun axis specifically.

### 2.4 Night-scape / lighting toggle
`LightingDock` already places fixtures in plan. Add a day/night state to the
tilt camera (swap `ink`/token theme + render fixture glow at placed
positions) so lighting design has a real preview surface — landscape
lighting is bought on the promise of how a garden reads at 8pm, and today
that promise is entirely unverifiable in-app.

### 2.5 Growth-stage scrub in 3D
The plan already draws Year 1/5/10 canopy/root rings (`STUDIO-PRODUCT-PHASES.md`,
"Workflow 1 §4, shipped"). Wire the same scrub value into `billboardStyle`'s
height/spread inputs so tilt shows the *same* growth stage the plan is
currently scrubbed to — one shared state, two views, not a second slider.

### 2.6 Dwelling fidelity
`TiltBuildingExtrusion` currently renders a flat box to eave height — no
roof pitch, no window/door openings. This matters specifically for
indoor-outdoor and overshadowing legibility (see elevation gap analysis,
same underlying complaint). Scope: a single pitched-roof primitive + simple
rectangular window/door cutouts driven by whatever the trace/footprint
already knows (or a sane default when it doesn't) — not a facade modeller.

---

## 3. 2026 landscape-trend → concrete affordance map

Trends are only listed where §2 already gives them a home — no bullet here
lacks an owning feature above:

| Trend | Concrete affordance | Owning item |
| --- | --- | --- |
| Climate-adaptive / drought-tolerant planting | Sun exposure directly visible per placement | §2.3 |
| Biodiversity & retained-canopy value | Existing vs proposed visually distinct in 3D | §2.2 |
| Extended outdoor-living hours / night gardens | Day/night lighting toggle | §2.4 |
| Honest maturity expectations (no client-flattering renders) | Growth-stage scrub shared with plan | §2.5 |
| Blurred indoor-outdoor living | Window/door openings on dwelling | §2.6 |
| Material honesty (local/recycled) | *Deferred* — needs a materials-texture audit on tilt wall/hardscape faces; not scoped to a concrete change yet, flagged for a follow-up pass once §2.2–2.6 ship |

---

## 4. Explicitly NOT in this proposal

- Editing anything while tilted (Tier B — separate proposal, needs its own
  architecture brief because tilt pointer math is explicitly "never
  inverted into board pointer maths" today; inverting it correctly is the
  actual hard problem, not a checkbox).
- Any bridge to Stage 2's glTF/AR pipeline.
- WebGL, free-orbit camera, true perspective (vs the current orthographic
  axonometric).
- New database fields on `DesignCanvas`.

---

## 5. Suggested sequencing

1. §2.2 existing/proposed tokens (tilt + elevation together — one token
   pass, two surfaces)
2. §2.3 sun-cast projection into tilt
3. §2.5 growth-stage scrub wired into tilt (shares existing plan state)
4. §2.4 day/night lighting toggle
5. §2.6 roof pitch + openings
6. §2.1 dockable/persistent panel (interaction/layout change; sequenced
   last since it's the most disruptive to existing chrome real estate and
   benefits from §2.2–2.5 already making the view worth keeping open)

Each item ships independently with its own gate (typecheck / unit test /
kept e2e per `.cursor/rules/end-of-build.mdc`) — none of them block on the
others.

---

## 6. Open questions for product sign-off before implementation

- Where does the dockable panel (§2.1) live in the chrome layout without
  violating `STUDIO-STYLING-AND-UX.md`'s disappearing-chrome law? (Candidate:
  summoned like `SunGrowthDock`/`ComplianceDock`, not a permanently-on
  panel — needs a decision, not an assumption.)
- Is Tier B (in-tilt editing) wanted at all, or is view-only permanently the
  right ceiling for Workflow 1's 3D story, with Stage 2's glTF pipeline
  being the actual answer for anyone who wants to manipulate a 3D model?
