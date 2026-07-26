# Fit sheet presentation compose (canvas feature)

**Status:** Binding for Fit sheet as a **presentation compose feature** inside `HandoffDesignStudio` — not a separate app or mode tab.  
**Date:** 2026-07-26  
**Companions:** [STUDIO-STYLING-AND-UX.md](./STUDIO-STYLING-AND-UX.md) · [CAD-AI-2026-UX.md](./CAD-AI-2026-UX.md)

## Feature law

One canvas. Fit sheet (**F**) is the cream paper lens. Presentation widgets are **paper ink** inside the schedule / notes regions.

Compose chrome is **header-summoned only** (icon next to Fit / print) — a soft frost peel that dismisses on Esc, linger, or ×. **No rail. No parked card.** Idle Fit shows the drawing + paper alone.

This is **not** a second product. Quote mode stays cost truth; Share stays send/portal.

### Auto-seed

First Fit open with an empty pack and **no** `template_id` seeds `curtis-client-brochure` onto the **paper**. Compose peel stays closed.

**Clear** sets `template_id: "cleared"` so Fit does not re-seed.

## Clever constraints

| Pillar | Rule |
|--------|------|
| Hero | Live `%` plot + title block stay primary |
| Chrome | Header icon → summoned peel via CameraChrome; zero chrome when closed |
| Slots | `title_meta` (quiet caption) · `side_stack` (Presentation after schedule) · `footer_band` (notes) |
| Library | Typed widgets; add/remove chips — no `<select>` |
| Themes / seeds | Only while peel is open |
| Cap | Max 24 widgets |

## Widget honesty

| Widget | Source |
|--------|--------|
| `quote_total` | Live BOM incl. GST |
| `savings_ledger` | Wrights proposal ledger (Tier-1); hidden off-tier1 |
| `zone_summary` | Irrigation zones or placement massing |
| `material_swatches` | Placed materials |
| `caption` | Template or `text` |
| `honesty_footer` | Legacy only — not seeded, not rendered |

## Data

Optional `DesignCanvas.presentation_pack` — autosaved with the canvas.

## Phases

1. **Now** — header summon, quiet on-sheet faces, live zone/material, persist, e2e  
2. On-paper drag between slots; editable copy  
3. AI layout ghosts; optional mood-still widget  
