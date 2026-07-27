# Implementation brief — BoardContext v1 (AI-aware canvas)

**From:** Design & Architecture (Claude) → implementation (fresh context)
**Date:** 2026-07-27
**Decision:** **context-aware, not context-reduced** — ship full board fidelity.
**Parent:** `2026-07-27-canvas-ux-strategy.md` §8.1–8.2

---

## 1. Situation (read this first — don't rebuild what exists)

Workstream is **already board-aware**, not prompt-scoped. Verified in
`apps/api/src/routes/design-assist.ts`: every assist call serialises the whole active board —
all placements, `site_frame` (boundary/easements/services), a brief built from the complete canvas,
the full symbol catalogue, survey geometry in real metres, lat/lng/scale, plus derived
`compliance_summary`, `shade_summary`, `sun_hours` from `buildAssistSiteIntel`. Around it:
`studioAiEngine` ghosts, `markStaleGhostsNearEdit`, aerial canopy clustering, `runSpatialCorrection`.

**The ceiling is payload depth, not awareness.** `formatSketchBriefForAi`
(`packages/domain/src/sketch-brief.ts`) is board-wide but **flat** — per asset it emits label,
category, count, `%` position, SKU, description; plus garden area and a stroke count. It cannot
express **dimension, time, level, system, or cost**, so the model describes the board accurately but
cannot reason about consequence. This brief fixes that.

**Do not** replace the assist pipeline. Extend the payload.

---

## 2. Deliverable

`BoardContext v1` — one versioned, whole-board snapshot in `packages/domain`, consumed by the
existing design-assist route, and reusable by the sustainability dashboard and export liability
overlay (both need the same state).

```
BoardContext v1 {
  version:   "board-context/1"
  meta:      { project_id, address, council, pfi, spi, lat, lng, scale_m, mode, phase }
  geometry:  { boundary[], building[], building_source, lot_m2, outdoor_m2,
               coverage_pct, levels[] (RL spot heights), datum }
  planting:  [{ code, species, category, count, x, y, scale, rotation,
                mature_spread_m, height_m, dbh_m?, growth_stage_now }]
  surfaces:  [{ type, area_m2, material, permeable }]
  systems:   { irrigation_zones[], services[], trenches[], byda_assets[],
               lighting_fixtures[]?, easements[] }
  overlays:  { keyless[] (heritage | flood | bushfire | TRP), zoning, tpz[] }
  climate:   { sun_hours, shade_summary, sun_date_preset, growth_stage, orientation }
  compliance:{ flags[], permeability_target, canopy_target, setback_state }
  commercial:{ quote_lines[] (label, qty, unit, total), subtotal, margin_pct, total_incl_gst }
  sheet:     { paper, scale_denom, pen, theme, widgets[], elevations_chosen[] }
  provenance:{ per block: vicmap | operator | derived | seed }
}
```

Data already exists across `useStudioState` / `canvasBridge` / `studioCatalog` / `siteScheduleDisplay`
/ the costing engine. This is an assembly + contract job, not new capture.

---

## 3. Why each addition earns inclusion

Every field unlocks a class of inference currently impossible:

| Addition | Unlocks |
| --- | --- |
| `mature_spread_m` + `growth_stage` | Year-10 canopy closure, overshadow, root competition, overplanting |
| `levels` + `datum` | Grade/fall, drainage direction, retaining need |
| `trenches` / `byda` / `easements` | Dig conflicts, confirm-locate warnings |
| `overlays` (heritage / TRP / flood / bushfire) | Permit foresight tied to real geometry |
| `surfaces.permeable` + targets | Live permeability and coverage advice |
| `quote_lines` | Design↔cost cross-checks ("turf priced under a Year-10 canopy") |
| `sheet` | Deliverable completeness ("turnkey set has no rear-boundary elevation") |
| `provenance` | Distinguish Vicmap fact from operator sketch from seed — prevents confident nonsense |

---

## 4. Fidelity policy (operator decision)

**Send the full board.** Where fidelity and token economy conflict, fidelity wins — consequence
reasoning dies first when arrays are capped or coordinates rounded away.

Guards that cost nothing:
- **No duplication** — reference assets by `code`, don't repeat blobs.
- **Stable key order** — deterministic serialisation for cache reuse and snapshot tests.
- **`provenance`** — so the model weights Vicmap fact above seed geometry.
- **Payload telemetry** — log context size per call so growth is visible, not surprising.

---

## 5. Constraints (hard)

- **Build boundary:** client hooks must **never** import `lib/api` (pulls Clerk / `async_hooks`,
  breaks the web Docker build). Route through **server actions** — ref `f0239bc`.
- **Domain-pure:** contract + builder live in `packages/domain`, unit-testable with no server.
- **HITL law:** findings surface as ghosts / horizon cards with Accept / Not now. Never silent
  mutation. No synthesized data (zero-mock policy) — real or absent.
- **Provenance on claims:** an AI statement should cite the artefacts it reasoned over, guarding
  against automation bias.
- **Ecological accuracy:** generation stays constrained to the Curtis / native palette and the site's
  climate — no hallucinated species (liability).

---

## 6. Acceptance criteria

- `buildBoardContext()` in `packages/domain` returns `BoardContext v1` from studio state; snapshot
  test locks the shape; unit tests cover empty board, no-dwelling, no-quote, seed-vs-vicmap provenance.
- Deterministic: same board → byte-identical context (stable ordering).
- `design-assist` sends it; existing assist behaviour unchanged or better (no regression in ghosts,
  spatial correction, canopy scan).
- Demonstrable new inferences, each citing artefacts:
  1. Year-10 canopy conflict with a surface or structure.
  2. A dig/service conflict against a trench or BYDA asset.
  3. A permeability or coverage breach tied to actual surfaces.
  4. A design↔quote mismatch.
  5. A deliverable-completeness gap in the sheet set.
- `pnpm --filter @workstream/web typecheck` green; domain + api vitest green.

---

## 7. Sequence

1. Contract type + `buildBoardContext()` + tests (domain only, no wiring).
2. Wire into `design-assist` alongside the existing brief; verify no regression.
3. Retire the flat brief once parity is confirmed.
4. Add proactive cross-artefact findings (horizon cards, provenance-cited).
5. Reuse the context for the sustainability dashboard (SITES v2 / UN SDG metrics) and the export
   liability overlay (maturity watermark, subsurface, TPO prompt, safety waiver).
