# Open-source CAD library research

**Status:** Advisory — adoption decisions only; not a mandate to rewrite the canvas.
**Companion to:** [`AI-CAD-DESIGN-LIBRARY.md`](./AI-CAD-DESIGN-LIBRARY.md) (asset packs already in-repo),
[`STUDIO-SURFACES.md`](./STUDIO-SURFACES.md), [`CAD-AI-2026-UX.md`](./CAD-AI-2026-UX.md).
**Stack filter:** React 19 · SVG-native · browser · permissive licence · landscape /
AU commercial (Curtis & Co).

## First principle — do not adopt a CAD framework

Workstream already draws SVG by hand and uses Turf for polygon booleans. That is
the right architecture.

JSCAD, Maker.js, Paper.js-as-app-shell, and browser DXF “editors” are built for
CNC / parametric / mechanical CAD. Adopting one would fight:

- the board camera + `%` coordinates
- `CameraChrome` / gate C portal parenting
- frost / plastic token chrome

Keep **SVG-native**. The real gaps are three small libraries plus a clean
asset / data pipeline — not a framework swap.

## Licence policy (bake into reviews)

| Band | Licences | Use |
| --- | --- | --- |
| **Green** | MIT, Apache-2.0, BSD, CC0, CC-BY (with attribution) | Default for deps and packs |
| **Yellow** | CC BY-SA | Only with a rendered attribution + ShareAlike notice on every client surface that can carry the glyph. The Wikimedia tree pack failed that test and was removed 2026-08-21 (`ASSET-LICENCES.md`); treat CC BY-SA as do-not-adopt unless the notice path is built first |
| **Red** | AGPL, CC-BY-NC, “free download” stock (Vecteezy / Freepik / VectorStock with resale strings) | Do not pull into a commercial SaaS product |

One-line rule for PRs: **no stock-vector “free” assets under deadline; no AGPL
data APIs.** Prefer CC0 / MIT / Apache.

## The three libraries worth evaluating

| Need | Pick | Licence | Fit |
| --- | --- | --- | --- |
| Natural pen strokes (Sketch) | [perfect-freehand](https://github.com/steveruizok/perfect-freehand) | MIT | Industry-standard pressure stroke (tldraw). Tiny, no deps. Candidate to replace / wrap `strokePointsToPathD` in `@workstream/domain`. |
| Hand-drawn wobble (presentation + leaders) | [Rough.js](https://github.com/rough-stuff/rough) | MIT | SVG-native sketchy renderer; seedable. **Evaluate against** existing seeded wobble (`features/render/seededRandom`) — keep whichever is lighter; do not double-implement. |
| DXF import / export | [dxf-parser](https://www.npmjs.com/package/dxf-parser) + [dxf-writer](https://www.npmjs.com/package/dxf-writer) | MIT | Highest product value: ingest surveyor DXF (boundaries, spot levels); export something an architect / council can open. Stage 2–adjacent; needs a contracts brief before schema growth. |

### Explicit non-goals (frameworks)

| Library | Why not |
| --- | --- |
| JSCAD | Solid / CNC mindset; wrong geometry model |
| Maker.js | Parametric 2D for fabrication, not landscape plan UX |
| Design-Core / full browser CAD shells | Own camera + UI; conflicts with handoff studio |

## Assets — avoid the “free” trap

Stock sites (Vecteezy, VectorStock, Freepik “free”) are often royalty-free with
resale / attribution strings — a legal risk for a product you charge for.

**Clean sources only:**

| Source | Licence | Role |
| --- | --- | --- |
| [Osmic](https://github.com/gmgeo/osmic) | CC0 | Already imported — safest base map-symbol layer |
| [PlanZV FNP](https://github.com/geoObserver/PlanZV-FNP) | CC0 | Already imported — planning symbols |
| [Temaki](https://github.com/rapideditor/temaki) | CC0 | Already imported — shrubs / groundcover / trees + hardscape / lighting |
| publicdomainvectors.org | Public domain | Occasional landscape / garden SVGs |
| Noun Project (plan-view plants) | CC-BY | Long-tail only; credits line required |
| Curtis gold / house catalog | Proprietary | Hero closed palette — never replaced by open packs |

**Model (matches closed-palette philosophy):** hand-tune ~12 hero presentation
symbols (Render 2); fill rare species from CC0 / public-domain packs only.
Regenerate via `pnpm --filter @workstream/domain import:ai-cad-design` — see
[`AI-CAD-DESIGN-LIBRARY.md`](./AI-CAD-DESIGN-LIBRARY.md).

## Plant species data

| Source | Licence | Verdict |
| --- | --- | --- |
| [GBIF](https://www.gbif.org/terms) | CC BY (commercial OK with attribution) | Prefer for enrichment (taxonomy / distribution) |
| POWO / Kew | Check terms per use | Canonical names backbone |
| [Trefle](https://trefle.io/) | **AGPL-3.0** | **Avoid** — AGPL contamination risk for SaaS; beta; rate limits |

For a Melbourne firm with a closed Curtis palette: a **curated species table**
(name, mature size, AS 4970 DBH/TPZ fields) plus occasional GBIF enrichment
beats bolting on a million-row plant API.

## Prioritised adoption order

1. **DXF interop (parser + writer)** — real-CAD unlock; survey ingest + export.
   Blocked on a Stage 2 / contracts schema brief — do not invent DXF fields on
   `DesignCanvas` without product sign-off.
2. **perfect-freehand** — quick Sketch win; wrap behind `strokePointsToPathD`
   (or replace once parity tests pass). Surface 2 pen chips already reconciled
   to MarginStrip / plastic tray — stroke quality is the next lever.
3. **Rough.js** — evaluate vs seeded wobble; adopt only if it deletes more code
   than it adds.

Do **not** start with Rough.js or a CAD framework. Do **not** add Trefle.

## Current stack anchors (so research stays grounded)

| Concern | Today |
| --- | --- |
| Sketch strokes | `packages/domain/src/studio-strokes.ts` (`strokePointsToPathD`) |
| Presentation wobble | `apps/web/.../features/render/seededRandom.ts` |
| Open symbol packs | Osmic + PlanZV + Temaki (plants + site) — all CC0, via domain import scripts |
| Sketch chrome | Surface 2 tray + surface 3 `MarginStrip` (Undo / Tidy / Formalize) |
| Geometry | Hand SVG + Turf; `%` board coords; Workflow 1 only until Stage 2 opens |

## Sources

- [perfect-freehand](https://github.com/steveruizok/perfect-freehand) (MIT)
- [Rough.js](https://github.com/rough-stuff/rough) (MIT)
- [dxf-parser](https://www.npmjs.com/package/dxf-parser) · [dxf-writer](https://www.npmjs.com/package/dxf-writer)
- [Osmic CC0](https://github.com/gmgeo/osmic) · [PlanZV CC0](https://github.com/geoObserver/PlanZV-FNP) · [Temaki CC0](https://github.com/rapideditor/temaki)
- [GBIF terms](https://www.gbif.org/terms) · [Trefle AGPL](https://trefle.io/)
- JSCAD · Maker.js · Paper.js — evaluated and rejected as app shells

## Revision

| Date | Note |
| --- | --- |
| 2026-07-23 | Written from licence-filtered research against Workstream’s SVG / React / commercial constraints. |
