# Canvas UX strategy — boutique studio canvas (2026)

**From:** Design & Architecture (Claude)
**Date:** 2026-07-27
**Purpose:** Convert the 2026 boutique-canvas UX research into product decisions for the Workstream
studio, marked against what already exists. Companions: `2026-07-27-visual-system-and-library.md`,
`2026-07-27-fit-sheet-render-brief.md`, `2026-07-27-proposal-deliverables-spec.md`.

Legend: **HAVE** (shipped/近 shipped) · **GAP** (build) · **PARTIAL** · **OUT** (out of scope, with reason)

---

## 1. Philosophy — already our direction

The paper's three pillars (cognitive fluidity, ecological integration, professional rigour) and its
central claim — *the canvas is the interface; chrome is contextual* — is the law we've been
enforcing. Validated decisions:

| Principle | Status |
| --- | --- |
| Minimise chrome; tools on summon, not docked ribbons | **HAVE** — command-first placement (⌘K//), auto-collapsing 56px dock, `CameraChrome`, edge chips |
| Warm paper light mode / desaturated charcoal-slate dark | **HAVE** — neutral paper `--surface-base`, `--surface-deep #182838` |
| Restrained selective colour, not high-saturation primaries | **HAVE** — neutral + one signal law |
| Glass/translucent contextual panels | **PARTIAL** — frosted panels exist; feathered-edge glass catalogue is spec'd |
| Subtle feedback (pulse/toast) over harsh error dialogs | **PARTIAL** — toasts exist; see §5 lighting pulse |

---

## 2. Typography + semantic zoom — real gap, fixes a live bug

Paper: geometric sans for UI + serif for annotation; **labels must fade/aggregate on zoom-out and
cross-fade in on zoom-in**, avoiding the "chaotic overlapping text common in legacy GIS/CAD".

- **HAVE:** IBM Plex Sans / Serif / Mono, mono for all numerics.
- **HAVE — semantic zoom for labels.** `resolveAnnotationLod(planZoom)` in
  `geometry/annotationLod.ts`: low zoom keeps boundary + lot area; mid adds
  principal (longest) dims + dwelling/outdoor chips; high adds every decluttered
  edge, species labels, and RL. Soft opacity ramps cross-fade around 0.85 / 2.2
  (aligned with precision CAD skin).

---

## 3. Canvas mechanics

| Feature | Status / decision |
| --- | --- |
| Infinite, borderless canvas | **HAVE** — board is now full-bleed, continuous (slab + neighbour squares removed) |
| Semantic zoom (detail changes with scale) | **HAVE** — annotation LOD §2 (`annotationLod.ts`) |
| Minimap / overview wayfinding | **HAVE** — `StudioMinimap` |
| Artboards as viewports (borderless until active) | **GAP** — would suit multi-sheet sets (plan + sections + schedule laid out spatially) |
| **Vector-raster hybrid** (pressure/tilt/velocity strokes that stay editable vectors) | **PARTIAL / significant** — we have pen + stroke width tiers; true pressure-sensitive natural media (Concepts/Morpholio-class) is a large engine lift. Recommend: hand-drawn *render pen* first (Rough.js, already spec'd) since it delivers the aesthetic without a new input engine |
| Stylus-first gestures (two-finger undo, three-finger overlay toggle, dual-handed nav) | **GAP** — pairs with the on-site/tablet density mode already tokenised (`--tap-min`, `data-density="onsite"`) |

---

## 4. Temporal slider (4D) — highest-value single feature

Paper: landscape is a living medium; static CAD "fails to account for the temporal reality" and
drives overplanting → plant mortality from overcrowding.

- **PARTIAL:** growth stages (`growth`, `GrowthStage`) and a sun/growth dock already exist.
- **GAP:** surface as a **temporal slider** with Year 1 / Year 5 / Year 10 states driving canopy
  spread, shadow, and root zones — and, critically, **flag canopy collision / root competition at
  Year 10** so the designer can retro-space. That collision warning is the feature that prevents a
  real, expensive failure mode; it's also the honesty story for clients (see deliverables spec §8).

---

## 5. Services engineering UX — concrete and buildable

**Low-voltage lighting workspace.** Canvas darkens; fixtures placed with visual beam cones and a
Kelvin slider (2700K default); wiring drawn as a spline snapping to paths/trenches.

Engineering the UI must carry:
- Voltage-drop calc from wire gauge (12/2, 14/2) and run distance; size at wattage × 1.2.
- Transformer with a **glowing capacity ring**; enforce the **80% load rule** (max 160W on a 200W unit).
- **On overload: pulse the offending wire run in a warning colour and offer "upgrade transformer" or
  "split circuit" — never a modal error.** This matches our existing "no harsh dialogs" law.

**Smart irrigation.** Hydrozones (grouped by water need) with required application rate; visualise
**distribution uniformity as a heat map** to expose over-watering and dry spots pre-construction.
ET controllers + backflow preventers specified (per deliverables spec §6).

- **PARTIAL:** irrigation zones, service corridors, trenches exist. **GAP:** fixtures with
  photometric beams, transformer load model, hydrozone uniformity heat map.

---

## 6. Sustainability dashboard

**HAVE (partial → live).** Calm utility-drawer sidecar over BoardContext: permeability, canopy,
UHI shade-vs-sealed, irrigation peak draw, peak ET water budget, carbon stock at maturity, open
space, site fall, indicative cut/fill — SITES v2 credit names + UN SDG chips. Measured or absent
(never a comfortable zero); modelled figures always print their assumption. Refetched on save via
`design/board-report`. Still not a primary HUD figure (invisible-engine law).

---

## 7. Rendering + the Atmosphere Palette

- **Hand-drawn hybrid + selective colour:** already the plan (fit-sheet brief §3).
- **NEW and worth taking — "Atmosphere Palette".** Replace the RGB/HEX picker for render colour
  with a **curated pigment palette**: terre verte, yellow ochre, naphtol red, burnt umber, cherry
  blossom, sage. This is a genuinely boutique detail — designers choose pigments, not hex codes —
  and it structurally prevents the garish full-saturation output we're trying to avoid.
- **UE5 (Nanite/Lumen) live sync, path tracing, Beer's-Law water:** **ROADMAP — target, not
  exclusion.** This is the 2026 standard for cinematic interactive client presentation and should be
  the destination. Honest prerequisite: it needs **metre-space survey geometry** (Stage 2), because a
  `%`-coord plane can't feed a real-time 3D engine meaningfully. Sequence: Stage 2 geometry →
  glTF/USD export pipeline → UE5 live-sync viewport (Nanite for dense foliage/topo, Lumen for
  dynamic GI). Keep the phase discipline: photoreal is for **design-development onward**, while
  concept/schematic stays hand-drawn to avoid the "hallucination of finality".

---

## 8. AI — augmentative only (confirms existing law)

The paper's warning matches ours exactly: generative AI hallucinates species that can't survive the
site's zone/soil, and presenting that to a client is a liability event. Adopt:

- **Geometry-aware generation** (ControlNet-style): AI must respect the operator's vector geometry.
- **Ecological parameter constraints:** geolocation + microclimate set *first*; generation
  restricted to the specified native/Curtis palette.
- **Explainable AI + no automation bias:** ghosts propose, human confirms — **HAVE** (Accept/Reject
  ghost law, zero-mock policy).
- Human refinement loop after any AI pass — keeps output from reading "soulless and generic".

### 8.1 The AI-aware canvas — we are already in this space

**Correction (verified in code).** Workstream is **board-aware, not prompt-scoped**. `apps/api/src/routes/design-assist.ts`
serialises the whole active board to the model on every assist call:

- the entire canvas — **all** placements + `site_frame` (boundary, easements, services)
- `sketch_brief` — `formatSketchBriefForAi(canvas, symbols, survey, address)`, a formatted brief of
  the complete board rather than a selected object
- the full symbol catalogue (`symbol_ids`)
- survey geometry + ground span (real metres), lat/lng, scale
- **derived intelligence**: `compliance_summary`, `shade_summary`, `sun_hours` (`buildAssistSiteIntel`)
- easement/service counts, Tier-1 flag

Plus the surrounding AI system already reasons over board state: `studioAiEngine` ghosts,
`markStaleGhostsNearEdit` (edit-aware invalidation), canopy cluster detection from the aerial, and
`runSpatialCorrection` NLP. So the canvas reads and reasons about the active board — the 2026
pattern — and it does it with HITL confirmation, which most tools don't.

**The remaining delta is cross-artefact breadth, not awareness.** Not yet in the context payload:

| Missing from board context | Why it matters |
| --- | --- |
| `growth` / temporal stage | Can't reason "at Year 10 this canopy closes over the terrace" |
| Levels / spot heights, trenches, BYDA assets, keyless overlays | Grade, dig and overlay conflicts invisible to the model |
| Quote lines / costing | Can't say "the quote still prices turf under that canopy" |
| Sheet composition | Can't advise on deliverable completeness |

**Action:** extend the existing assist payload to a full **board context contract** (one versioned,
token-efficient snapshot) rather than building awareness from scratch. Keep the current laws:
proposals arrive as ghosts / horizon cards with Accept / Not now, never silent mutation, and each
claim should cite the artefacts it reasoned over (provenance guards against automation bias).

### 8.2 Board context contract — the concrete build

**Diagnosis.** `formatSketchBriefForAi` (`packages/domain/src/sketch-brief.ts`) is genuinely
board-wide but **flat**: per asset it emits label, category, count, `%` positions, SKU, description,
plus garden area and a stroke count. It cannot express *dimension, time, level, system, or cost* —
so the model can describe the board but not reason about consequence. That's the actual ceiling.

**Contract** (`packages/domain`, versioned + unit-tested, no server import — see build boundary):

```
BoardContext v1 {
  meta:      { project_id, address, council, pfi/spi, lat, lng, scale_m, mode, phase }
  geometry:  { boundary[], building[] + buildingSource, lot_m2, outdoor_m2, coverage_pct,
               levels[] (RL spot heights), datum }
  planting:  [{ code, species, category, count, x, y, scale, rotation,
                mature_spread_m, height_m, dbh_m?, growth_stage_now }]
  surfaces:  [{ type, area_m2, material, permeable? }]
  systems:   { irrigation_zones[], services[], trenches[], byda_assets[],
               lighting_fixtures[]?, easements[] }
  overlays:  { keyless[] (heritage/flood/bushfire/TRP), zoning, tpz[] }
  climate:   { sun_hours, shade_summary, sun_date_preset, growth_stage, orientation }
  compliance:{ flags[], permeability_target, canopy_target, setback_state }
  commercial:{ quote_lines[] (label, qty, unit, total), subtotal, margin_pct, total_incl_gst }
  sheet:     { paper, scale_denom, pen, theme, widgets[], elevations_chosen[] }
  provenance:{ source per block — vicmap | operator | derived | seed }
}
```

**Why each addition earns its tokens** — every field below unlocks a class of inference the model
cannot currently make:

| Addition | Unlocks |
| --- | --- |
| `mature_spread_m` + `growth_stage` | Year-10 canopy closure, overshadow, root competition, overplanting |
| `levels` + `datum` | Grade/fall reasoning, drainage direction, retaining need |
| `trenches` / `byda` / `easements` | Dig conflicts, "confirm locate before excavation" |
| `overlays` (heritage/TRP/flood) | Permit foresight tied to actual geometry |
| `surfaces.permeable` + targets | Live permeability/coverage compliance advice |
| `quote_lines` | Design↔cost cross-checks ("turf priced under a Year-10 canopy") |
| `sheet` | Deliverable completeness ("no rear-boundary elevation for a turnkey set") |
| `provenance` | Model can distinguish Vicmap fact from operator sketch from seed — prevents confident nonsense |

**Operator decision (2026-07-27): context-aware over context-reduced.** Where fidelity and token
economy conflict, **ship fidelity** — send the full board rather than a lossy digest. Rationale: the
whole value is consequence-reasoning, and that dies first when arrays get capped or geometry gets
rounded away. Practical guards that *don't* cost fidelity: no duplicated data (reference by code, not
repeated blobs), stable key order for cache reuse, `provenance` so the model can weight what it's
reading, and telemetry on payload size so growth is visible rather than surprising.

**Discipline.** Version the contract (`v1`) and snapshot-test it; derive nothing the client can't
verify; build it in `packages/domain` so it's testable without a server; pass it through the existing
server-action path (never import `lib/api` client-side).

**Payoff order:** ship the contract → richer assist answers immediately → then the proactive
cross-artefact findings (§8.1) → then it doubles as the data source for the sustainability dashboard
(§6) and the liability overlay (§9), both of which need whole-board state anyway.

---

## 9. Phase manager + liability overlay — strong professional additions

**Phase manager (GAP).** Structure the workspace by ASLA/SILA stage, so tool availability and
expected detail match the phase: 1 Concept → 2 Design development → 3 Construction docs →
4 Tendering → 5 Construction admin → 6 Post-occupancy. We already gate chrome by mode; this is the
project-lifecycle equivalent and would map cleanly onto our existing project statuses.

**Liability overlay on export (GAP, high value / low effort).** On export, auto-prompt the
disclaimers the drawing's content implies:
- **Maturity watermark** — "visualisation depicts Year 5/10 maturity; installation uses immature stock".
- **Design-intent + subsurface** — no liability for unforeseen subsurface conditions, utility
  conflicts, or contractor deviation.
- **TPO prompt** — if a tree removal is marked, prompt the client-responsibility waiver to verify no
  protection order. (We already ingest urban-tree + TPZ data, so we can trigger this from geometry.)
- **Safety waiver** — if a recommended barrier/handrail is removed at client request, generate a
  Notice of Disclaimer.

This is duty-of-care automation — it protects the practice and is a genuine differentiator over a
drawing tool.

---

## 10. Interoperability, digital twin, AR

| Item | Decision |
| --- | --- |
| Reference manager; hot-linked DWG / RVT / IFC with update **pulse** on change | **GAP** — Stage 2 adjacent; the *pulse-on-external-change* UX is worth adopting whenever we add refs |
| Rhino / SketchUp / point clouds (drone photogrammetry, LOD streaming) | **OUT** for Workflow 1 (Stage 2 / survey-grade) |
| Digital twin + IoT telemetry (soil moisture, thermal comfort, sediment) | **ROADMAP — core to the 2026 thesis.** Landscape is becoming climate infrastructure, so a live model that lets the designer *test and tune* microclimate and blue-green performance is the destination, not a nicety. Path: (1) **now** — client WebGL portal with time-of-day scrub, lighting toggle, material switch (share/portal + existing sun-cast); (2) **next** — telemetry ingest schema (soil moisture, thermal comfort, flow) with a `Live telemetry` canvas toggle; (3) **then** — performance alerts (sediment buildup, vegetation stress) driving proactive maintenance. Ties directly to the sustainability dashboard (§6) — the twin is what makes those metrics *measured* rather than modelled |
| AR with model-based occlusion (chroma-key against city twin, IoU-measured) | **ROADMAP** — depends on the same Stage 2 metre geometry + twin. Highest-value slice is on-site bird's-eye overlay for stakeholder consensus |

---

## 11. Forks needing an operator decision

1. **UI accent semantics.** The paper proposes multi-hue *functional* UI colour (cherry = active
   selection, sage = ecological layers). That conflicts with our locked law: chrome is neutral + one
   signal (orange), and hues carry *canvas* meaning (crimson = existing, cobalt = proposed, greens =
   planting) with WCAG-checked pairs. **Recommendation: keep our law** — multi-hue chrome would
   collide with plan semantics and undo the "flash of colour amongst blue-grey feathers" restraint.
   Adopt the paper's pigment idea only where it belongs: the **Atmosphere Palette for renders** (§7).
2. **Selective render accent — muted cherry vs pale blue.** Still open from the deliverables spec.
   Proceeding on **cherry as default** (fits Curtis house style: hornbeam, bluestone, terrace) with
   **pale blue as the alternate** for water-led or tight courtyard sites. Say the word to flip.
3. **Stylus/tablet as first-class input?** Full gesture + pressure-sensitive natural media is a large
   engine investment. Recommendation: ship the **on-site density mode** (done) + hand-drawn render
   pen now; defer the raster-media engine until there's real tablet demand.

---

## 12. Recommended build order (highest value first)

1. **Semantic zoom for labels** (§2) — fixes a live legibility bug, cheap.
2. **Board context contract** (§8.1) — the AI-awareness foundation; also unlocks 6 and 9.
3. **Liability overlay on export** (§9) — low effort, protects the practice, differentiating.
4. **Temporal slider + Year-10 collision warning** (§4) — builds on existing growth model.
5. **Hand-drawn pen + Atmosphere Palette** (§7, fit-sheet brief) — the aesthetic win.
6. **Lighting workspace** (§5) — beams, transformer 80% rule, pulse-not-dialog.
7. **Sustainability dashboard** (§6) — shipped: UHI / ET / cut-fill on BoardContext sidecar.
8. **Client WebGL portal** — shipped on `/share/[token]`: sun scrub, lighting toggle, Atmosphere switch (digital-twin step 1).
9. **Board-level AI reasoning** on top of 2 — shipped: cross-artefact findings with provenance, gaps surface, Show on board, site_compliance + overlay_watch.
10. **Phase manager** (§9), irrigation uniformity heat map.

**Stage 2 track (unlocks the rest of the 2026 standard):** metre-space survey geometry →
glTF/USD export → **UE5 live-sync (Nanite/Lumen)** → telemetry ingest → **live digital twin** → AR
with occlusion. Each depends on the one before; metre geometry is the gate.
