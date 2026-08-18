# Inspector scoping pass — WebGL selection-driven property panel

Produced after the docs-vs-code audit landed (verified clean — see
`docs-audit-report.md`). Method note: two fresh-context scoping attempts
stalled; this pass was completed by the coordinating agent with every claim
re-verified against code, `file:line` cited. Scope: inspector only — no
gizmos, no vertex tweaking, no drag-move, no marquee, no cross-studio
selection bridge, no schema changes.

## Step 0 — autosave fingerprint extension (strict prerequisite, ships first)

Before ANY panel wiring: `buildPersistKey` (`useStudioAutosave.ts:74-133`)
previously hashed placements only as `id/symbol_id/x/y/scale/rotation` and
features only as `geometry.type/layer/points-count/points`. Every
inspector-editable field fell outside the hash — an edit changed store
state without changing the persist key, the debounced effect never fired,
and the edit was lost on reload. The panel is a no-op on reload without
this fix.

Sequencing rule: this lands as its own commit with its own unit tests
(`useStudioAutosave.test.ts`) before any panel wiring starts. It is a
strict prerequisite, not a parallel task inside the panel pass — the
fingerprint work must not be squeezed.

## 1. Selection field shape (`studioStore.ts`)

- State: `selection: SelectionRef[]` — `studioStore.ts:396`; initial `[]`
  at `:639`. Survives every WebGL mode switch because it is mode-independent
  store state, cleared only explicitly.
- Mutators: `selectRef(ref, { additive? })` (`:1127`), `toggleSelectRef`
  (`:1135`), `clearSelection` (`:1153`), `setSelection` (`:1154`).
  Dedupe via `selectionPick.dedupeSelection`; `pruneSelection` drops refs
  when entities leave the document (`:756`, `:774`, `:987`).
- `SelectionRef = { kind: "placement" | "feature" | "photoStroke";
  id: string; elevationId?: string }` — `selectionPick.ts:19-24`. One
  concept across all three selectable families.

## 2. Picking behavior (`selectionPick.ts` + `WebGLStudioPreview.tsx`)

- `handleGroundClick` (`WebGLStudioPreview.tsx:417-430`): feature hit first
  (`nearestFeatureId`), then placement (`nearestPlacementId`); neither →
  clear selection unless `additive` (shift-click multi-select). Esc clears
  (`:442-443`, skipped while typing); panel close button clears (`:1802`).
- Grab radii (metres): placement glyph 1.8, feature linework 1.1, plane
  stroke 0.35 — `selectionPick.ts:46-50`. Photo-stroke picking is plane-space
  via `nearestPlaneStrokeId` on the `PhotoTracePlane` surface.
- No mode gating on selection state itself.

## 3. Editable contract fields per entity type

`CatalogPlacement` (`packages/contracts/src/schemas/catalog.ts:73-93`):

- Editable: `symbol_id` (SKU / species identity), `scale`,
  `rotation_deg`, `label`, `height_m`, `canopy_radius_m`.
- Plan-geometry-affecting: `scale`, `canopy_radius_m` (footprint).
  `height_m` is vertical only → attribute class. `rotation_deg` spins the
  glyph in place → attribute class for centre-clamping purposes.
- Read-only: `id`, `x_pct` / `y_pct` (position editing is the gizmo phase),
  `source` (Vicmap/canopy provenance).
- Downstream: `scale` / `height_m` / `canopy_radius_m` feed flora render and
  fit sheet; `symbol_id` drives SKU pricing.

`LandscapeFeature` (`packages/contracts/src/schemas/landscape-feature.ts:117-132`):

- Editable: `material_fill.sku` / `depth_m` / `waste_allocation_pct`
  (`MaterialFillSchema:74-79`), `metadata.friendly_name`,
  `labor_profile.base_difficulty_tier`,
  `procedural_scatter_contents.brush_recipe_id` (the density selector).
- Geometry-affecting: none of the editable fields touches `geometry.points`;
  `depth_m` is material thickness (z), not plan extent → attribute class.
- Read-only: `id`, `type`, `metadata.timestamp_created`,
  `metadata.source_attribution`, `metadata.user_modification_state`
  (auto-set on edit), `geometry` (vertex editing = gizmo phase),
  `material_fill.live_calculations`, `procedural_scatter_contents.live_totals`,
  `labor_profile` cost fields (derived BOM).
