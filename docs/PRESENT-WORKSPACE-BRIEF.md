# Present workspace — phase brief (draft for review)

**Status:** Draft for owner review. Nothing here is built yet. This brief exists
because the Present workspace is a new product scope, and CLAUDE.md requires a
written brief before Stage-2-class work (new view, new schema).
**Date:** 2026-08-02 (rev. after dev review)
**Companions:** [STUDIO-PRODUCT-PHASES.md](./STUDIO-PRODUCT-PHASES.md) ·
[SHEET-PRESENTATION.md](./SHEET-PRESENTATION.md) ·
[DESIGN-PACKAGE-SPEC.md](./DESIGN-PACKAGE-SPEC.md) ·
[QUOTE_WORKFLOW.md](./QUOTE_WORKFLOW.md)

> **Dev review resolutions (fold into the schema brief before Phase 0 sign-off):**
> 1. **Orientation data.** The aspect/sun design logic (§5.1) needs a bearing the
>    contracts don't hold. Add `north_bearing` to `DesignSiteFrame`; derive aspect
>    from it. Phase 2 depends on this landing first.
> 2. **Template enum.** Two-surface model: the new `PresentationDocument` gets its
>    own closed template enum; the fit-sheet `PresentationPack` keeps its
>    free-string `template_id` + `curtis-client-brochure` / `cleared` sentinels.
>    No migration now. `curtis-client-brochure` is the peel seed, **not** one of
>    the Present tab's 4–5 templates.
> 3. **PDF export.** No print-to-PDF path exists today (Share is DXF/glTF/SVG).
>    Broken out as its own sub-phase (Phase 1a).

---

## 1. Positioning — separation of concerns

Two concerns, kept apart:

1. **Design studio (build).** The designer builds the garden — boundary, line
   and garden CAD work, planting, hardscape, services. This is Workflow 1 as it
   stands today. It does not change.
2. **Present tab (compose).** Woven into the *same product* as another tab
   across the top — beside Survey / Sketch / Cad / Elevation / Quote / Share
   (the mode enum is `survey | sketch | cad | elevation | quote | share`; Present
   slots after Quote) — not a separate app or a second page. Clicking Present
   opens a **fresh canvas for formatting**: AI dissects the plan into sections and
   feature areas, the designer shuffles those panels on a page, and AI applies
   editorial formatting to produce print-ready decks, quotations, mood boards and
   concept sketches. Unlocked via `unlockedModes` — the same canvas-mode gate as
   Share (see §9 for the exact signal and touch points).

The design surface stays about *truth of the plan*. The Present tab is about
*telling the story of the plan*. It is the same product and the same project —
just a clean canvas for the storytelling step. Mixing the two on one surface is
what the current fit-sheet compose peel does, and it is why compose has stayed
deliberately small.

## 2. A two-surface presentation model (honours "not a second product")

[SHEET-PRESENTATION.md](./SHEET-PRESENTATION.md) is binding that presentation is
"not a second product" — and that stands. Present is **not** a separate app; it
is the same product and the same project, reached by another tab across the top.

This is not a "one narrow revision" — it is an explicit **two-surface model**, and
naming it that way stops the fit-sheet peel being mistaken for drift later:

- **Fit-sheet peel (in-studio, plan-truth).** A single sheet on the design canvas.
  Keeps its `PresentationPack`, its free-string `template_id`, and its
  `curtis-client-brochure` / `cleared` seed behaviour. Unchanged.
- **Present tab (multi-page storytelling).** A fresh formatting canvas with its
  own `PresentationDocument`, its own closed template enum, and multi-page output.

SHEET-PRESENTATION said "not a separate app **or mode tab**." The revision is
narrow in spirit (still one product, one project) but real in surface: Present is
a sibling tab. The "one canvas" rule becomes "one canvas *per tab*" — the design
tab's plan-truth canvas is untouched; Present gets a clean canvas for storytelling.
Recorded as a decision, not drift. If accepted, SHEET-PRESENTATION.md gets a header
note pointing here.

