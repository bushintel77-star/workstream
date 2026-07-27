# Design return — visual system, glass catalogue, render styles

**From:** Design & Architecture (Claude) → Cursor
**Date:** 2026-07-27
**Scope:** the token system, the asset/plant library treatment, and the plan render-style matrix.

## Token architecture (three layers — don't merge them)

1. **`globals.css`** — app chrome. Retuned this session: neutral paper `--surface-*`, cool ink `--ink-*`, `--surface-deep #182838` (inky blue-grey frost), slate `--accent #4f6a89` (quiet interactive), **`--signal #e65416`** (technical orange — the single flash), sharp radii (`--r-md 7`), slim studio dims, pink body-gradient wash removed, neutral shadows.
2. **`color-tokens.css`** — canvas plan semantics + cool grey ramp (`--gray-l-*`, `--text-primary`, `--panel`, `--canvas`). Existing = crimson, proposed = cobalt, planting = forest/sprout/sage/hedge/olive, water blue, materials, APWA services. Left untouched — this is the plan's colour language.
3. **`handoffStudio.module.css` `--hc-*`** — studio chrome, derived from layer 2's grey ramp. Retuned this session: radii 10/14 → 6/8; added `--hc-signal`, `--hc-signal-ink`, `--hc-deep`. (The studio's earlier "pink" was the body gradient bleeding through translucent glass — fixed at layer 1.)

**The law:** neutral is ~95% of every surface. Semantics live only on the canvas. The orange signal is one hero element per view (measured m², best-bet, primary CTA) — never on canvas.

## Glass catalogue — asset / plant library

The expanded library should read as a **thin frosted glass pane laid on the canvas, not a separate slab**:

- Translucent frost (`--hc-glass-soft` + `backdrop-filter: blur`), **feathered edges** via `mask-image` gradient so it dissolves into the canvas rather than ending on a hard border.
- **Super-thin minimal slider** (2–3px rail), not a chunky scrollbar.
- **Dynamic** — a cursor swipe pulls up / pages through multiple assets (carousel/scrub over the catalogue), the slim slider as the scrub affordance.
- **Catalogued, not crammed** (ref: the German plant-palette board): grouped by category (trees / hedges / perennials / grasses…), each tile = canopy glyph + botanical name + mature-size scale bar + seasonal colour dots. Generous whitespace.

Data already exists (studioCatalog + Curtis flora palette); the gap is the catalogue tile (mature spread, season, glyph) and the swipe/slider interaction.

## Plan render styles (presentation fit sheet)

**Two axes: view × pen.** One geometry, redrawn.

- **Views:** plan · elevation · 3D (axonometric tilt — the existing `TiltBuildingExtrusion`).
- **Pens:** technical mono · concept colour · soft/watercolour · **hand-drawn** · **dark concept**.
- **Dark concept (blueprint-negative)** — deep grey-blue ground (`--surface-deep #182838`) with white/chalk line assets; the orange signal carries callouts/annotations on the dark ground. It's the technical pen inverted (white stroke on deep-blue instead of ink on paper), so it reuses existing tokens — trivial to add.
- **Hand-drawn** = render the same vector shapes through **Rough.js**, deterministically **seeded** so a plan looks identical each render (honesty, not re-invented). Sketchy tree glyphs replace clean canopies.
- **Watercolour** = SVG filter presets (soft blur + paper tooth + low-opacity fills).
- Wire to the Compose-sheet style enum (extends Working drawing / Client brochure / Minimal ink) and preview live on `FitSheetOverlay`.

**Pen vs composition — keep separate.** The *pen* is how the plan geometry is drawn (above). The *sheet theme* is the composed page it sits in:
- **Working drawing** — technical pen, title block, annotations, "issued for permitting" status (ref: AS-DRAWN / 30x40, OUTPOST).
- **Client brochure** — a designed presentation page, not just a plan: index number (NO.1), section title, short concept blurb, then exploded **axonometric + plan + elevation** on a typographic grid with title block. Available on light paper or the **dark concept** deep grey-blue ground. Ref: the NO.1 axonometric board.
- Orange signal is the annotation/callout spark in both; semantics stay on the drawing.
- Orange signal stays the technical-annotation spark on the working-drawing pen (ref: the OUTPOST "issued for permitting" sheet).

**Out of scope / separate track:** photoreal raster render, and true vanishing-point perspective 3D (the canvas is axonometric, not a perspective camera) — both bigger lifts, don't bundle.

## Done this session (in tree, unstaged, needs dev-server reboot)

- `globals.css` — neutral + sharp + slim + `--signal` orange + `--surface-deep`.
- `handoffStudio.module.css` — studio radii sharpened, signal/deep wired.
- `confirm-pin` loader — full-bleed aerial, neighbourhood→lot zoom, **spotlight scrim** (dims every other property, target lot punched out), frosted deep-blue chrome with **chalk-white text**, capability narrative ("Linking to Vicmap…", "Talking to council…", "Scanning for heritage overlays…"), measured m² as the **orange flash**.

## Not in this tree (Cursor owns)

The Compose-sheet card (has its own theme system + must consume tokens), the survey checklist, and any newer surfaces — apply the same three-layer token law there.