- Downstream: SKU / depth / waste feed `LiveMaterialCalculations`
  (`area_m2`, `volume_m3`, `cost_aud` — `:65-72`) and the quote.

Plant density — decided: density edit = `brush_recipe_id` swap + instance
regeneration. No density field exists on `CatalogPlacement`, `BrushRecipe`,
or `ProceduralScatter` (`landscape-feature.ts:95-145`); mass-planting
density is generation-time (`brush_recipe_id` + `seed_value` +
`instances`). A contract-level density field is real future work but
deferred (schema change — out of scope v1). Known limitation: the operator
edits the recipe, not a numeric plants-per-m2 value.

## 4. Mutation + persist flow

Store mutations: only bulk setters exist — `setPlacements`
(`studioStore.ts:467` / `:735`), `setFeatures` (`:368` / `:970`); no
per-entity patch actions. Proposed: `updatePlacementField(id, patch)` and
`updateFeatureField(id, patch)` mapping over arrays. Feature edits set
`metadata.user_modification_state` to `human_locked` (enum
`landscape-feature.ts:13-17`) — decided: `human_locked` signals the human
has touched it, so AI ghosts must not auto-overwrite; `accepted` implies an
AI suggestion was approved, the wrong signal for a manual edit.

Persist: `useStudioAutosave.ts` — content fingerprint `buildPersistKey`
(`:74-133`) keys the debounced effect (1100 ms) with 3-attempt backoff
(`[2s, 8s, 30s]`, `stale_client` short-circuits); full-canvas PUT through
`saveDesignCanvasClient` (`:206-213`); `saveStatus` machine + beforeunload
guard.

Autosave fingerprint — see Step 0 (strict prerequisite, ships first, its
own commit and tests). The fingerprint previously hashed placements as
`id/symbol_id/x/y/scale/rotation` and features as
`id/geometry.type/layer/points-count/points`, omitting every
inspector-editable field; the Step 0 extension covers them all.

Boundary policy — decision (a), conditional:

- Plan-geometry-affecting edits (`scale`, `canopy_radius_m` on placements):
  `mutate → re-clamp via constrainAssetCentre (handoff/geometry/outdoorClamp.ts:249)
  using store siteBoundary/siteBuilding (studioStore.ts:357, :362; set via
  setSiteContext from WebGLStudioPreview.tsx:343) → if OutdoorSnapResult.snapped,
  crimson alert on the inspector card with the snap reason → persist`.
  Warning, not a hard block — operator edits are intentional and stamped.
  Two persistence rules (decided): re-clamping is persistent — it always
  runs on every geometry-affecting edit, non-negotiable per the
  reconciliation rule. The alert is dismissible per-acknowledgement — the
  operator clears the flag, and it re-arms on the next geometry-affecting
  edit. Never conflate the two.

### Field classification (locked — build against this, do not re-derive)

Confirmed on sign-off: `height_m` is direct-persist. It changes the 3D
mass (vertical extent) but not the plan footprint, and
`constrainAssetCentre` is board-% plan math — a taller tree at the same
centre cannot cross the title boundary. No clamp for height.

| Entity | Field | Path |
|--------|-------|------|
| placement | `scale` | clamp (changes footprint) |
| placement | `canopy_radius_m` | clamp (changes footprint) |
| placement | `height_m` | direct persist (vertical only) |
| placement | `rotation_deg` | direct persist (spins about a fixed centre; centre-clamp unchanged) |
| placement | `label` | direct persist |
| placement | `symbol_id` | direct persist (identity/material, same footprint) |
| placement | `source` | not inspector-editable v1 (read-only provenance; fingerprint still covers it) |
| placement | `x_pct` / `y_pct` | not editable v1 (gizmo phase; when gizmos land, position edits clamp — reconciliation rule) |
| feature | `material_fill.type` / `sku` / `depth_m` / `waste_allocation_pct` | direct persist (`depth_m` is material thickness in z, not plan extent) |
| feature | `friendly_name` | direct persist |
| feature | `brush_recipe_id` | direct persist (recipe swap regenerates instances inside unchanged feature geometry) |
| feature | `labor_profile.base_difficulty_tier` | direct persist |
| feature | `user_modification_state` | direct persist (auto-set to `human_locked` by the edit actions, not a form field) |
| feature | `geometry.points` | not editable v1 (vertex tweak = gizmo phase) |

