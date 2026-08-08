# Workstream — designer feature & UI inventory

**Audience:** Frontend graphic designer  
**Product:** Workstream operator studio (Curtis & Co landscape co-pilot)  
**Platform:** Desktop-first web (`apps/web`). Expo mobile is a separate app — not this brief.  
**Scope:** Workflow 1 (professional sketch / indicative CAD). Stage 2 survey-grade CAD is out of scope.  
**Date:** 2026-08-09  
**Canonical studio:** `/projects/[id]?mode=…` → `HandoffDesignStudio`

**Read with:** [`STUDIO-STYLING-AND-UX.md`](./STUDIO-STYLING-AND-UX.md) · [`CAD-AI-2026-UX.md`](./CAD-AI-2026-UX.md) · [`design/UIUX-DESIGNER-HANDOFF-SPEC.md`](./design/UIUX-DESIGNER-HANDOFF-SPEC.md) · [`design/TIER1-2026-FRONTEND-DESIGN-SPEC.md`](./design/TIER1-2026-FRONTEND-DESIGN-SPEC.md) · [`design/TIER1-2026-SPEC-GAP-CHECKLIST.md`](./design/TIER1-2026-SPEC-GAP-CHECKLIST.md)

Ignore stale visual briefs: `DESIGNER-HANDOVER.md`, `EXTERNAL-DESIGNER-BRIEF.md` (old fonts / blush chrome).

---

## Hard rules (do not redesign away)

1. **The drawing is the product** — chrome appears when needed; idle rails fade (~6s). No fixed opaque bars parked on the plan.
2. **Camera parenting** — frosted UI lives outside the zoom/rotate camera (`CameraChrome` → `camera-chrome-root`). Never put glass UI inside `zoom-world`.
3. **Two visual dialects** — frame bands = flat monochrome IDE icons; floating docks = frost / neumorphic panels. Do not mix plastic chips into the frame rails.
4. **Inventory is summoned** — asset palette appears at the margin when needed; never a permanent opaque bottom bar on the drawing.
5. **AI is ghost until Accept** — proposed geometry is ephemeral; never silent-write.
6. **Sentence case** labels; **AU locale** (en-AU, AUD, GST).
7. **WCAG AA** text contrast on composited chrome (all five core modes).
8. **Identity** — dark grey gallery frame + cream plan board + frost docks. Not blush-pink chrome, not purple glow, not default Inter/Roboto.

---

## 1. App surfaces (routes)

### Public
| Surface | Route | Elements |
|---------|-------|----------|
| Landing | `/` | Brand hero, enter-studio CTA, privacy footer |
| Privacy / Terms | `/legal/privacy`, `/legal/terms` | Static legal |
| Sign-in / Sign-up | `/sign-in`, `/sign-up` | Clerk hosted |

### Operator (outside studio)
| Surface | Route | Elements |
|---------|-------|----------|
| Home / sites | `/home` | Address composer, project grid, search, delete confirm dialog, planner dock, app nav |
| Confirm pin | `/confirm-pin` | Aerial map pin after address (not a security PIN) |
| Processing | `/projects/[id]/processing` | Pipeline wait screen |

### Studio (one canvas — primary design surface)
| Surface | Route |
|---------|-------|
| Design studio | `/projects/[id]?mode=survey\|sketch\|cad\|elevation\|quote\|present\|share` |

Legacy project sub-pages (`/overview`, `/tasks`, `/design/cad`, etc.) **redirect into the canvas** — do not design separate hubs for them.

### Client-facing
| Surface | Route | Elements |
|---------|-------|----------|
| Quote portal | `/portal/quote/[token]` | Scenario cards, line items, AUD/GST, print sheet, accept → deposit |
| Deposit checkout | `/portal/deposit/[token]` | Stripe handoff |
| Deposit success / cancel | `/portal/deposit-success`, `…-cancel` | Outcome + retry |
| Share twin | `/share/[token]` | Client plan view, accept / decline, revision 404 |

### Settings
**Web settings UI is deleted (404).** Do not invent `/settings/*` screens unless product restores them. API still has crew/rate-card data for other surfaces.

---

## 2. Studio modes (seven lenses)

