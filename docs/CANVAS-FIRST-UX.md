# Canvas-First UI/UX Mandate

**Status:** Binding for operator web (`apps/web` SiteCanvas / Fit sheet / Walk).  
**Companion:** Master CAD architecture plan · Fit sheet paper tokens (`--paper`, `--paper-ink`).

## Goal

Calm, low-cognitive-load, non-technical interface. Geospatial and financial math stay abstracted behind a minimalist, progressive workspace.

## 1. Strict progressive disclosure (state-machine UI)

- Ban monolithic AutoCAD-style tool ribbons.
- Chrome renders only for the active mode: **Survey → Sketch → CAD → Quote → Share**.
- Sketch: no Quantity Survey sheet, no Live BOM HUD, no Walk primary CTA.
- CAD: Fit sheet + line / verify / Walk; Live BOM as compact floating strip.
- Quote: Fit sheet + promote; QS / Build schedules only under **Ledger**.

## 2. Abstracted complexity (invisible engine)

- Never surface Turf boolean math, nested BOM recipes, or sub-base depths in the primary loop.
- Operator draws / tags material; Live BOM updates via Web Worker.
- Recipe depth / parametric edits live only under **More tools** / Advanced inspectors.

## 3. Unobtrusive floating HUDs

- No heavy fixed sidebars for costing.
- Live BOM is floating, collapsible, paper-ink when Fit sheet is on.
- MapLibre / clay Walk bleed edge-to-edge; chrome floats over the canvas.

## 4. Visual calm & muted aesthetics

- Fit sheet: cream paper (`--paper` `#faf6f2`), sharp ink (`--paper-ink` `#241318`).
- Digital clay Walk: MatCap / muted clay, cross-fade 2D ↔ 3D (no hard cuts).
- High-saturation colour only for AI validation / critical risk.

## 5. Human-in-the-loop friction reduction

- AI geometry uses natural language (“Verify AI geometry”) and binary **Accept / Reject**.
- Shortcuts: **A** / **Enter** accept; no coordinate tables in the primary path.

## Live cost feedback (resolved)

**Use both optimistic UI and a muted skeletal pulse.**

| Phase | HUD behaviour |
| --- | --- |
| Draw / mutate | Instant optimistic total (mutation bus) |
| Worker in flight | Same total + skeletal pulse (cream/ink, not spinner chrome) |
| Worker / API settle | Cross-fade to precise total; pulse clears |

Do not show empty skeleton placeholders instead of a number when an optimistic estimate exists. Do not flash raw worker JSON or “calculating…” modals.

## Engineering checklist (non-negotiable)

| Mode | Allowed chrome | Forbidden |
| --- | --- | --- |
| Survey | Title / Lock / Open Fit sheet | Live BOM, QS, Walk primary, brush ribbon |
| Sketch | Paint disclosure → brushes; Draft Fit sheet | Live BOM, QS schedule, CAD line dock |
| CAD | Accept / Line / Walk; compact Live BOM | Full QS sheet auto-open; recipe depth editors |
| Quote | Promote; Ledger disclosure for QS/Build | Always-on schedule overlay |
| Share | Copy/Open portal + Walk; Fit sheet under More | Live BOM, Tier-1 ledger, edit ribbons |

**CSS tokens:** `--paper`, `--paper-ink`, `--paper-rule` on SiteCanvas root.  
**Code anchors:** `resolveCanvasChrome` (`apps/web/src/lib/canvas-chrome.ts`), `showCadAdvanced`, `quoteToolsOpen`, `sketchPaintOpen`, `ClayWalkthrough` cross-fade.  
**Tests:** `canvas-chrome.test.ts` · e2e `e2e/canvas-first.spec.ts`.
