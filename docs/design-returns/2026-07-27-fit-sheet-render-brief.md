# Design brief + handover — Fit Sheet: render styles, formatting automation, CAD illustration

**From:** Design & Architecture (Claude) → implementation (fresh context)
**Date:** 2026-07-27
**Surface:** `apps/web/src/components/canvas/handoff/features/fitSheet/*` (+ `features/render/*`)
**Companions:** `2026-07-27-visual-system-and-library.md` (tokens, pen×view×theme), `CURSOR-IMPLEMENTATION-BRIEF.md`

Read this whole brief before coding. It is grounded in a 2026 Tier-1 landscape-proposal
industry review (client-facing deliverable standards) **and** in what the repo already has.

---

## 1. Why (the strategic frame)

The Fit Sheet is the **client-facing deliverable** — the instrument that wins work. Two findings
from the industry review drive every decision below:

1. **Avoid the "hallucination of finality."** Photoreal renders shown too early trigger design
   lock-in: clients fixate on a shrub species or a paver hue instead of layout and circulation.
   Hand-drawn / hybrid CAD aesthetics communicate *fluidity* and invite collaboration. This is
   why the hand-drawn pen is a first-class feature, not a novelty.
2. **Selective colour is authority over the client's eye.** A greyscale/graphite base with **one**
   restrained accent controls visual hierarchy and reads as fine-art quality. Muted cherry =
   warmth, intimacy, the botanical/social heart. Pale blue = serenity, hydrology, atmospheric
   depth (pushes horizons back, makes tight urban sites feel larger). This maps exactly onto our
   existing token law: neutral base + one signal.

**Design law for this surface:** greyscale/graphite base → one selective accent → annotations
carry meaning. Never a full-saturation palette (visual fatigue, mid-market look).

---

## 2. What exists today (start here — don't rebuild)

- `FitSheetOverlay.tsx` — paper frame (A3/A4), site schedule, landscape legend, notes, stacked
  elevation profiles, Vicmap title block, scale ladder (`SHEET_SCALE_STEPS`, Alt+wheel).
- `SheetComposeDock.tsx` + `sheetCompose.module.css` — the compose panel: **theme chips**
  (`parchment` / `ink` / `blush`), **seed** presets (Working drawing / Client brochure / Minimal ink),
  **add** rows (Quote total / Savings ledger / Zone summary / Material swatches).
- `SheetWidgetStack.tsx` / `sheetWidgetContext.ts` — widget composition on the sheet.
- `features/render/` — `AnnotationLayer`, `annotationLayout`, `RenderDefs`, `renderTokens`,
  **`seededRandom`** (deterministic — use for hand-drawn), `speciesLabels`, `symbols/SpeciesSymbol`.
- `geometry/siteScheduleDisplay.ts` — canonical areas/coverage (already sanitised, tested).

**Immediate cleanups:** delete the `blush` theme chip (pink is retired); the compose panel must
consume `--surface-*/--ink-*/--line-*/--r-*/--font-*` tokens instead of its own styling — it
currently doesn't follow the app chrome.

---

## 3. Render pens (the core feature)

One geometry, multiple pens. Deterministic — a given plan renders identically every time
(seed from project id via existing `seededRandom`; never re-randomise on re-render).

| Pen | Look | Implementation |
| --- | --- | --- |
| **Technical** | Thin mono line, no fill, hatch, dimension ticks | Token stroke styles (exists) |
| **Freehand CAD pencil** ★ | Illustrator-style pencil: slightly wobbled lines, doubled/overshot corners, graphite weight variation | **Rough.js** over the same vectors, seeded; pencil grain via SVG filter |
| **Grey shading + outline** | Greyscale tonal fills + crisp outline (the "professional illustrator" register) | Layered greys from the neutral ramp + outline stroke |
| **Selective colour** | Greyscale base + ONE accent (muted cherry **or** pale blue) | Base greyscale, accent applied to one element class only |
| **Dark concept** | Blueprint-negative: white/chalk line on `--surface-deep #182838` | Invert stroke tokens |

Notes: colour shading for the concept register uses the existing plan semantics (planting
greens, stone, water). Pens apply across **plan / elevation / axonometric** (per the visual-system
spec). Photoreal and true vanishing-point perspective are explicitly **out of scope**.

---

## 4. CAD symbols + annotations (what makes it read professional)

Ship the conventions a landscape architect expects:

