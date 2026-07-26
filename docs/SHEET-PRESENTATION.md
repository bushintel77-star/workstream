# Fit sheet presentation compose (canvas feature)

**Status:** Binding for Fit sheet as a **presentation compose feature** inside `HandoffDesignStudio` — not a separate app or mode tab.  
**Date:** 2026-07-26  
**Companions:** [STUDIO-STYLING-AND-UX.md](./STUDIO-STYLING-AND-UX.md) · [CAD-AI-2026-UX.md](./CAD-AI-2026-UX.md)

## Feature law

One canvas. Fit sheet (**F**) is still the cream paper lens. When Fit is on, operators can **compose** client-facing sheet chrome around the live plot: quote callout, savings, swatches, caption — templates, theme swatches, widget library, drag between slots, Auto-format.

This is **not** a second product. Quote mode stays cost truth; Share stays send/portal; Survey/Sketch/CAD stay design authoring.

### Auto-seed

First Fit open with an empty pack and **no** `template_id` seeds `curtis-client-brochure` so widgets are visible immediately. **Clear** sets `template_id: "cleared"` so Fit does not re-seed an intentional blank sheet.

## Clever constraints (2026 brochure quality without Canva)

| Pillar | Rule |
|--------|------|
| Hero | Live `%` plot stays the drawing — widgets orbit it in slots |
| Slots | `title_meta` · `side_stack` · `footer_band` (snap, not freeform chaos) |
| Library | Typed widgets only (quote, savings, zones, swatches, caption, honesty) |
| Themes | `parchment` · `ink` · `blush` |
| Templates | Curtis seeds + apply; save-custom later |
| Auto-format | Deterministic reflow by widget priority |
| Chrome | Compose dock via **CameraChrome** only |
| Cap | Max 24 widgets (contract + domain) |

## Widget honesty (live vs static)

| Widget | Source |
|--------|--------|
| `quote_total` | Live BOM / indicative quote incl. GST |
| `savings_ledger` | Wrights Terrace **proposal** ledger (Tier-1 demo); N/A off-tier1 |
| `zone_summary` | Live irrigation zone names, else placement massing |
| `material_swatches` | Chips + labels from placed materials on the board |
| `caption` / `honesty_footer` | Template or operator `text` override |

## Data

Optional `DesignCanvas.presentation_pack` — theme, template id, widgets. Autosaved with the canvas (full PUT upsert).

## Phases

1. **Now** — schema, templates, themes, library, drag slots, reflow, live zone/material faces, persist, e2e  
2. Editable widget copy; owner-saved templates  
3. AI layout ghosts (Accept/Reject); optional mood-still widget type  
