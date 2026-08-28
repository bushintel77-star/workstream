# AEC Generative Fusion — 2026-08-28

Decision record for fusing competitor-validated patterns (Higharc teardown,
PRO Landscape quote surfaces) into the Workstream canvas. Companion to
`AEC-2026-RESEARCH-ADOPTION.md`. Scope agreed with the operator: public-surface
competitive research only — no endpoint probing, no premium-feature
circumvention.

## The teardown finding (public sources)

Higharc is the closest architectural analog: generative design in, estimates
and permit-ready documents out. Their engineering blog discloses the actual
mechanism (Generative Building Model): BIM rooms tokenized like language —
an envelope sequence and an entity sequence, with **wall-referenced
placement** (each entity parameterized relative to its supporting wall, not
absolute coordinates) — feeding a standard Transformer encoder–decoder.
Benchmarks vs frontier LLMs/VLMs: 98.2% coverage vs 76.4%, 3.2% geometric
violations vs 7–9%. Their stated conclusion: **representation alignment with
the BIM structure plays a larger role than model scale**, and constraints
are enforced *during* generation, not corrected after.

Sources: higharc.com (home, /product/studio, engineering blog
"ai-layout-at-higharc-tokenizing-buildings", "solving-the-data-layer-for-homebuilding-ai"),
insightpartners.com/ideas/behind-the-investment-higharc.

## What we adopted (and where it landed)

1. **Edge-referenced ghost placement** (`aiGeneration.ts`) — the lot-side
   translation of Higharc's wall-referenced parameters: every boundary ghost
   carries `(edgeIndex, tAlongEdge, insetPct)`, placed by true arc-length
   distribution with perpendicular edge-normal inset and inward-facing
   rotation. Invariant to lot shape (concave L-lots verified), steerable on
   re-run.
2. **Constraints during generation** — mass placement is point-in-polygon
   rejection sampling with building/easement exclusion and existing-crown
   clearance. No ghost can land outside the lot, inside the dwelling, or
   under an existing crown. Post-hoc compliance stays as the verifier; the
   generator no longer produces violations to verify.
3. **Compliance as generative substrate** (the TestFit pattern) —
   `buildCanopyCompliance`'s A2-6 shortfall feeds `generateGhosts`; a
   compliance intent ("fill the A2-6 shortfall") generates exactly the gap,
   so an accepted batch lands compliant by construction.
4. **Determinism** — the RNG is prompt-seeded: same prompt + same site →
   identical proposal. Operators re-run and tweak (count, inset) without
   the deck reshuffling.
5. **Plant schedule on the fit sheet** (the PRO Landscape edge — quote
   polish) — common name, botanical name, mature size × qty, derived live
   from store placements joined to the domain catalog. The schedule can
   never disagree with the drawing.

## What we already had (validated, unchanged)

- One structured model → every document: canvas → fit sheet → quote →
  share portal is the same chain Higharc sells ("home as structured data").
- Grounded site truth as substrate: Vicmap cadastre, BYDA, ResCode A2-6 —
  richer than Higharc's builder-standards constraints and absent from every
  landscaping competitor.
- Ghost-propose / operator-accept interaction (AI is a spatial collaborator,
  never a silent writer).

## Rejected / deferred

- **Recipe-driven garden beds as generated `LandscapeFeature`s** (Higharc's
  entity-program idea): the machinery exists (`brush_recipe_id`,
  `procedural_scatter_contents`, `FeatureLayer`), but the ghost session is
  placement-typed end to end (`aiSession.ghosts` → `GhostOverlay` →
  `acceptAiGhosts`). Wiring feature ghosts needs an accept path + overlay
  rendering for a second entity family — deferred rather than half-wired.
- **Plant schedule on the quote portal**: `fetchPortalQuote` line items
  carry no symbol ids; the costing API would need to pass them. Deferred
  until the portal costing schema carries species data.
- **Trained generative model over landscape features** (the actual GBM):
  the heuristic engine now has the right representation for a future model
  to sit on top of — that was Higharc's whole point.
- Photoreal rendering, any endpoint probing of competitor apps.

## Also fixed in the same pass (the 27-issue quality plan)

The UnifiedPanel absorbed the retired hidden dock's bodies (survey setup,
CAD drafter, sketch actions, meta surfaces — all were mounted but
invisible), placements/features became editable in the panel,
`SaveStatusChip` is visible in the tab strip, `?guide=1` lands new users in
survey, trench/zone draws are undoable, `?mode=` follows the active mode,
and the stranded e2e chrome contracts (collision, coverage, drafting
readouts, dim families) were repaired and re-measured.