- **North arrow** (surveyor's needle — exists), **graphic scale bar**, **1:N stamp**.
- **Section markers** — cut lines with arrowed heads and letter/number refs (A–A′), keyed to
  elevation/section sheets.
- **Detail bubbles** — circled ref + leader (`3/A4.2` convention).
- **Levels / spot heights** — RL callouts, datum line on sections.
- **Dimension strings** — witness lines, ticks/arrows, EQ markers, chained dims.
- **Leader-line annotations** — the ubiquitous callout with a short spec note; orange `--signal`
  for annotation/callout ink on the technical pen (the "issued for permitting" register).
- **Material hatch** — per surface, and a **hatch legend/key**.
- **Planting schedule** — coded canopies (`B14/6`) keyed to a species table with counts +
  mature spread; use `speciesLabels` + `SpeciesSymbol`.
- **Title block** — firm, address, PFI/SPI, council, scale, date, revision, and a **status stamp**
  ("Working drawing — indicative", "Issued for permitting", "Not for construction").

Honesty rule (repo law): keep "indicative / not a construction drawing" copy permanent on
technical output.

---

## 5. Formatting automation (the "Rolls-Royce" convenience)

The operator should never hand-place sheet furniture:

- **Auto-compose** — given paper (A3/A4) + orientation + chosen widgets, lay out plan, schedule,
  legend, elevations, title block on a typographic grid with correct margins; auto-pick the scale
  from the ladder to fit the lot (`sheetContentView` already snaps scale — extend it).
- **Seed presets** (extend existing): *Working drawing* (technical pen + dims + status stamp),
  *Client brochure* (selective-colour or freehand pen, index number, concept blurb, axo + plan +
  elevation on a grid), *Minimal ink*, *Dark concept*.
- **Auto-annotate** — derive callouts from the plan (materials, areas, species, TPZ, easements)
  and place with existing `annotationLayout` collision avoidance; operator can edit/dismiss.
- **Multi-sheet set** — plan sheet + elevation/section sheets + schedule sheet, consistently
  numbered (A1.1, A2.1…) with revision letters, from one action.
- **Deterministic + reproducible** — same inputs → same sheet (seeded), so a re-render never
  surprises a client mid-meeting.

---

## 6. Optional (high-value, phase 2)

From the industry review, only if scope allows — each is genuinely differentiating:

- **Temporal rendering** — the same plan at **Year 1 / Year 5 / Year 10** canopy maturity. Manages
  plant-growth expectations (the #1 source of post-install client disappointment) and sells the
  long-term vision. We already model `growth` stages — surface it as a sheet variant.
- **Best-aspect elevations** — technical analysis covers cardinal aspects; *presentation* renders
  are curated from the flattering vantage. Let the operator pick aspects rather than forcing N/S/E/W.

---

## 7. Acceptance criteria

- Pen switch redraws the same geometry with no geometry change and **no layout shift**; identical
  output across reloads (seeded).
- Every pen legible at A3 **and** A4, light and dark, at 375 and 1280 viewports.
- Technical pen carries: north, scale bar, 1:N, dims, section markers, hatch key, title block,
  status stamp, honesty copy.
- Selective-colour pen shows greyscale base + exactly one accent family.
- Auto-compose produces a correctly margined, correctly scaled sheet with no overlapping
  furniture, for both paper sizes and both orientations.
- `blush` theme removed; compose panel consumes app tokens (visually consistent with chrome).
- Client-facing export keeps the frozen quote figures (`ShareRevision`) consistent with the sheet.

## 8. Build boundary (hard rule)

Client hooks must **never import `lib/api`** — it pulls Clerk/`async_hooks` (server-only) and
breaks the web Docker build. Route data through **server actions** (ref `f0239bc`). Applies to any
new render/compose hook here.

## 9. Sequencing

1. Token cleanup on the compose panel + kill `blush`. **HAVE** (`deep` theme + rose→ink migrate).
2. Pen architecture (`sheetPen` on the plan renderer) + **technical** and **freehand pencil** pens. **HAVE** (Rough.js).
3. CAD symbols/annotation kit (§4) on the technical pen. **HAVE** (scale / stamp / hatch key / elev A–A′ / RL / `--signal` ink).
4. Auto-compose + seed presets (§5). **HAVE** (Working / Brochure / Minimal / Dark + margin policy).
5. Selective colour + dark concept pens. **HAVE** (Atmosphere + grey_wash / watercolour / deep chalk).
6. Phase 2: temporal (Year 1/5/10 on Fit via board scrub), multi-sheet sets, best-aspect elevations. **PARTIAL** — temporal rings + brochure elev pick shipped; persisted multi-sheet later.
