# Inspector scoping pass — WebGL selection-driven property panel

Standalone task for a fresh agent context. You do not share any prior
conversation; everything you need is below. Run this only after the
docs-vs-code audit has landed (the binding docs should already be
corrected). You produce a scoping document; you do NOT write feature code.

## Mission

Produce the scoping pass for a selection-driven inspector panel in the
WebGL studio: the operator edits material SKUs, plant species, plant
densities, and dimensions on selected `LandscapeFeature`s and
`CatalogPlacement`s. Spatial manipulators (rotate/scale/vertex gizmos,
drag-move, their own picking, snapping, and undo surface) are EXPLICITLY
OUT of scope — a separate later phase. No marquee, no cross-studio
selection bridge, no schema changes.

Golden rule: do not trust any doc premise (including AGENTS.md and the
corrected architecture docs) without verifying it against current code.
Flag every premise that turns out false.

Workspace: `C:\Users\Tim\Downloads\CURTIS-CO\workstream`. Use read / grep
tools; cite `file:line` for every claim. Sentence case, no emojis.

## Deliverables (one markdown document)

Return it as your final message and also write it to
`docs/agent-prompts/inspector-scope-output.md`.

1. Selection field shape — `apps/web/src/components/canvas/webgl/studioStore.ts`:
   the exact selected-state field (name, type — string array vs Set,
   selector), every selection-mutating action (names, signatures), which
   entity kinds can enter selection (placements, features, photo-trace
   strokes), and how selection survives WebGL mode switches.

2. Picking behavior — `apps/web/src/components/canvas/webgl/selectionPick.ts`:
   click vs shift-click vs Esc semantics, the raycast target set and
   priority ordering, any mode gating, and where picking integrates with
   `StudioControls.tsx`.

3. Editable-property contract fields per entity type — from
   `packages/contracts/src/schemas/catalog.ts` (`CatalogPlacementSchema`)
   and `packages/contracts/src/schemas/landscape-feature.ts`
   (`LandscapeFeatureSchema`, `MaterialFillSchema`,
   `ProceduralScatterSchema`, `LaborProfileSchema`) plus any catalog or
   density types referenced: list which fields are operator-editable in an
   inspector (SKU/species, density, dimensions) and which are read-only
   (ids, type discriminators, timestamps, source attribution, geometry
   points — vertex editing belongs to the gizmo phase). For each editable
   field: schema path, validation, whether the edit changes plan geometry
   (extent/position) or is attribute-only, and which downstream surfaces
   consume it (live BOM totals, flora render, fit sheet, quote). Locate
   precisely where "plant density" lives (procedural scatter brush recipe?
   per-instance? catalog symbol?) and state the exact field.

4. Mutation + persist flow — trace how `studioStore` mutations reach the
   persisted `DesignCanvas` document (check
   `apps/web/src/components/canvas/webgl/useStudioAutosave.ts`, the
   state/canvas bridge files, `saveDesignCanvasClient`) and propose the
   inspector's mutation+persist flow: optimistic store update, autosave
   debounce behavior, error and rollback surface. Bake in the boundary
   policy decision — (a) conditional: every inspector edit that changes
   plan geometry runs boundary reconciliation before persist
   (`constrainAssetCentre` from
   `apps/web/src/components/canvas/handoff/geometry/outdoorClamp.ts` plus
   strike computation) and shows a crimson `strike_alert` surface on the
   inspector card; attribute-only edits (SKU/species/density with geometry
   untouched) persist directly with no clamp. From your editable-field
   analysis, state which v1 fields are geometry-affecting (e.g. does
   `CatalogPlacement.scale` change plan extent?) and give the exact
   autosave path per class: `mutate -> clamp -> alert -> persist` vs
   `mutate -> persist`. Check `packages/domain/src/spatial-facts.ts` for
   how `strike_alert` is computed and whether it is persisted or derived
   at read time.

5. UI mount point and panel states — survey the WebGL chrome cards
   (`StudioCadCard`, `InstrumentCard`, `FitSheetCard`, `GlassCard`,
   `StudioToolRail`, `PhotoTraceHud`) for the mounting pattern (zustand
   selectors in DOM components, `--gs-panel-*` Paper Card tokens); propose
   where the inspector mounts, its empty-selection state, single vs
   multi-selection handling, and a per-field mutation list with proposed
   store action names.

## Non-goals (state explicitly in the document)

No gizmos, no vertex tweaking, no drag-move, no marquee, no cross-studio
selection bridge, no contracts/schema changes — if a needed field is not
operator-editable in current contracts, flag it as an open decision rather
than designing a schema change.

## Output rules

End with an "open decisions" section for anything needing the user (e.g.
multi-select editing semantics, read-only render of derived costs, whether
scale edits fire the clamp). Every section must cite file:line evidence.