## 3. What already exists (build on, do not reinvent)

| Existing piece | What it gives us |
| --- | --- |
| `PresentationPackSchema` (`packages/contracts`) | theme, pen, atmosphere, `template_id`, up to 24 typed widgets |
| Typed widgets | `quote_total` (live BOM incl. GST), `savings_ledger`, `zone_summary`, `material_swatches`, `caption` |
| `ImageLayerSchema` | imported photo / plan underlay with `%` position, width, rotation, opacity, blend mode, lock |
| `FitSheetOverlay` + `ArchitecturalTitleBlock` | cream paper lens, title strip, scale ladder, stacked elevations, callout furniture |
| Sheet compose dock / `SheetWidgetStack` | slot model (`title_meta`, `side_stack`, `footer_band`), add/remove chips, themes, pens |
| Auto-seed brochure (`curtis-client-brochure`) | first-open template seeding |
| `DESIGN-PACKAGE-SPEC` / `QUOTE_WORKFLOW` | package + costing contracts the quotation deliverable draws from |

The material-swatch widget, image layers, pens (technical / hand-drawn / grey
wash / watercolour) and the quote total already cover a surprising amount of the
four reference boards. The gap is *composition*, not primitives.

## 4. The genuinely new capabilities

1. **AI plan dissection.** Take the finished `DesignCanvas` and auto-cut it into
   named panels — plan overview, feature areas (courtyard, terrace, edible
   garden), aspect crops (N/E/S/W), detail zooms tied to callout bubbles. Each
   panel is a reusable, re-croppable reference to plan geometry, not a flat
   raster, so it stays live if the plan is edited.
2. **Draggable multi-panel composer.** A page (or pages) onto which panels,
   images, swatches and text blocks are dropped and shuffled. Extends the
   `%`-coordinate model already used by `ImageLayer`, but across an ordered set
   of pages rather than one sheet.
3. **AI editorial formatting.** Given the panels and a deliverable type, AI
   proposes a layout — grid, hierarchy, captions, whitespace, type scale — in the
   Curtis / practice house style. Designer nudges; AI reflows. Editorial, print-
   ready, not a blank freeform canvas.
4. **Print-ready output.** Page size, bleed, title block, export to PDF at the
   chosen scale. Quotation pages bind to live BOM so pricing is never stale.

## 5. Deliverable types (all four in scope for the vision)

| Deliverable | Core content | Draws from |
| --- | --- | --- |
| Client presentation deck | plan overview, feature-area panels, elevations, render, site photos, narrative | plan dissection, `ImageLayer`, elevations |
| Quotation / pricing doc | branded proposal: schedule, staged pricing, inclusions, terms | `quote_total`, DESIGN-PACKAGE-SPEC, QUOTE_WORKFLOW |
| Material / mood board | swatch grid + reference imagery + captions | `material_swatches`, `ImageLayer` |
| Concept site sketch | looser hand-drawn / watercolour concept overlay for early storytelling | hand-drawn / watercolour pens, plan geometry |

## 5.1 Editorial framework — design logic + constrained choice (80/20)

**Editorial and premium through minimalism.** The templates are not busy. The
premium feel comes from a minimal, disciplined framework — an editorial piece,
not a poster maker. Ease of use is the first principle; AI does the heavy lifting.

**Design logic (why AI cuts where it cuts).** Segmentation is not arbitrary. AI
sections the drawings by what best suits *this* garden design crossed with the
property's *fixed physical aspects* — orientation, where the sun hits, aspect,
frontage. The plan/renders and their relationship to the site drive the panels
(e.g. a sunny north terrace becomes its own feature panel because the aspect
makes it the hero). This is **title-centric design logic**: the title/site
truth leads the composition.