| Mode | Job | What the designer sees |
|------|-----|------------------------|
| **Survey** | Site facts | Checklist 5/5, Trace / Select / Add, Calib / Level / Servc, title boundary, dwelling, trees, levels, services, keyless washes (planning / bushfire / flood / heritage / contour) |
| **Sketch** | Intent / ink | Sketch dock (pen, eraser, tip grades, image underlay), freehand strokes, tidy / convert |
| **CAD** | Design geometry | Add / Paint / Zone, asset panel, selection orbit + dial, AI ghosts, trenches, zones, TPZ rings |
| **Elevation** | Section read | Elevation board, silhouettes, callouts, plan thumbs, viewpoint strip |
| **Quote** | Indicative price | Quote builder / live cost rail; services ledger **locked** |
| **Present** | Meeting deck | Present surface — pages, swatches, format ghosts |
| **Share** | Client handoff | Share surface — promote quote, portal URL, revision + liability gate |

**Locked-tab copy (when mode unavailable):**
- Sketch / CAD / Elevation → “Complete survey and title boundary first.”
- Quote → “Accept CAD geometry before quoting.”
- Share → “Cost something on the drawing before sharing.”

**Not modes** (instruments / overlays): Fit sheet (**F**), Tilt view, Services ledger, Layers, Live measures, Client presentation chrome.

---

## 3. Tools (left dock & craft)

### Primary tool dock
Chips (appear summoned — not a sticky idle ribbon): Trace · Select · Add · Paint · Zone · Measure · Lock · Grid  
Survey-only (pre-quote): **Calib** · **Level** · **Servc**

Pan is a **gesture** (Space + drag / middle-drag), never a dock tool.

### Sketch dock
Pen · Eraser · Tip grades · Image underlay · Undo / Redo stroke · Tidy · Convert to CAD

### Flora ring (partial)
Radial planting picker when a planting Add session is active — Accept / Dismiss.

### Fit sheet
Toggle **F** or View menu. Cream working drawing overlay, compose peel (pens, themes, atmosphere, widgets, furniture), A3/A4 paper sizes.

### Auto trench / Services
Cmd+K **Auto trench…** → ghost dig paths → Accept.  
**Services ledger** — ticks / focus rows for irrig / conduit / drainage (locked in Quote).

---

## 4. Command palette (Cmd+K) — feature catalogue

Group these as discoverable commands (not sticky buttons):

| Group | Commands |
|-------|----------|
| AI | Ask AI · Scan site · Develop site · Propose lighting & watering · Accept ghosts (header) |
| Site | Title boundary · Prepare site pack · Environment · Site · Existing trees · Spatial correction |
| BYDA | Sewer · Stormwater · Water · Gas · Power · NBN (typed strokes — not title easements) |
| Design | Formalize sketch to CAD · Auto trench… · Services ledger · Cycle design phase · Save design scheme · Buildable area envelope · Scan canopy · Spray uniformity wash |
| View | Zoom to fit · Toggle Fit sheet · Quiet canvas · Tilt view · Looking N/E/S/W · Live measures · Live telemetry · AR bird's-eye · Artboard · Plan · Open quote · Annotate · Undo / Redo |
| Place | Ranked asset place commands from the kit library |

---

## 5. Chrome & UI elements (inventory for art direction)

### Gallery frame
- Outer frame (top / left / right / bottom bands)
- Mode strip (seven modes) + overflow / compact phone nav
- Header: View menu · phase chip · cost chip · AI accept · survey progress pill · cadastral meta · paper size
- Idle recession (rails dim when unused)

### Drawers & rails
- Frame drawers (site meta, artboards, variations) — hover dwell before open
- Sticky Vic-gov chips → Site / Services / Trees / Environment panels
- Right data lane (one at a time): survey checklist · layers · live measures · live cost / quote · ghost review

### Summoned docks & HUD
| Element | Role |
|---------|------|
| Asset panel | Soft / Hard / Trees / Water bags; search; placing state |
| Live BOM | Assemblies / quantities |
| Compliance dock | Setbacks, TPZ, permeability foresight |
| Sun / shade dock | Date scrub, shade grid |
| Lighting dock | LV beams workspace |
| Sheet compose dock | Fit-sheet peel |
| Variation filmstrip | Scheme A/B/C (partial — not generative) |
| Artboard strip | Plan / Fit / Elevation thumbs |
| Undo filmstrip | Bottom-left history |
| Selection orbit + dial | Object adjust; orbit clear of glyph |
| Focus veil | Dim non-selected when orbit open |
| AI capability cue | Contextual tip chip |
| Coach marks | First-run / `?guide=1` |
| Phone compact sheet + FAB | ≤719px bottom tools |

### Context
Header context strip · tool context card · horizon foresight cards (max 2)

---

## 6. Board / drawing elements (what lives on the plan)

