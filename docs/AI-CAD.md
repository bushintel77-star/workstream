# AI CAD & Material Orchestrator

Workstream embeds a **Lead Landscape CAD & Material Orchestrator** on the scaled
site canvas. AI CAD (Stage 2) and preemptive BOM share one DNA: soft proposals
until Accept; design and cost stay one surface.

## Identity

Close the gap between design intent and physical implementation cost. Every
placement / CAD mutation feeds:

1. **Spatial facts** — scaled layer-aware objects (hardscape, softscape, irrigation, …)
2. **Preemptive BOM** — primary ? secondary ? tertiary ? labour ? logistics ? fees
3. **Predictive risk** — retaining height, TRP conflicts, drainage — with temporary overlays

No Design Mode vs Quote Mode toggle. Live BOM HUD sits on Sketch / CAD / Quote lenses.

## AI CAD stack

| Layer | Choice |
| --- | --- |
| Interchange CAD | LibreCAD (DXF download / re-open) |
| Geometry engine | `@workstream/cad` (ops ? entities ? DXF/SVG) |
| AI | Claude emits `CadOp[]` JSON (`generateCadOps`) |
| Persistence | `CadDocument` parallel to `DesignCanvas` |
| Orchestration | `material-orchestrator` + `GET /projects/:id/orchestration` |

## Operator flow

1. Survey loads aerial (GIS — not LLM).
2. Sketch placements — **live BOM** expands secondary/tertiary materials immediately.
3. Risk chips / mitigation overlays (TRP, drainage, engineer hold) — Accept or Dismiss.
4. CAD generate — AI ghosts on aerial; live BOM refreshes from committed geometry.
5. Quote lens **promotes** live BOM / CAD quote to client output — not a third estimate engine.
6. Share portal link.

AI never silently replaces geometry. Ghosts and overlays stay until Accept.

## Orchestration API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/projects/:id/orchestration` | Live world: facts, BOM, risks, overlays |
| POST | `/projects/:id/orchestration/refresh` | Recompute after external mutation |
| POST | `/projects/:id/orchestration/accept-overlay` | Commit mitigation (may place symbol) |
| POST | `/projects/:id/orchestration/dismiss-overlay` | Drop soft overlay |

## CAD API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/projects/:id/cad` | Document + SVG + ghost count |
| POST | `/projects/:id/cad/generate` | Import sketch + AI ops as ghosts |
| POST | `/projects/:id/cad/edit` | `{ instruction }` ? more ghost ops |
| POST | `/projects/:id/cad/accept` | Promote ghosts |
| GET | `/projects/:id/cad.dxf` | LibreCAD DXF |

## Packages

- `packages/contracts/src/schemas/orchestration.ts` — world / BOM / risk schemas
- `packages/domain` — `spatial-facts`, `preemptive-bom`, `preemptive-risk`, `orchestration-world`
- `apps/api/src/lib/material-orchestrator.ts` — mutation-driven world
- `apps/web` — `LiveBomHud` on `SiteCanvas`

## Honesty

Indicative / working-planning — not construction or council lodgement drawings.
TRP radii and dims are indicative (AS 4970). Confirm on site, title, and locate.
Units: metric AU (m², m³, tonnes, lin m).

## Out of scope (this pass)

- Full 3D / grading mesh
- Vicmap utility line import (hook reserved)
- Silent auto-accept of overlays or fee lines