> **Data dependency (blocker 1).** This logic needs a north bearing, which
> `DesignSiteFrame` does not currently hold (it has boundary / building /
> easements / services / levels / drainage). The schema brief adds `north_bearing`
> to `DesignSiteFrame` and derives aspect from it. Until that lands, aspect crops
> (N/E/S/W) and sun-driven feature detection are not implementable — Phase 2 is
> gated on it.

**Constrained choice — the 80/20 rule.** Give the designer real choice, but cap
variation so every output is good. Maximum *variation within* a small set of
frameworks, not infinite freedom:

| Lever | The constraint |
| --- | --- |
| Templates | **4–5 editorial template designs** only. Minimal, premium. |
| Colour | A colour wheel, but a **capped palette** (a handful of editorial colours). |
| Highlight | **One** highlight colour only, used for annotations / accents. |
| Type | A few **architectural-style fonts** plus one **hand-written** style. |
| Regions | Defined slots: a **design blurb** block; **four squares** for drawings (main plan, sections, elevations, features); then **labour + product/plants** (schedule). |
| Interaction | Click-and-drag to arrange within the template — not a blank canvas. |

**AI leads best practice.** The AI's job is not just layout — it guardrails the
designer toward how a landscape designer *should* present the product: fundamental
architectural presentation best practice (hierarchy, whitespace, title block,
consistent scale, restrained colour). Choice is bounded so the floor is high. AI
proposes the best-practice arrangement; the designer nudges within the rails.

These constraints are the product, not a limitation — they are what make the 80
that ships look like the 20 that a studio would labour over.

## 6. Data model / contracts implications

This needs a new schema, which per CLAUDE.md means a schema brief before code.
Sketch of the shape (to be ratified, not final):

- A `PresentationDocument` — ordered `pages[]`, each with `panels[]`; a panel is
  a discriminated union of `plan_crop` (ref into `DesignCanvas` geometry +
  crop rect, tagged with the design-logic reason: `feature` / `aspect` /
  `elevation` / `section` / `overview`), `image` (reuse `ImageLayer`),
  `widget` (reuse typed widgets), `text`, `swatch_board`.
- **`template_id` — new closed enum, scoped to `PresentationDocument` only**
  (4–5 editorial templates, each defining its named slots: blurb, four drawing
  squares, labour + product schedule). This does **not** touch the fit-sheet
  `PresentationPack`, which keeps its free-string `template_id` and its
  `curtis-client-brochure` / `cleared` sentinels (blocker 2 — two-surface model,
  no migration). `curtis-client-brochure` is the peel seed, not a Present template.
- `deliverable_type` enum (deck / quotation / mood board / concept sketch)
  driving default template + which widgets seed.
- Theme: a **capped palette** (bounded set, not open colour), a **single
  `highlight_colour`**, and a `font` enum (a few architectural faces + one
  hand-written). Reuse `pen` / `atmosphere` where they already fit.
- Page furniture: `paper_size`, `title_block`, bleed/margins — reuse
  `ArchitecturalTitleBlock`.
- **`north_bearing` on `DesignSiteFrame`** (blocker 1) — the aspect/sun design
  logic reads it; add it here so the plan carries orientation truth. Convention:
  **degrees 0–360, true north (not magnetic), stamped by aerial/Vicmap
  calibration.** The aspect quadrant (N/E/S/W) is *computed* from it, not stored —
  keeps the field minimal and avoids the "modelled figure" trap the contracts
  already warn about. Sun/shade and the neighbour-massing overshadowing work both
  consume the same true-north value.
- **Persistence — a new top-level field on `Project`**, *not* inside
  `DesignCanvas`. `presentation_pack` lives inside `DesignCanvas` today; putting
  the deck there would re-couple it to the plan we are separating from. A
  `Project`-level `presentation_documents[]` keeps "the plan never writes back"
  honest and lets a project hold several decks.

Contracts change first (`packages/contracts` is the boundary), then API, then
the web view.

