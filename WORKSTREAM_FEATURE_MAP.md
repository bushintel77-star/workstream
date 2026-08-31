# WORKSTREAM FEATURE MAP

> **Generated:** Read-only scan of the Workstream monorepo.
> **Scope:** `@workstream/contracts`, `@workstream/domain`, `@workstream/cad`, `@workstream/db`, Zustand stores, R3F render layers, Fastify API routes, Next.js proxy routes.
> **Purpose:** A complete inventory of every major feature, domain entity, algorithm, integration, UI tool, and 3D render layer currently supported by the platform.

---

## Table of Contents

1. [Domain Entities (The Contracts)](#1-domain-entities-the-contracts)
2. [Domain Math & Algorithms](#2-domain-math--algorithms)
3. [External Integrations](#3-external-integrations)
4. [UI Modes and Tooling](#4-ui-modes-and-tooling)
5. [R3F Render Layers](#5-r3f-render-layers)
6. [Architecture Summary](#6-architecture-summary)

---

## 1. Domain Entities (The Contracts)

Source: `packages/contracts/src/schemas/` — 42 schema modules re-exported from `index.ts`.

### 1.1 Project / Client / Jobs

- **Project** — `project.ts`
  - Landscaping job with address, lat/lng, status pipeline, CRM stage (`enquiry`/`quote_sent`/`won`/`lost`), client name/email, soft-delete.
  - `ProjectStatus`: draft → complete lifecycle state machine.
  - `CreateProjectInput`, `UpdateProjectStatusInput`, `UpdateProjectClientInput`.
- **StageLog** — `stage-log.ts`
  - Pipeline gate execution record with findings, guards, pass/fail, error.
  - `StageFinding` (one assertion), `StageGuard` (numeric threshold).
- **Task** — `task.ts`
  - Job task with priority (`low`/`medium`/`high`/`critical`), status (`pending`/`in_progress`/`blocked`/`done`/`cancelled`), source (`manual`/`dictation`/`design`).
- **Recording** — `recording.ts`
  - Voice recording + Whisper transcription with confidence and DIL consent.
- **ProjectFile** — `project-file.ts`
  - Uploaded file typed by kind: `plan`, `design`, `site_photo`, `permit`, `reference`, `byda`, `council_drain`, `other`.
  - `GalleryItem` — normalised gallery entry.
- **ProjectSignoff** — `signoff.ts`
  - Durable sign-off record with revision, accepted notice IDs, quote total, signed-at/by.
  - `SignoffReadiness` — pre-share readiness check with missing reasons.
- **ActivityEvent** — `activity-event.ts`
  - Operator audit log for destructive/reversible actions (project deleted, design merged, etc.).

### 1.2 Site Survey / Topography / Boundaries

- **Survey** — `survey.ts`
  - Initial site survey: aerial URI, title/house/garden GeoJSON polygons, lot/house/garden areas, measurements (edge length + bearing), site photos.
- **SiteBoundary** — `site-boundary.ts`
  - Survey-grade title boundary in metre-space with vertices (AI-generated / human-edited / GIS parcel), geo-reference (EPSG:4326), metrics (area, perimeter, AI confidence).
  - `BoundaryAutoTraceResponse` — Vicmap auto-trace result: boundary, building, easements, urban trees, neighbour buildings.
  - `KeylessHydrateResponse` / `KeylessHydrateOverlay` — keyless Vicmap overlay hydration.
- **SiteContext** — `site-context.ts`
  - Live site context: season, sun (sunrise/sunset/angles), planning badges, weather note.
- **SiteEnvelope** — `site-envelope.ts`
  - Fused growing-conditions summary: seasonal sun, planting sun class, wetness, slope, acid sulfate, native vegetation.
- **DesignSiteFrame** — `catalog.ts`
  - Durable %-space site frame: boundary, building, easements, services, levels (spot RLs), drainage runs, BYDA assets, keyless overlays, neighbour buildings, board width, north bearing, machine access override.

### 1.3 Building Footprints, Setbacks & Legal Boundaries

- **SetbackLine** — `catalog.ts`
  - Legal setback line: ID, board-% points, label. Rendered as red dashed non-build zone.
- **BuildingFootprint** — `catalog.ts`
  - Uneditable 3D house mass: ID, board-% points, `height_m`, label. Extruded in R3F.
- **DesignNeighbourBuilding** — `catalog.ts`
  - Adjacent building footprint with height, storeys, source (vicmap/traced/assumed).
- **DesignKeylessOverlay** — `catalog.ts`
  - Vicmap/DELWP overlay: kind (`planning`/`bushfire`/`contour`/`flood`/`heritage`/`easement`/`urban_tree`/`water_corp`/`road_casement`/`acid_sulfate`/`wetland`/`native_vegetation`), rings, label.

### 1.4 Subsurface Utilities / BYDA / Services

- **DesignBydaAsset** — `catalog.ts`
  - Underground utility: kind (`sewer`/`stormwater`/`water`/`gas`/`power`/`nbn`/`other`), ring, source (byda/traced/assumed), depth, tolerance.
- **ConstructionTrench** — `catalog.ts`
  - Landscape trench/conduit: kind (`irrig_main`/`irrig_lateral`/`lighting_conduit`/`drainage`), points, depth_mm, source (auto/traced).

### 1.5 Irrigation / Hydrology / Drainage

- **IrrigationZone** — `catalog.ts`
  - Irrigation/lighting/agg-drain zone: kind (`drip`/`lighting`/`lighting_conduit`/`spray`/`agg_drain`), points, emitter spacing/flow, pipe diameter, Hazen-Williams C, fixture spacing, wire gauge, transformer VA.
- **SiteWetnessSummary** — `site-envelope.ts`
  - Wetness class with evidence drivers.

### 1.6 Hardscape / Paving / Structures

- **AssemblyRecipe** — `assembly-recipe.ts`
  - Paving build-up recipe: layers (surface/bedding/base/excavation) with depth, SKU, role.
- **LandscapeFeature** — `landscape-feature.ts`
  - Drawn landscape region (bed, path, structure): geometry (polygon/point/line), material fill, procedural scatter, labor profile, extrude height.
  - `MaterialFill` — volumetric surface material with waste allocation.
  - `ProceduralScatter` / `ScatterInstance` — brush-generated mass-planting.
  - `LaborProfile` — base difficulty tier, install hours, labor cost.
  - `BrushRecipe` — procedural brush with scale, rotation, copy flags.
- **SpatialObject** — `orchestration.ts`
  - Universal spatial node in the live BOM/scene graph: layer (`hardscape`/`softscape`/`irrigation`/`lighting`/`topography`/`structure`/`other`), area/length/depth/height/volume/count.
- **CadDocument** — `cad.ts`
  - Metre-space DXF-exportable CAD document with discriminated entities (line, polyline, circle, arc, text, insert, dimension), blocks, layers.

### 1.7 Planting / Botanical / Species

- **PlantPalette** — `plant-palette.ts`
  - Curtis-approved species: mature height/width, category, form, climate zones, spacing, pot size, sun exposure, water needs, growth rate, evergreen, native, drought tolerant, flowering, hardiness.
- **CatalogSymbol** — `catalog.ts`
  - CAD-style library symbol: category (`planting`/`paving`/`structure`/`water`/`annotation`/`furniture`/`lighting`), path_d, botanical name, sun/water/soil, mature height, default width, rate card SKU.
- **ZonePlanting** — `design.ts`
  - Planting BOM line: species, common name, count, form, SKU.
- **DesignProposal** — `design.ts`
  - Design zones with plantings, hardscape, lighting, irrigation lines.

### 1.8 Canvas / Sketches / Strokes / Drawing

- **DesignCanvas** — `catalog.ts`
  - Central persisted studio canvas: placements, strokes, irrigation zones, construction trenches, annotations, image layers, photo elevations, features, site frame, presentation pack, lifecycle phase, canvases (sketch planes), setback lines, building footprints, artboard IDs.
- **CanvasStroke** — `catalog.ts`
  - Freehand or precision stroke: points, color, width, nib, telemetry, vector, hatch, kind, shape tool, extrude height, canvas ID.
- **SketchCanvas** — `catalog.ts`
  - Oriented 2D sketch plane in world space: label, position [x,y,z], rotation quaternion, season tag.
- **CatalogPlacement** — `catalog.ts`
  - Symbol instance on the board: symbol ID, x/y %, rotation, scale, label, height, canopy radius, source.
- **ImageLayer** — `catalog.ts`
  - Imported photo/plan underlay: URI, natural aspect, position, width, rotation, opacity, visible, locked, blend mode, capture date.
- **CanvasAnnotation** — `catalog.ts`
  - Hand-lettered plan note with anchor and note position.
- **GhostPlacementSuggestion** — `catalog.ts`
  - Ephemeral AI placement suggestion with confidence and reason.

### 1.9 Photo Elevations / Photogrammetry

- **PhotoElevation** — `catalog.ts`
  - Pinned calibrated site-photo plane: azimuth, calibration, centre coords, ground offset, boundary snap, trace strokes.
- **PhotoTraceStroke** — `catalog.ts`
  - Metre-space ink on a pinned photo plane.
- **PhotoMeasurement** — `photo-measurement.ts`
  - Measurements extracted from a site photo via Claude vision: items with value, unit, confidence, reference.

### 1.10 Annotations / Callouts / Findings / Dimensions

- **BoardFinding** — `catalog.ts`
  - Cross-artefact finding: kind (`canopy_conflict`/`dig_conflict`/`permeability`/`quote_mismatch`/`sheet_gap`/`site_compliance`/`overlay_watch`/`sediment_buildup`/`vegetation_stress`), severity, title, detail, citations.
- **BoardSustainability** — `catalog.ts`
  - Sustainability read-out with individual metrics.
- **BoardDisclaimer** — `catalog.ts`
  - Drawing-derived duty-of-care notice.
- **CadDimensionEntity** — `cad.ts`
  - CAD dimension line with p1, p2, offset.

### 1.11 Costing / Quotes / Pricing / Rate Cards

- **Costing** — `costing.ts`
  - Design cost estimate: scenario (`lean`/`standard`/`buffer`), line items, subtotal, GST, total.
- **LineItem** — `costing.ts`
  - Cost/quote line: SKU, label, unit, qty, rate, total, provisional flag.
- **RateCard** — `rate-card.ts`
  - Operator price list: category, SKU, label, unit, rate, supplier, effective date.
- **QuoteDoc** — `quote-doc.ts`
  - Persisted quote: overrides, custom lines, margin rules.
- **ShareRevision** — `share-revision.ts`
  - Client share revision: token, status, frozen snapshot (canvas + quote lines), decision.
- **BomLine** — `orchestration.ts`
  - Live BOM line: tier, SKU, label, unit, qty, rate, total, source object IDs, provisional.
- **ProjectOrchestrationWorld** — `orchestration.ts`
  - Live orchestrated world: fingerprint, multipliers, spatial facts, live BOM, subtotal/GST/total, risks, overlays.

### 1.12 CAD Entities & DXF-ready Documents

- **CadDocument** — `cad.ts`
  - Metre-space CAD document: version, units, origin, width/height, layers, entities, blocks, AI run ID, source sketch ID.
- **CadEntity** — discriminated union: line, polyline, circle, arc, text, insert, dimension.
- **CadOp** / **CadOpsBatch** — deterministic CAD operations (add/delete/replace).
- **CadGenerateRequest** / **CadEditRequest** / **CadAcceptRequest** — AI CAD generate/edit/accept.
- **CadSyncManifest** / **CadSyncAsset** — UE5/external live-sync manifest.

### 1.13 Presentation / Documentation Outputs

- **DocumentationPackage** — `documentation-package.ts`
  - Issued documentation pack: schedules (planting/trench/lighting/material), presentation document IDs, quote total, issued-at.
- **PresentationDocument** — `presentation-document.ts`
  - Multi-page presentation deck: deliverable type, template, theme, status, pages, estimate snapshot.
- **PresentationPage** / **PresentationPanel** — discriminated panel types (plan crop, image, widget, text, swatch board).
- **PresentationPack** / **PresentationWidget** / **PresentationTheme** — fit-sheet theme/widgets.
- **Output** — `output.ts`
  - Generated deliverable: kind (`quote`/`schedule`/`brochure`/`permit_stonnington_stormwater`/`handover_pack`/`supplier_order`/etc.), URI, generated-at.

### 1.14 VCS / Branches / Merge

- **DesignBranch** — `design-branch.ts`
  - Named design VCS branch: base revision, tip revision, status (`open`/`merged`/`abandoned`).
- **DesignRevision** — one commit-like revision on a branch with canvas snapshot.
- **CreateDesignBranchInput** / **CommitDesignBranchInput** / **MergeDesignBranchInput** / **DesignBranchCheckout**.

### 1.15 Integrations (MYOB / Xero / Webhooks)

- **IntegrationEvent** — `integration-event.ts`
  - Log of external-channel event: channel (`crm`/`email`/`stripe`/`myob`/`xero`/`anthropic`/`openai`/`datavic`), event type, OK flag.
- **MyobCustomer** / **MyobItem** / **SkuLink** / **ProjectMyobLink** / **MyobSyncStatus** — `myob.ts`
  - MYOB AccountRight entities and sync status.
- **XeroContact** / **XeroItem** / **XeroSyncStatus** — `xero.ts`
  - Xero contact/item/sync status.

### 1.16 Workspace / Licensing / Crew

- **WorkspaceLicense** — `workspace.ts`
  - License: plan (`lite`/`studio`), seat limit/used/available, live integrations, Stripe fields, members.
- **WorkspaceMember** / **WorkspaceBilling** / **IntegrationSummary**.
- **CrewMember** — `crew.ts`
  - On-site crew: name, role (`lead`/`senior`/`tradesperson`/`apprentice`/`labourer`/`subcontractor`), hourly rate, active.
- **CrewAssignment** — time tracking of crew on tasks.
- **OperatorPlantMachine** / **OperatorPlantProfile** — `operator-profile.ts`
  - Operator plant/equipment access profile (bobcat, mini loader, etc.).
- **ResourcePool** / **LeftoverStock** — `resource-pool.ts`
  - Cross-job leftover material stock.

### 1.17 Audit / Verification / Signoff

- **VerificationState** — `verification.ts` (`UNVERIFIED`/`VERIFIED`).
- **Audit** — `audit.ts`
  - Design audit: findings (severity, category, location, statement, suggested action), blocking/advisory counts, pass.
- **Override** — operator override of an audit finding.

### 1.18 Voice / AI / Design Assist

- **VoiceIntentRequest** / **VoiceIntentResponse** — `voice-intent.ts`
  - Voice/typed intent classification with design reply and events.
- **DesignAssistRequest** / **DesignAssistResponse** — `catalog.ts`
  - NL sketch assist request and prose + ghost suggestions.
- **SketchToCadRequest** / **SketchCadSuggestion** / **SketchToCadResponse** — sketch-to-CAD translation contract.

### 1.19 Site Telemetry & Board Coordinates

- **BoardPct** / **BoardPointPct** — `board-coords.ts`
  - Bounded 0–100 board coordinate system.
- **TelemetryReading** — `board-telemetry.ts`
  - Sensor sample: kind (`soil_moisture`/`thermal_comfort`/`flow`/`sediment`), value, unit, position, source (`sensor`/`demo`/`manual`).

### 1.20 Catalog Admin & Custom Symbols

- **CreateCatalogSymbol** / **CustomCatalogSymbol** — `catalog-admin.ts`
  - Operator-uploaded SVG symbol with category, path_d, rate card SKU.

### 1.21 Miscellaneous

- **ImageContactScan** — `image-contact.ts` — contact details read from a photo (card, title block, sign).
- **ScanChoreography** — `scan-choreography.ts` — ordered site-truth reveal animation script.

---

## 2. Domain Math & Algorithms

Source: `packages/domain/src/` and `packages/cad/src/`.

### 2.1 Earthworks, Volumetric & Cut/Fill

- **`volumetric-isolith.ts`** — Bank→loose volume conversion with material-specific bulking factors (1.25 topsoil, 1.15 crushed rock, 1.6 excavated clay); truck-load conversion; procedural concentric stockpile ring radii.
- **`contour-levels.ts`** — Inverse-distance-weighted (IDW) elevation interpolation from Vicmap contour polylines; contour-interval accuracy estimation.
- **`buildable-area.ts`** — Planar polygon setback/buffer offset; sequential Turf boolean difference; per-exclusion area attribution. Computes where you can build after subtracting setbacks, house, easements, BYDA assets, TPZ, and planning overlays.
- **`outdoor-area.ts`** — Shoelace area with holes; sequential Turf difference of subtractor rings; true garden/workable area calculation.
- **`cad-quantities.ts`** — Per-entity geometry measurement (length, area, arc length) by CAD entity kind; one-click quantity take-off.

### 2.2 Hydrology, Drainage & Irrigation

- **`hydrology.ts`** — Hazen-Williams pressure-drop and velocity for pipe runs; irrigation/drainage pipe sizing.
- **`drainage-runs.ts`** — Spot-level sorting by RL; fall % segmentation; adverse-run detection.
- **`irrigation-uniformity.ts`** — Spray-head placement along polylines; grid-sampled relative precipitation; lower-quartile Distribution Uniformity (DU) and Christiansen CU.
- **`irrigation.ts`** — Flow/emitter/valve arithmetic from zone specs; line-item quantity generation.
- **`irrigation-assist.ts`** — Heuristic auto-placement and live estimation of irrigation/lighting assist runs.

### 2.3 Photogrammetry, AR & Point-Cloud Tools

- **`spatial/photoCalibrator.ts`** — Closed-form cross-ratio horizon solve; projective camera calibration; bounded bisection for camera height from a vertical landmark.
- **`spatial/raycastGround.ts`** — Pinhole ray→ground-plane intersection; pose yaw rotation; board-% coordinate mapping. Projects traced photo pixels into the plan.
- **`ar-birdseye.ts`** — Shoelace area; grid-sampled polygon intersection; IoU alignment score; footprint occlusion classification for AR overlays.
- **`elevation-projection.ts`** — 1D plan→elevation axis projection by cardinal look; bar-width clamping; maturity-height scaling for elevation profile sheets.

### 2.4 Sun, Shadow & Solar

- **`site-environment.ts`** — Solar declination; spherical sun altitude/azimuth; Melbourne daylight-saving offset; sunrise/sunset hour-angle; board shadow vector; azimuth normalization.
- **`plan-sun-cast.ts`** — Trigonometric shadow length from solar altitude; opposite-sun vector; polygon extrusion for footprint shadows; canopy polygon approximation.
- **`shade-grid.ts`** — Grid-based indicative shade/sun-hour sampling across the site for planting-envelope analysis.
- **`solar-window.ts`** — Solar declination and day-length equations at a given latitude.
- **`apply-shadow-alt.ts`** — Rule-based shadow alternative application.

### 2.5 Site, Boundary & Coordinate Transforms

- **`site-boundary.ts`** — Equirectangular geo→metre projection; polygon area/perimeter; vertex edit/snap/insert/delete with geo sync. Maintains the title boundary source of truth.
- **`canvas-geometry.ts`** — Percent↔metre transforms; shoelace area; ray-casting point-in-polygon.
- **`hybrid-plane.ts`** — Dual canvas-% / physical-metre planes; Ramanujan ellipse perimeter; axis-aligned footprint ring.
- **`spatial-turf.ts`** — Turf boolean difference and buffer in WGS84; largest-ring selection; inward setback. Cuts the title parcel down to the designable garden canvas.
- **`site-plan-projection.ts`** — Ring centroid; fit-to-view scaling; SVG path generation.
- **`site-overlays.ts`** — Easement corridor offset; point-in-ring tests.

### 2.6 Custom Geometry, Polygon & Boolean Operations

- **`geometry.ts`** — Equirectangular projection; shoelace area; edge length and bearing; bounding box; polygon subtraction.
- **`spatial/canvasStitcher.ts`** — Polyline snapping/merging within an epsilon; node collection; layer-conflict resolution; stitch/unstitch records. Joins freehand strokes into clean connected CAD polylines.
- **`stroke-recognize.ts`** — Heuristic stroke classification by geometry metrics (length, aspect, closure). Recognizes whether a sketch stroke is a path, bed, deck, etc.
- **`tidy-sketch.ts`** — Douglas-Peucker-style point decimation for sketch strokes.
- **`rectangle-completion.ts`** — Heuristic rectangle completion from partial strokes.
- **`studio-strokes.ts`** — SVG `path` `d` generation from stroke points.

### 2.7 Buildable Area, Compliance & Regulations

- **`studio-preemptive-compliance.ts`** — Council-specific setback rules (Melbourne councils); buildable envelope; point-snap; compliance scoring; disc-overlap approximation.
- **`site-compliance.ts`** — Permeability and canopy percentage compliance arithmetic.
- **`rescode-canopy.ts`** — ResCode A2-6 canopy tree requirement (`ceil(siteArea/100)`); maturity gate (≥6 m height, ≥4 m width).
- **`as4970-protection-zones.ts`** — AS 4970-2025 NRZ (`12×DBH`) and SRZ (`(D×50)^0.42×0.64`) calculations; encroachment tiering for existing tree protection.
- **`tpz-geometry.ts`** — Board-% to lot-metre circle conversion; 32-segment circle ring in lng/lat for tree protection zones.

### 2.8 Planting, Botany & Canopy

- **`mass-plant.ts`** — Triangular (staggered) grid density `1/(s²·sin(π/3))`; point-in-polygon placement. Calculates how many plants fit in a mass-planting bed.
- **`planting-envelope.ts`** — Fuses shade-grid sun hours, wetness drivers, slope, soil and EVC into a site envelope; scores palette fit.
- **`planting-palette-filter.ts`** — Sun-hour/aspect/soil tag matching and palette filtering.
- **`flora-suggestion.ts`** — Multi-factor flora ranking with sun-hour and canopy-neighbor inputs. Suggests best Curtis-palette plants for a specific spot.
- **`garden-asset-height.ts`** — Catalog symbol → mature height/spread/family mapping.
- **`garden-size-ladder.ts`** — Size-ladder classification and nearest-step lookup for pricing.
- **`urban-tree-ghosts.ts`** — Canopy-radius to glyph-scale mapping; existing-tree ghost generation.
- **`growth-temporal-rings.ts`** — Growth-stage scaling (0.75 overlap, 0.55 root/canopy); temporal ring builder showing how a plant grows over time.
- **`canopy-clusters.ts`** — Image-data canopy cluster detection from aerial/drone imagery.
- **`plant-climate-cues.ts`** — Frost/heat risk classification from temperature thresholds.
- **`plant-rules.ts`** — Blocklist validation; rejects off-palette or prohibited species.
- **`planting-place-guard.ts`** — Placement conflict checks; warns if a plant is too close to a constraint.

### 2.9 Costing, Quote & BOM

- **`costing.ts`** — Line totals, subtotal, 10% GST, contingency. Standard Australian quote arithmetic.
- **`resolve-quote.ts`** — Regex section classification; margin by section/global; override matching; orphan override detection; GST totals. Turns a live estimate into a client-ready quote.
- **`sketch-costing.ts`** — Sketch-symbol quantity and line-item rollup for quick rough costing.
- **`live-trade-sourcing.ts`** — Trade-tier cost solving and Melbourne cost-index adjustment for live trade-pricing bands.
- **`resource-pool.ts`** — Pack-size rounding; leftover registration; SKU/label matching. Tracks leftover bulk materials across jobs.
- **`preemptive-bom.ts`** — Pre-emptive BOM expansion with site multipliers; totals. Builds a bill of materials from a studio drawing before full detailing.
- **`mitigation-bom.ts`** — BOM lines for tree/utility mitigation work.
- **`catalog-quote.ts`** — Placement grouping and quote-section formatting.
- **`supplier-price-overlay.ts`** — Supplier price overlay onto rate cards and quote lines.
- **`carbon.ts`** — Embodied-carbon lookup and total estimation.

### 2.10 CAD Operations, Stamping & Output (`packages/cad/src/`)

- **`stamp-site-frame.ts`** — Board-% to CAD-metre coordinate transform; title/building/easement stamping into a CAD document.
- **`apply-ops.ts`** — Deterministic CAD op application (layers, lines, polylines, circles, arcs, text, inserts, dimensions, offsets); average-edge-normal polyline offset; verification state promotion.
- **`export-dxf.ts`** — ASCII DXF R12 writer for all entity kinds and layers. Exports to AutoCAD/LibreCAD.
- **`export-svg.ts`** — Layer-colour SVG generation; Y-flip and ghost dash/opacity for web preview.
- **`export-gltf.ts`** — glTF 2.0 JSON builder; polyline extrusion, cylinder generation, material buckets, base64 embedded buffer. Exports a lightweight 3D glTF for AR/3D review.
- **`cad-sync.ts`** — Asset collection and sync manifest builder for UE5/Datasmith.
- **`import-sketch.ts`** — Brings interpreted sketch strokes into the CAD document.
- **`defaults.ts`** — Default layer set and empty CAD document factory.

### 2.11 Merge / Diff / VCS

- **`design-canvas-diff.ts`** — Entity-by-entity diff using JSON equality and positional tolerance.
- **`design-canvas-merge.ts`** — Three-way merge with `ours`/`theirs`/`both` resolutions; JSON-based conflict detection.
- **`canvas-history.ts`** — LIFO undo/redo stacks with a 40-snapshot cap. (Deleted 2026-08-31 — dead code.)
- **`traceability.ts`** — Traceability rule checking between estimates, quotes and BOMs.

### 2.12 Sketch Recognition & Canvas

- **`sketch-to-cad.ts`** — Stroke metric analysis (length, span, aspect, closure); heuristically maps to Curtis symbols. Turns freehand ink into typed CAD ghost suggestions.
- **`structured-tools.ts`** — Stroke → typed `LandscapeFeature` conversion.
- **`structured-stroke-cost.ts`** — Cost estimation for a structured stroke before it becomes a real placement.
- **`structured-stroke-conflict.ts`** — Utility corridor conflict checking for strokes.
- **`canvas-snap.ts`** — Grid snapping and drag-constraint math.

### 2.13 Operations, Scheduling & Logistics

- **`ops-schedules.ts`** — Schedule generators for planting, trenching, lighting, materials and supplier orders; CSV rendering.
- **`auto-trench.ts`** — Trench auto-routing and line-item generation.
- **`machine-access.ts`** — Machine-access band calculation and labour multipliers. Determines whether a mini-excavator, dingo or barrows can reach each area.
- **`landscape-services.ts`** — Service zone proposal (irrigation/lighting) from placements.
- **`instant-planner.ts`** — Labour-hour summation and formatting for quick scheduling.
- **`schedule-callouts.ts`** — Schedule callout placement and acceptance on the plan.
- **`establishment-calendar.ts`** — Plant establishment/maintenance calendar builder.

### 2.14 AI / Assist / Suggestion

- **`studio-ai-assist.ts`** — Context-aware AI suggestion builders for next design moves, saves and ghost placements.
- **`studio-ai-prompt.ts`** — Symbol→compliance mapping; site-intel builder; system-prompt assembler.
- **`studio-assist-parse.ts`** — Parses structured LLM responses into typed canvas actions.
- **`studio-planning-todos.ts`** — Design-todo encoding/parsing, planning assessment and diffing.
- **`planning-context.ts`** — Address→municipality detection; planning flag assessment.
- **`ghost-confidence.ts`** — Multi-factor confidence scoring for AI ghost suggestions (drainage, sun/shadow, growth, category).
- **`stale-ghosts.ts`** — Proximity-based ghost staleness marking.
- **`voice-intent.ts`** — Rule-based voice transcript classifier.

### 2.15 Site Context, Board & Twin Data

- **`board-context.ts`** — Aggregates project data into a board context; gap analysis.
- **`board-context-studio.ts`** — Studio board context builder and AI formatter.
- **`board-telemetry.ts`** — Telemetry unit handling and board point mapping.
- **`board-twin-alerts.ts`** — Threshold-based twin performance alerts.
- **`board-sustainability.ts`** — Sustainability scoring and AI formatting.
- **`board-findings.ts`** — Path-crossing detection; finding builder for design issues (clashes, missing data).
- **`board-liability.ts`** — Disclaimer generation for liability/duty-of-care notes.
- **`spatial-facts.ts`** — Spatial fact extraction and merging from canvas/CAD into a canonical spatial truth snapshot.

### 2.16 Presentation, Sheets & Output

- **`sheet-presentation.ts`** — Fit-sheet widget layout and theme engine with templates, swatches, pens and atmosphere pigments.
- **`fit-sheet-edges.ts`** — Fit-sheet edge rendering.
- **`architectural-title-block.ts`** — Drawing title block builder for CAD exports.
- **`handover-pack.ts`** — Handover document pack assembler.
- **`signoff.ts`** — Sign-off gate resolution and readiness checking.
- **`store-zip.ts`** — In-memory ZIP builder for document packaging.

### 2.17 Other Business Logic

- **`lv-lighting.ts`** — 12 V circuit load, voltage-drop and transformer sizing; Catmull-Rom SVG path; point-to-polyline distance for low-voltage garden lighting.
- **`path-corridor.ts`** — Path width/fillet geometry; corridor ring builder with rounded corners.
- **`hardscape-grammar.ts`** — Hardscape path width/fillet lock sets; enforces standard path widths and fillets.
- **`preemptive-risk.ts`** — Pre-emptive risk heuristic (retaining wall height, drainage area).
- **`studio-preemptive-estimate.ts`** — Studio drawing estimate by area/length zones; material/line generation.
- **`design-schemes.ts`** — Design scheme letter cycling and snapshotting for multiple design options.
- **`design-lifecycle.ts`** — Project phase lifecycle logic; maps project status to allowed design phase capabilities.
- **`resolve-outdoor-area.ts`** — Outdoor-area deduction and reporting for deductible/rebated outdoor living area.
- **`strikeAlert.ts`** — Strike-alert detection for excavations near utility lines.
- **`title-planning-badges.ts`** — Title/planning badge assessment.
- **`spatial/classifySpatialEntity.ts`** — Spatial entity classification and provenance; decides which layer a Vicmap or user entity belongs to.

---

## 3. External Integrations

Source: `apps/api/src/routes/`, `apps/api/src/lib/`, `apps/web/src/app/api/`. 162 Fastify route definitions + 17 Next.js proxy routes.

### 3.1 External Services

| Service | Type | Where Used |
|---|---|---|
| **Clerk** | Authentication | `plugins/auth.ts`, `lib/auth-config.ts` |
| **SQLite** (Node 22 `node:sqlite`, WAL) | Database | `packages/db/src/sqlite-persist.ts`, `plugins/store.ts` |
| **Redis / BullMQ** | Job queue | `lib/queue.ts`, `lib/pipeline-job.ts`, `routes/pipeline.ts` |
| **Local filesystem** (`data/{uploads,outputs,photos,aerial,filings}`) | File storage | `lib/storage.ts`, `routes/protected-files.ts` |
| **Anthropic Claude** | AI/LLM/Vision | `lib/claude.ts`, `lib/dictation.ts`, `lib/voice-intent.ts`, `lib/plan-render.ts`, design-assist/ghosts/sketch-cad/measurements/presentation-dissect routes |
| **OpenAI Whisper** | Audio transcription | `lib/transcribe.ts`, `lib/transcription-job.ts`, `routes/recordings.ts` |
| **Vicmap / DELWP WFS & WMS** | Cadastral, imagery, easements, footprints | `lib/vicmap.ts`, `lib/vicmap-title-search.ts`, `lib/vicmap-address.ts`, `lib/aerial.ts`, cadastral/boundary/geo-hero routes |
| **ArcGIS World Imagery** | Aerial raster export | `lib/aerial.ts` |
| **Nominatim / OpenStreetMap** | Geocoding | `lib/geocode.ts`, `routes/cadastral-title.ts` |
| **Open-Meteo** | Weather / site context | `lib/weather.ts`, `lib/site-context.ts`, weather/site-context routes |
| **Stripe** | Payments / deposits / seats | `lib/stripe.ts`, `lib/stripe-studio.ts`, stripe-webhook/integration-hub/portal routes |
| **MYOB AccountRight** | Accounting / invoices | `lib/myob.ts`, `routes/myob.ts` |
| **Xero** | Accounting / invoices | `lib/xero.ts`, `routes/xero.ts` |
| **Resend** | Email | `lib/email-resend.ts`, `routes/integration-hub.ts` |
| **CRM Webhook (n8n → Zoho)** | CRM push | `lib/crm-webhook.ts`, `lib/integration-dispatch.ts` |
| **Twilio** | SMS / notifications | `lib/notify.ts` (not currently configured) |
| **Sentry** | Error monitoring | `lib/sentry.ts` |
| **OpenTelemetry** | Traces / metrics | `lib/telemetry.ts` |
| **Resvg** | SVG → PNG for Claude vision | `lib/plan-render.ts` |
| **Marked** | Markdown → HTML | `lib/output-generators.ts` |
| **Supplier rate sheets** | Local pricing | `lib/suppliers.ts`, `lib/melbourne-trade-catalog.ts`, `lib/material-orchestrator.ts` |

### 3.2 API Route Categories

- **Health & Auth**: `/healthz`, `/readyz`, protected file serving, Stripe webhook.
- **Projects**: CRUD, stage logs, envelope, client update, status update, delete/restore.
- **Survey & Geo**: survey CRUD, cadastral title (Vicmap + Nominatim), site context (Open-Meteo), weather, boundary CRUD + auto-trace + ingest + lock/unlock, stormwater GeoJSON digitise, geocode preview/search, public hero feed.
- **Design & Canvas**: design proposal, design canvas GET/PUT, AI design assist (Claude), vision ghosts (Claude), sketch-to-CAD (Claude), findings, telemetry, board report, design branches (create/checkout/commit/abandon/diff/merge).
- **CAD**: snapshot, DXF export, glTF export, sync JSON, ensure, ops, generate, edit, accept, quantity survey, build, quote.
- **Costing & Carbon**: costing create/sketch/get, carbon estimate, quote-doc GET/PUT, overrides.
- **Outputs & Presentations**: output generation, presentation pack, presentation documents CRUD + AI dissect + AI format, documentation packages CRUD + issue + ZIP.
- **Field Data**: recordings (Whisper transcription), dictation (Claude), voice-intent classify, aerial upload, site photos CRUD, measurements (Claude vision).
- **Tasks, Crew & Audit**: tasks CRUD, crew CRUD, audit run/get, signoff get/put, activity log.
- **Portal & Share**: magic link, public quote view, public deposit checkout (Stripe), share revisions CRUD, client decision.
- **Accounting**: MYOB status/customers/items/sku-links/invoice, Xero status/contacts/items/invoice.
- **Integrations & Billing**: integration summary, license, hub dashboard, Stripe plan/seat checkout, workspace members, plan upgrade, quote sync to CRM/email.
- **Catalog & Suppliers**: catalog symbols CRUD, supplier aggregate prices, supplier price lists.
- **Pipeline & Orchestration**: pipeline develop/retry/create (Redis/BullMQ), orchestration get/refresh/accept-overlay/dismiss-overlay, keyless hydrate.
- **Schedules**: planting, trench, lighting, material schedules.
- **Settings**: rate card, plant palette, integrations, activity log.
- **Resource Pool**: cross-job leftover material stock.

### 3.3 Next.js Proxy Routes

17 same-origin proxies to the Fastify API (aerial, design-branches, design-canvas, documentation-packages, files, measurements, presentation-dissect/format/documents, recordings, schedules, site-photos). Plus one local mock: `design-canvas/auto-setup` (Phase 7 WFS/AI mock).

### 3.4 Key Findings

- **No Nearmap, Google Maps, or Mapbox in live code.** Aerial comes from ArcGIS World Imagery and Vicmap WMS.
- **No real BYDA / Dial Before You Dig API integration.** `byda_assets` exist in contracts and `stormwater-geojson` is a local digitise helper, but no external BYDA API is called.
- **Claude is the dominant AI provider.** All vision/assist/dictation/measurement paths hit Anthropic.
- **Vicmap is keyless.** DELWP GeoServer WFS/WMS endpoints are used without an API key unless `DATAVIC_API_KEY` is set.
- **Files are local, not S3.** All uploads stored on the Railway volume under `data/`.

---

## 4. UI Modes and Tooling

Source: `studioStore.ts`, `FloatingChrome.tsx`, `StudioToolRail.tsx`, `canvas-mode.ts`, `seasonalStore.ts`.

### 4.1 Canvas Modes (8 progressive modes)

| Mode | Unlocked by | Camera default | Dims armed |
|---|---|---|---|
| `survey` | Always | Plan (0°) | No |
| `sketch` | `hasAerial` | Oblique (55°) | No |
| `cad` | `hasAerial` | Plan/Ortho | Yes |
| `elevation` | `hasAerial` | Oblique (55°) | No |
| `garden` | `hasAerial` | Garden (76°) | No |
| `quote` | `hasCad` | Oblique (55°) | Yes |
| `present` | `hasCad` | Oblique (55°) | Yes |
| `share` | `hasQuote` | — | No |

### 4.2 Studio Tool Rail (18 tools)

| Tool | Key | What it does |
|---|---|---|
| Sketch | `S` | Toggle freehand ink capture |
| Measure | `M` | Two-point tape measure |
| Assets | `A` | Open asset library fan-out |
| Polyline | — | Click-to-place setout line |
| Area | — | Click-to-place closed costable region |
| Marquee | — | Box-select placements + features |
| Tidy | — | Convert strokes to CAD proposals |
| Trench | — | Trace drainage trench |
| Zones | — | Trace irrigation zone |
| Lighting | — | Trace lighting run |
| Underground | `U` | Subsurface blueprint toggle |
| Present | `Shift+7` | Presentation lens |
| Split | — | Plan | 3D split view |
| Dims | `D` | Working-drawing dimensions |
| Section | — | Elevation slice |
| Flow | — | Drainage overland flow |
| Earth | — | Cut/fill earthworks |
| More | — | Show/hide advanced site tools |

### 4.3 Floating Chrome Controls

- **Depth Rail** — vertical pill showing Z header, one cell per `SketchCanvas` (sorted by Z), season tag cycle (`ALL`/`SUMMER`/`WINTER`), Ground cell, Add (+) cell.
- **Toggle Pills**:
  - `HAND` — right/left handedness
  - `MODE` — draft/sketch
  - `XFER` — stroke transfer tool (off / pick source / pick target)
  - `EXT` — extrusion tool (off / pick / set depth) with depth slider 0.1–5 m
  - `GIS` — SYNC SITE TRUTH (sync / fetching / generating / done)
  - `AI` — SETUP (opens SiteSetupModal for PDF upload)
  - `RENDER` — TECH / IMMRSV (Phase 8 post-processing toggle)
  - `VIEW` — ORBIT / WALK (Phase 8 pedestrian camera toggle)
- **Readout** — active plane label, drafting/sketching mode + snap status.
- **Fly-Through Bar** — capture bookmark, bookmark dots, play/stop.
- **Site Setup Modal** — ingests survey PDF + title for AI auto-setup.

### 4.4 Sketch Nibs (4 expressive stylus types)

| Nib | Purpose |
|---|---|
| `graphite-6b` | Soft gesture lines, canopy masses, contour shading |
| `ink-03` | Crisp boundary tracing, setbacks, dimensions |
| `chisel-marker` | Rapid surface zone fills (paving, lawn, decking) |
| `stipple` | Soil, gravel, mulch, soft lawn edges |

Each nib has base width, color, grain, edge softness, bleed, opacity, and telemetry mapping (pressure, tilt, velocity, density, altitude).

### 4.5 Annotation & Communication Tools

- **AnnotationDialect**: `technical`, `architectural`, `creative`, `hybrid`.
- **Per-mode layer toggles** (survey/cad/sketch): `enabled`, `bearings`, `elevations`, `plants`, `materials`, `callouts`, `scope`.
- **Trade pack toggles**: `irrigationDrainage`, `hardscapeConstruction`, `lightingElectrical`.

### 4.6 Store State Categories

- **Temporal/Seasonal**: growth year (0–10), sun minutes, sun date preset, season progress.
- **View/Layer**: subsurface view, suncast view, sketch mode, split view.
- **Elevation Slice**: slice active, axis, position.
- **Terrain Analysis**: drainage view, earthworks view.
- **CAD/Quote/Annotation**: dims view, measure active/tape, fit sheet, annotation layers + dialects, trade packs, excluded estimate lines.
- **Asset Discovery**: assets open, armed symbol, pending drop, area/row plant, mass plant preview, pointer position, placements.
- **History**: undo/redo (50-snapshot cap) covering placements, strokes, photo elevations, features, stitch records, trenches, irrigation zones, canvases, setback lines, building footprints.
- **Flora Ring**: flora session with position, form, active index.
- **Fused Rendering/Camera**: view blend target/live, live rig, elevation active/facade azimuth, chrome receded/peek.
- **Scan Choreography**: scan stage (idle/cadastre/parcels/services/terrain/flora/done).
- **AI Generation Session**: prompt, ghosts, status (idle/thinking/ready/accepted/rejected).
- **Shared Ink**: sketch strokes, sketch canvases, active canvas ID.
- **AI Site Setup**: setback lines, building footprints, AI processing state.
- **Phase 8**: render mode (technical/immersive), camera posture (orbit/pedestrian).
- **Stroke Transfer**: transfer tool armed, source stroke ID.
- **Sketch-to-CAD Extrusion**: extrusion tool armed, selected stroke, active depth.
- **Cinematic Fly-Through**: camera bookmarks, playing flag, live camera position.
- **Photo-Trace Elevation**: photo elevations, trace session (mode: trace/calibrate).
- **Construction Trenches**: trench tool, draft, committed trenches.
- **Irrigation Zones**: zone tool, draft, committed zones.
- **Landscape Features**: features array.
- **Stitch Engine**: snap nodes, hover point, epsilon, records, notice.
- **Sketch→CAD Proposals**: proposals, review open, active proposal, notice.
- **Selection**: selection refs.
- **Precision Drafting**: draft session (tool, vertices).
- **Marquee**: active, draft.
- **Expressive Stylus**: active nib, sun azimuth, live telemetry, sun hatch snap.
- **Spatial Gizmo**: gizmo mode (translate/rotate/scale), dragging.

### 4.7 Keyboard Shortcuts

- `S` — Sketch, `M` — Measure, `A` — Assets, `U` — Underground, `D` — Dims
- `?` — Help, `Cmd/Ctrl+K` — Command palette
- `Cmd/Ctrl+Z` / `Shift+Cmd/Ctrl+Z` — Undo / Redo
- `Esc` — Clear selection / close panels
- `Delete` / `Backspace` — Delete selected (Backspace steps back a draft vertex)
- `1/2/3` — Viewport presets (plan / orbit / garden)
- `Shift+1…7` — Mode shortcuts
- `W/A/S/D` + Arrow keys — Pedestrian camera movement (Phase 8)

### 4.8 Other Major UI Surfaces

- `AiScanOverlay` — AI parsing/scanning stage wash
- `CadProposalLayer` — ghost CAD review
- `PhotoElevationSheet` / `PhotoTraceHud` — photo elevation tools
- `PresentationLens` — present mode filter
- `SaveStatusChip` — autosave status indicator
- `StudioCommandPalette` — `Cmd/Ctrl+K` command palette
- `StudioShortcutsHelp` — keyboard shortcut help
- `SurveySetupPanel` / `SurveyCommunicationCard` — survey + annotation config
- `UnifiedPanel` — right-side inspector/panel
- `PerimeterTabStrip` — mode tabs

---

## 5. R3F Render Layers

Source: `StudioScene.tsx`, `sceneItems.tsx`, and all `.tsx` files in `webgl/`, `webgl/features/`, `webgl/annotations/`.

### 5.1 Scene Assembly

- **`WebGLStudio.tsx`** — wraps the R3F `<Canvas>`, mounts `Environment` (IBL), `StudioScene`, `RenderFX` (post-processing), `ChromeRecedeWatcher`.
- **`StudioScene.tsx`** — the 3D scene graph; 43 layers mounted in a specific render order.

### 5.2 Ground, Terrain & Reference Grid

- **`TerrainMesh`** — displaced `PlaneGeometry` terrain from spot-level heightmaps via IDW interpolation; custom contour-banding + slope-albedo material; shared `createElevationSampler`.
- **`GroundPlane`** (inline) — flat ground for projects with no levels; olive or paper albedo.
- **`DottedGroundField`** — world-space procedural dot field via custom GLSL `ShaderMaterial` with `fwidth` AA, tiered grid spacing by camera height, focal falloff.

### 5.3 Lighting, Environment & Cameras

- **`SunRig`** (inline) — real-sun directional + ambient + hemisphere + cool fill + rim light; `useFrame` mutates from `resolveSunLightPosition(lat, lng, sunDatePreset, sunMin)`; VSM shadow maps.
- **`FusedCamera`** — ortho↔perspective projection matrix interpolation with mass-spring damping; elevation orthographic facade crossfade; zero-allocation scratch context.
- **`FlythroughRig`** — Catmull-Rom spline camera playback (two splines: position + target).
- **`PedestrianCamera`** (Phase 8) — 1.7 m first-person walk with WASD/arrow keys, pointer mouselook, terrain-sampled eye height, damping lerp.

### 5.4 Lot Boundaries / Setbacks / Building Footprints

- **`LotBoundary`** (inline) — Signal Blue drape of the title boundary ring using `drapeRingToSurface`.
- **`SetbackBoundaryLayer`** — red dashed legal setback lines (`Line` with dashed material) + AI-generated building footprints (`ExtrudeGeometry` with bevel); `Outlines` in IMMERSIVE mode for NPR architectural sketch look.
- **`BuildingFootprint`** (inline) — extruded dwelling mass from `buildingPct` with `scanReveal.parcels` scale animation.
- **`NeighbourBuildings`** (inline) — extruded neighbouring footprints per `DesignNeighbourBuilding`.
- **`GovernmentOverlays`** (inline) — Vicmap keyless overlay rings (bushfire, contour, flood, heritage, etc.) with palette lookup by `kind`.
- **`Easements`** (inline) — dashed servitude rings with animated `dashOffset`.
- **`Services`** (inline) — APWA-coloured utility corridors (gas, water, electric, comms, sewer).

### 5.5 Flora / 3D Tree & Plant Assets

- **`SceneItems`** — dispatches to:
  - `TreeMesh` — tapered cylinder trunk + multi-lobe icosahedron canopy (6 main + 3 crown lobes with HSL jitter), seasonal opacity lerp, TPZ ring.
  - `HedgeMesh` — box cluster + icosahedron lobes.
  - `PavingMesh` — `ExtrudeGeometry` with bevel, concrete PBR.
  - `DeckMesh` — `Instances` of planks with 2 cm physical gaps, weathered timber material.
  - `BollardLight` — metal cylinder + emissive LED cap (`toneMapped={false}` for Bloom).
  - `RegionMesh` — `ShapeGeometry` for lawn/bed mulch.
- **`AssetPlaceLayer`** — click/drop placement preview with ghost crosshair + footprint ring; mass-plant row/area math.
- **`PlantSpacingGuideLayer`** — mature canopy footprint guides with `ringGeometry` + row guide lines.
- **`FloraRingLayer`** — ranked AI planting candidates ghost disc + clickable ring card.

### 5.6 Sketch Strokes (Fused 2.5D)

- **`FusedSketchLayer`** — unified ink in plan and 3D; `Line2`/`NibInkMaterial` with per-point width from stylus telemetry; `StippleMaterial` for dot strokes; `ExtrudeGeometry` for closed pads; `drapedY` per-frame Y lerp by `viewBlend`; raycast unprojection; vectorization scheduler.
- **`DraftShapeLayer`** — precision polyline/area drafting with rubber band, vertex discs, live readout.
- **`StrokeTransferLayer`** — canvas-to-canvas stroke projection via `Raycaster` NDC→world→plane.
- **`StitchSnapLayer`** — pulsing ε-snap vertex dots.

### 5.7 Earthworks / Terrain Cuts and Fills

- **`EarthworksLayer`** — committed extruded pad masses (`ExtrudeGeometry`) + cut/fill zone meshes (`BufferGeometry` with vertex colors: red = cut, gold = fill) via `padCutFill` raster.
- **`SuncastOverlay`** — analytical shadow footprints for building + canopies via `ShapeGeometry` from `castRingShadowPct`/`canopyFootprintPct`.

### 5.8 Underground Utilities / Subsurface

- **`SubsurfaceEngine`** — underground utility conduits as screen-space 2 px dashed hairlines with `dashOffset` flow by utility type; `Billboard` + `Text` labels; emissive `sphereGeometry` strike-alert pulses (`toneMapped={false}` for Bloom).

### 5.9 Irrigation, Drainage & Trenches

- **`IrrigationZoneLayer`** — irrigation zone fills (`THREE.Shape`/`shapeGeometry`) + lighting-run fixtures (`sphereGeometry` dots) + `Html` live readout.
- **`TrenchLayer`** — construction trench runs with live draft + conflict tint; no-dig ring collision check.
- **`DrainageFlowLayer`** — D8 overland flow streams + ponding markers via `buildStudioFlowGrid`, `traceStreamNetwork`, `findPondingPoints`; animated `dashOffset` flow; breathing pond discs.

### 5.10 Vertical Truth / Elevation

- **`ElevationSliceLine`** — draggable section-cut line on terrain via `createElevationSampler`.
- **`PhotoTracePlane`** — pinned site-photo elevation plane with `THREE.TextureLoader` image; trace strokes; ray-to-plane hit math; camera fly via `lerpRig`.

### 5.11 Annotations / Dimensions / Callouts

- **`DimensionLayer`** — boundary + building dimension ring with extension lines, ticks, and bearing/distance `Html` chips; `useFrame` alpha by zoom.
- **`MetaChipSet`** — ambient Vicmap satellite chips around the boundary with SVG dashed leaders; `useFrame` NDC projection.
- **`AnnotationLayer`** — design intent: RL marks, plant pucks, material hatches (SVG `<polygon>` with pattern fills), detail callouts, scope outlines, north indicator.
- **`TradeAnnotationLayer`** — trade-pack linework and callouts (irrigation/drainage, hardscape, lighting/electrical).

### 5.12 Selection, Gizmos & Measurement

- **`StudioControls`** — invisible ground plane for raycasting; pan/orbit/wheel/marquee gesture handling; pointer event gating for tool layers.
- **`MarqueeBoxLayer`** (inline) — dashed Signal Blue selection rectangle.
- **`PlacementGizmo`** — `TransformControls` on selected placement with terrain-sampler height, boundary clamp, 0.5 m translation snap, 45° rotation snap.
- **`MeasureTapeLayer`** — interactive two-point measurement tape draped on terrain.

### 5.13 Grounding / Survey Furniture

- **`OriginPeg`** (inline) — Signal Blue crosshair and ring at origin.
- **`GroundShadow`** (inline) — anti-void radial gradient via custom `ShaderMaterial` with `smoothstep`.
- **`GroundContactShadows`** (inline) — drei `ContactShadows` AO-style grounding.

### 5.14 Ghosts, Proposals & Scan Effects

- **`CadProposalLayer`** — Sketch→CAD ghost proposal rings and dashed outlines with confidence chip.
- **`ScanRevealDirector`** — writes choreographed reveal 0→1 values into `scanReveal` singleton per frame with `smoothstep`.

### 5.15 Post-Processing (`WebGLStudio.tsx` / `RenderFX`)

- **N8AO** — ambient occlusion (`aoRadius=4`, intensity 1.15/1.6 by render mode, quality medium/high).
- **Bloom** — emissive glow (caps, bollards, strike alerts), `KernelSize.LARGE`, mipmap blur.
- **Vignette** — offset=0.4, darkness=0.12/0.2.
- **SMAA** — edge antialiasing.
- **DynamicDoF** (Phase 8, IMMERSIVE only) — `DepthOfField` with raycast-based center-screen autofocus, smoothly damped via `THREE.MathUtils.lerp`.
- Drafting/paper modes: `EffectComposer` contains only `SMAA`.

### 5.16 Lenses & Split View

- **`PresentationLens`** — filter config that hides subsurface, strikes, TPZ, easements, services in present/quote/share modes.
- **`SplitViewLens`** — DOM shell rendering two `WebGLStudio` instances side-by-side (left locked ortho, right live 3D) with linked camera state.
- **`VignetteOverlay`** — DOM vignette overlay with opacity lerping by `viewBlendTarget`.

### 5.17 Not Currently Implemented

- **Point clouds / photogrammetry** — no `THREE.Points` or point-cloud layer exists. The only photo-related layer is `PhotoTracePlane` (textured photo plane).
- **Real BYDA API** — contracts and digitise helpers exist, but no external BYDA API call.
- **Nearmap / Google Maps / Mapbox** — not in live code (Mapbox referenced only in a retired test).

---

## 6. Architecture Summary

### 6.1 Package Architecture

```
@workstream/contracts  →  Zod schemas (42 modules) — the single source of truth for all domain entities
        ↓
@workstream/db         →  SQLite persistence, VCS normalization, genesis canvases
        ↓
@workstream/domain     →  Pure business logic: earthworks, hydrology, photogrammetry, sun/shadow,
                          compliance, planting, costing, CAD ops, merge/diff, AI assist, scheduling
        ↓
@workstream/cad        →  CAD document operations, DXF/SVG/glTF export, site-frame stamping
        ↓
apps/api               →  Fastify API (162 routes), Clerk auth, Redis/BullMQ jobs, external integrations
        ↓
apps/web               →  Next.js 16, R3F WebGL studio, Zustand stores, 43 render layers
```

### 6.2 Data Flow

```
Client (browser)
  → Next.js proxy routes (17 same-origin proxies)
  → Fastify API (162 routes)
  → SQLite (WAL) + External services (Claude, Vicmap, Stripe, MYOB, Xero, etc.)
  → @workstream/domain (pure business logic)
  → @workstream/contracts (Zod validation at every boundary)
  → Response
```

### 6.3 Studio Data Flow

```
Server design canvas (Zod-validated)
  → WebGLStudioPreview (hydration)
  → studioStore (Zustand — single source of truth for all canvas state)
  → StudioScene (43 R3F layers read from store via hooks)
  → RenderFX (post-processing: N8AO + Bloom + Vignette + SMAA + DoF)
  → Canvas (WebGL2)
```

### 6.4 Key Architectural Patterns

- **Zod at every boundary** — contracts validate all API responses, store hydration, and persistence.
- **Transient store doctrine** — per-frame animation reads `useStudioStore.getState()` inside `useFrame` and mutates refs/Three.js objects directly, never triggering React re-renders.
- **Fused rendering context** — single `PerspectiveCamera` with interpolated projection matrix (ortho↔persp), no hard cut.
- **Layer contract** — `SPATIAL_LAYER` defines render order (terrain=0, draped=1, semantic=2, markers=3) and surface offsets to prevent z-fighting.
- **Domain Layer Registry** — stroke color, line width, and y-bias come from `getLayerStyle`/`layerYOffset`, never hard-coded.
- **VCS** — design branches with create/checkout/commit/abandon/diff/merge; three-way merge with conflict resolution.
- **Autosave** — debounced saves with exponential backoff retry; fingerprint-based dirty detection.
- **Mock-first AI** — Phase 7 WFS/AI site setup is fully mocked with contract-validated responses; real provider swap is a seam, not a rewrite.