| Element | Notes for visuals |
|---------|-------------------|
| Parchment / cream board | Fixed underlay outside camera |
| Aerial underlay | Can hide paper when Fit sheet off |
| Title boundary | Vicmap or Trace; lockable |
| Dwelling footprint | Hatch; context, not hero |
| Easement hatch | + honesty caption (≠ underground assets) |
| Spot RLs | Level tool labels |
| Service corridors | Servc two-point runs |
| BYDA strokes | Typed utilities |
| Existing trees + TPZ rings | DBH-driven canopy discs |
| Proposed planting / hardscape | Canopy, feature, paving, deck, lawn, hedge, bed, french drain… |
| Path corridors | Width / edge / fillet |
| Irrigation / lighting zones | Feed BOM |
| Construction trenches | Ghost until Accept |
| Annotations | Hand lettering font only (Architects Daughter) |
| Shade / sun cast | Live when shade armed |
| Keyless washes | Planning / BMO / flood / heritage / contour tints |
| Buildable envelope | Lot minus setbacks / TPZ / easements / overlays |
| Measure dims | On-plan indicative metres |
| Draft grid | Optional mesh |
| Irrigation uniformity wash | Indicative DU |
| Elevation silhouettes + callouts | Must stay hit-testable |

**Honesty line (always):** Concept sketch for estimating — not a construction drawing.

---

## 7. Client-facing elements

| Surface | Elements to design |
|---------|-------------------|
| Quote portal | Brand, scenario picker, line table, totals (AUD + GST), print stylesheet, accept CTA |
| Deposit | Minimal checkout, success / cancel states |
| Share twin | Plan gallery, accept / decline, dead-link state |
| Operator “client presentation” | Chrome-off theatre, optional sun scrubber, meeting-pack print |
| Present mode | Deck pages, swatches, format ghosts (operator authoring) |

---

## 8. Shared UI kit (primitives)

| Kit | Pieces |
|-----|--------|
| Dialog / Popover / Skeleton | Confirmations, menus, loading rows |
| Kit* | Button, Toggle, Select, Tabs, Separator, Sheet, Tooltip, Input, Textarea |
| App | Toast (info / success / error + action), Submit button, Spinner, App nav, Rail drawer, Planner dock |

---

## 9. Tokens the designer must name against

### Shell
`--surface-base | elevated | sunken | overlay | panel | deep`  
`--ink-primary | secondary | tertiary | inverted`  
`--accent` (+ soft / ink / bright / water)  
`--signal` (sparingly — annotation spark)  
`--ok | --warn | --block | --info`  
Radii `--r-sm…pill` · type `--text-femto…3xl`  
Fonts: IBM Plex Mono / Sans / Serif · hand = Architects Daughter

### Plan ink
`--existing-stroke` · `--proposed-stroke` · `--planting-new-stroke` · `--planting-retain-stroke` · `--easement-stroke`

### Studio chrome
`--ws-frame*` (gallery bands) · `--hc-glass*` / `--hc-neu-*` (floating docks) · `--sheet-paper | ink | border` (Fit sheet)

### Portal
`--portal-surface-*` · `--portal-sheet` · `--portal-accent*` (light sheet on dark shell)

---

## 10. Partial / do-not-fake

| Item | Status |
|------|--------|
| Variation filmstrip | Partial — session schemes, not generative moodboard |
| Flora ring | Partial — session-gated |
| AI dialogue sidecar | Partial — utility + ghosts, not chatbot-first |
| Live telemetry / AR bird's-eye | Indicative / demo-labelled |
| Web settings | Deleted |
| Project hub tabs | Redirect stubs — not separate pages |
| Stage 2 CAD / DXF paper space | Out of scope |

---

## 11. Suggested design deliverables

1. **Gallery frame + idle/active states** — seven mode strip, View menu, cost chip  
2. **Summoned docks kit** — BOM, compliance, sun, lighting, sheet compose (one component language)  
3. **Tool dock + sketch dock** — chip states, hover, phone compact  
4. **Board legend** — existing vs proposed vs planting vs easement vs BYDA  
5. **Fit sheet A3/A4** — cream paper, title block furniture, elevation strip  
6. **Quote / Share / Present** — three distinct client-adjacent compositions  
7. **Portal quote + deposit** — printable light sheet  
8. **Empty / locked / ghost / error** states for modes and AI accept flow  

---

## Code anchors (for engineering sync)

`apps/web/src/components/canvas/handoff/` · `features/toolDock/toolChips.ts` · `features/commandPalette/StudioCommandPalette.tsx` · `styles/globals.css` · `styles/color-tokens.css` · `handoffStudio.module.css`