**PDF export is not free (blocker 3).** Share today exports DXF / glTF / SVG only;
there is no headless-print or PDF-lib path in the repo. Reusing
`ArchitecturalTitleBlock` gives the title-block graphic, not a PDF. Print-to-PDF
is its own sub-phase (Phase 1a): headless Chromium print-to-PDF on the API,
reusing the studio's existing print-media CSS, is the leading direction — vs. a
vector PDF lib — but the sub-phase ratifies the choice and where it runs
(web client vs. API). Do not treat print as a composition detail.

## 7. Suggested phased build (gates, review at each)

- **Phase 0 — this brief + schema brief.** Ratify the two-surface split, the
  `PresentationDocument` schema, `north_bearing` on `DesignSiteFrame`, and the
  `Project`-level persistence. No UI.
- **Phase 1 — Present view shell + manual composer.** New route/view, page +
  panel model, drag/resize/reorder, reuse image layers and typed widgets. No AI
  yet. Proves the separation.
- **Phase 1a — print-to-PDF (own sub-phase).** Stand up the print path (headless
  Chromium on the API, print-media CSS) — a real dependency, not a detail.
  **Infra cost to flag at sign-off:** headless Chromium means a Chromium runtime
  in the Railway API container — larger base image and higher memory. Name this
  now so it is a ratified cost, not a mid-phase surprise.
- **Phase 2 — AI plan dissection.** *Depends on `north_bearing` from Phase 0.*
  Auto-generate feature-area and aspect panels from the finished plan; designer
  accepts/re-crops (ghost-until-accept, matching the AI-CAD pattern).
- **Phase 3 — AI editorial formatting.** Layout proposals per deliverable type in
  house style; reflow on nudge.
- **Phase 4 — deliverable templates.** Deck, quotation, mood board, concept
  sketch templates wired to live data (quotation binds to BOM).

## 8. Scope guards (out of scope for now)

- Not a general-purpose Canva clone or freeform infinite canvas — it is editorial
  and template-led, print-first.
- Not real-time multi-user co-editing (store is single-tenant — CLAUDE.md).
- Does not modify plan geometry. The Present workspace reads the plan; it never
  writes back to `DesignCanvas`.
- No new global state library, no CSS-in-JS (CLAUDE.md conventions hold).

## 9. Open questions for the owner

1. **Entry:** *Resolved* — a top-level tab after Quote / Share, same product,
   opening a fresh formatting canvas. **Gate = `unlockedModes`**, the existing
   canvas-mode mechanism, mirroring Share. Three distinct signals must not be
   conflated:
   - `unlockedModes(progress: CanvasProgress)` in `apps/web/src/lib/canvas-mode.ts`
     — the unlock mechanism. Share opens on `progress.hasQuote`; **Present opens on
     the same `hasQuote`** (which already implies accepted CAD upstream).
   - `DesignLifecyclePhase` (on `DesignCanvas`: concept … post_occupancy) — a
     *separate* enum. Optional later "is this design mature enough to present?"
     guard; **not** the unlock, not Phase 1.
   - `Project.status` (draft … complete) — the pipeline signal; unrelated to the
     canvas-mode gate.

   Phase 1 touch points in `canvas-mode.ts` (honest scope): add `present` to the
   `CanvasMode` type, `CANVAS_MODES`, `unlockedModes` (behind `hasQuote`),
   `parseCanvasMode`, `suggestedMode`/`resolveCanvasMode`, and `modeForLegacyPath`.
2. **Live vs snapshot:** *Resolved (ghost-until-accept)* — a panel pins to a plan
   *revision* on placement (snapshot ref) so drag-arranging is stable, with an
   explicit "sync to latest" action. Issued decks freeze by default; in-progress
   decks stay stable while composing. Same discipline as the AI-dissection accept.
3. **House style:** one Curtis template family to start, or per-practice theming
   (the TRIAS reference implies white-label title blocks)? *Open.*
4. **Print target:** A3 landscape decks, A4 portrait quotes, or both from day one?
   *Open — feeds Phase 1a.*
