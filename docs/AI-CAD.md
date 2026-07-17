# AI CAD (Stage 2)

Workstream Stage 2: **LLM ? deterministic CadOps ? metre-space CadDocument ? LibreCAD DXF**.

Workflow 1 sketch studio stays the default. AI CAD is an upgrade path.

## Stack

| Layer | Choice |
| --- | --- |
| Interchange CAD | LibreCAD (DXF download / re-open) |
| Geometry engine | `@workstream/cad` (ops ? entities ? DXF/SVG) |
| AI | Claude emits `CadOp[]` JSON (`generateCadOps`) |
| Persistence | `CadDocument` parallel to `DesignCanvas` |

## Operator flow

1. Save sketch placements in Design studio — **auto-quotes** from pins + outdoor
   (`garden_area_m2` from aerial/title survey).
2. **Upgrade to AI CAD** (AI ribbon chip or `/projects/:id/design/cad`).
3. **Generate AI CAD** — CAD template sized from **outdoor lot footprint**
   (title bbox / garden area), imports sketch, stamps outdoor m², adds AI **ghosts**.
4. Review ghosts on aerial + SVG overlay; NL **Apply edit** for more ghosts.
5. **Accept ghosts** — promote to committed entities.
6. **Download DXF** — open in LibreCAD for draftsperson handoff.

AI never silently replaces geometry. Ghosts stay until Accept.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/projects/:id/cad` | Document + SVG + ghost count |
| POST | `/projects/:id/cad/generate` | Import sketch + AI ops as ghosts |
| POST | `/projects/:id/cad/edit` | `{ instruction }` ? more ghost ops |
| POST | `/projects/:id/cad/accept` | Promote ghosts (`entity_ids` optional) |
| GET | `/projects/:id/cad.dxf` | LibreCAD DXF attachment |

## Packages

- `packages/contracts/src/schemas/cad.ts` — schemas
- `packages/cad` — `applyCadOps`, `importSketchToCad`, `cadDocumentToDxf`, `cadDocumentToSvg`
- `apps/api/src/lib/cad-job.ts` — orchestration
- `apps/web` — `AiCadStudio` at `/design/cad`

## Honesty

Permanent copy: indicative / working-planning — not construction or council lodgement drawings. TRP radii and dims are indicative (AS 4970). Confirm on site, title, and locate.

## Out of scope (V1)

- Embedded LibreCAD WASM
- FreeCAD / 3D
- AutoCAD license
- Costing driven from CAD quantities (still sketch/envelope until follow-on)