Known limitation (recorded, not silent): a rotated elongated placement
could overhang the boundary while its centre stays in bounds — the
centre-based clamp does not catch extent overflow today, same as for
pre-existing placements. Extent-vs-boundary checking is future work, not
v1 inspector scope.

### Panel states (locked)

- Zero refs: `InspectorCard` renders nothing — unmounted, zero-chrome, no
  hint card.
- One ref: form mode. Text fields commit on blur or Enter; numeric and
  select fields commit on valid change. Per-field commit only — there is
  no OK/cancel and no pending form state.
- More than one ref: read-only summary mode — lists the selected entities
  (kind + label), shows a single muted line "Select one entity to edit its
  properties", no editable fields, no per-entity ambiguity. A transition
  into this state cannot orphan edits because commits are per-field.
- Boundary alert: renders on the card only when a `boundaryNotice` exists
  for the selected placement; dismissible per-acknowledgement; re-arms on
  the next clamped edit.
- Attribute-only edits: `mutate → persist`, no clamp.

Premise correction (point 3 of the brief): `strike_alert` is NOT the
boundary signal. In contracts it is an orchestration boolean
(`orchestration.ts:44`) and in domain it is a dig-strike fact derived at
read time — `depth_m < 0.9` on non-softscape layers
(`packages/domain/src/spatial-facts.ts:344-348`, `:361-406`).
`constrainAssetCentre` does not set it. Boundary warnings surface via
`OutdoorSnapResult.reason` (the `tip` / `codeHint` chain,
`outdoorClamp.ts:256-279`) in the crimson `--gs-conflict` tone;
`strike_alert` remains a dig-safety signal. The two are complementary, not
the same.

## 5. UI mount point and panel states

- Pattern: DOM cards layered over the R3F canvas, zustand selectors,
  `GlassCard` + `--gs-*` tokens (`StudioCadCard.tsx:15, :19-44` — panel
  tokens, `--gs-primary`, `--gs-line`, `--gs-ink`, `--gs-radius-chip`).
- Proposal: `InspectorCard` (Paper Card, frost) mounted in the HUD chrome
  column near the rail, subscribed to `selection`. Resolve refs against
  store `placements` / `features`; photoStroke refs live inside
  `PhotoElevation.strokes` (not top-level) — v1 shows a read-only
  provenance row when photoStroke provenance exists, and hides the row
  entirely when it does not (no empty "Provenance: none" noise).
- States (decided, single selection only for v1): empty selection → panel
  not mounted; single selection → field form; more than one ref →
  read-only summary plus a "select one to edit" hint. Bulk-apply is
  deferred until the marquee tool (gap 3) lands — single-select inspector,
  then marquee, then bulk-edit. The locked field-classification table and
  exact panel states are in §4.
- Proposed store actions: `updatePlacementField`,
  `updateFeatureField` (with the clamp path inside for
  geometry-affecting fields).

## Non-goals (explicit)

No gizmos, no vertex tweaking, no drag-move, no marquee, no cross-studio
selection bridge, no contracts/schema changes. Position fields
(`x_pct` / `y_pct`) are deliberately excluded from v1 — they belong to the
gizmo phase.

## Operator decisions (signed off)

1. Density: brush-recipe swap + regeneration; v1 ships; the contract-level
   density field is deferred and recorded as a known limitation (above).
2. Feature modification state on edit: `human_locked` (hands-off to the AI
   ghost system — closes the loop without coupling the features).
3. Multi-select: single selection only for v1. Bulk-edit ships after the
   marquee tool — single-select inspector, then marquee, then bulk-edit.
4. Boundary re-clamp: always re-clamps on geometry-affecting edits
   (persistent); the crimson alert is dismissible per-acknowledgement and
   re-arms on the next edit (two different persistence rules).
5. photoStroke refs: read-only provenance row, shown conditionally only
   when provenance exists (provenance is the trust layer — the same signal
   the title-boundary reconciliation work was built to enable).
