# Canvas-First UI/UX Mandate

**Status:** Binding for operator web — SiteCanvas / Fit sheet / Walk **and**
`HandoffDesignStudio` (Design Studio v4/v5 handoff board).  
**Companions:** [handoff README](./design/operator-redesign/design_handoff_landscape_cad_studio/README.md) · Fit sheet paper tokens (`--paper`, `--paper-ink`).

## Goal

Maintain a calm, low-cognitive-load, non-technical interface. Complex geospatial
and financial math must remain completely abstracted behind a minimalist,
progressive workspace.

---

## 1. Strict progressive disclosure (state-machine UI)

**Action:** Ban monolithic, AutoCAD-style tool ribbons.

**Implementation:** Enforce contextual rendering of UI chrome based strictly on
the active state (**Survey → Sketch → CAD → Quote**). If the user is in Sketch,
completely hide Quantity Survey and Live BOM sidebars. Only surface tools that
are immediately relevant to the active context.

| Mode | Allowed chrome | Forbidden |
| --- | --- | --- |
| Survey | Title / Lock / Open Fit sheet | Live BOM, QS, Walk primary, brush ribbon |
| Sketch | Paint disclosure → brushes; Draft Fit sheet | Live BOM, QS schedule, CAD line dock |
| CAD | Accept / Line / Walk; compact Live BOM | Full QS sheet auto-open; recipe depth editors |
| Quote | Promote; Ledger disclosure for QS/Build | Always-on schedule overlay |
| Share | Copy/Open portal + Walk; Fit sheet under More | Live BOM, Tier-1 ledger, edit ribbons |

**Code:** `resolveCanvasChrome` (`apps/web/src/lib/canvas-chrome.ts`) ·
`resolveHandoffChrome` (`apps/web/src/components/canvas/handoff/state/handoffChrome.ts`).

---

## 2. Abstracted complexity (the invisible engine)

**Action:** Hide parametric variables from the primary user loop.

**Implementation:** The user should never see Turf.js boolean nesting or full BOM
assembly recipes in the primary path. They draw a shape, tag it “Bluestone,” and
the Live BOM HUD updates seamlessly (continuous `estimateStudioDrawing` /
mutation bus; Web Worker when wired). Sub-base depth and tipper logistics live
only under **Advanced**.

---

## 3. Unobtrusive floating HUDs

**Action:** Maximize the workable canvas area.

**Implementation:** Prefer floating, semi-transparent, collapsible HUDs (Live
cost widget, utility indicator tabs) over heavy fixed sidebars. The drawing plane
bleeds edge-to-edge under chrome (parchment / aerial handoff board today;
MapLibre / Three.js Walk where those surfaces are mounted).

---

## 4. Visual calm & muted aesthetics

**Action:** Standardize Fit sheet paper mode and Digital Clay 3D aesthetics.

**Implementation:** CSS variables for a muted architectural palette — cream
canvases (`--paper` `#faf6f2`), sharp dark ink (`--paper-ink` `#241318`),
low-saturation highlights. Cross-fade 2D ↔ 3D Walk; no hard cuts. High saturation
only for AI validation / critical risk.

---

## 5. Human-in-the-loop friction reduction

**Action:** Make AI interactions feel like a conversation, not a database query.

**Implementation:** AI Ghost / coach dock uses natural-language microcopy and
simple binary actions (**Accept / Reject**, **Yes, add it / Not now**) rather
than requiring the user to verify individual data tables or spatial coordinates.
Shortcuts: **A** / **Enter** accept where implemented.

---

## Live cost feedback (resolved)

**Use both optimistic UI and a muted skeletal pulse.**

| Phase | HUD behaviour |
| --- | --- |
| Draw / mutate | Instant optimistic total (mutation bus) |
| Worker in flight | Same total + skeletal pulse (cream/ink, not spinner chrome) |
| Worker / API settle | Cross-fade to precise total; pulse clears |

Do not show empty skeleton placeholders instead of a number when an optimistic
estimate exists. Do not flash raw worker JSON or “calculating…” modals.

---

## Engineering anchors

| Concern | Anchor |
| --- | --- |
| SiteCanvas chrome | `resolveCanvasChrome` · `canvas-chrome.test.ts` · `e2e/canvas-first.spec.ts` |
| Handoff studio chrome | `resolveHandoffChrome` · `handoffChrome.test.ts` |
| Invisible estimate | `estimateStudioDrawing` · Live BOM **Advanced** disclosure |
| Paper tokens | `--paper`, `--paper-ink`, `--paper-rule` |
| Clay Walk cross-fade | `ClayWalkthrough` |
