# Workstream — UI/UX Designer Handoff Spec
**Prepared for:** Third-party UI/UX designer
**Product:** Workstream — voice-first landscape design + build co-pilot for Curtis & Co (Melbourne)
**Date:** August 2026
**Verified against codebase:** 2026-08-05

---

## 0. Verification notes (2026-08-05)

This spec was checked line-by-line against the live repo (routes, component files, design tokens, CI tests) before handoff. Corrections are applied inline throughout; this section is the full list of what changed and why, so nothing is silently different from what was drafted.

**Corrected in this version:**

- **Tech stack (§1).** The web app runs **Next.js 16** (`^16.2.12` in `apps/web/package.json`), not Next.js 15.
- **§3.1 / §7.1 — dashboard route.** The operator dashboard is **`/home`**, not `/`. `/` is the public marketing landing page (`LandingPage`, `app/page.tsx`) — §15.6 #99 already had this right; §3.1 and §7.1 were out of sync with it.
- **§3.2 / §15.5 #94 — confirm-pin.** `/confirm-pin` is **not client-facing** and has **no `[token]` segment**. It's an operator-only step (`app/confirm-pin/page.tsx`, plain query params `address`/`lat`/`lng`) — the aerial zoom-in "locate loader" that runs right after the operator picks an address and before the project/canvas exists. There's no PIN code anywhere in the code; "pin" is the map pin dropped on the address, not a security PIN. Moved out of the client-facing table into §3.1/§15.1; priority note in §16 corrected.
- **§15.3 #34 `/design/develop`.** This route is a **legacy redirect** to `/projects/[id]?mode=quote` (`redirectToCanvas(id, "quote")`), not a distinct "AI develop" page. The real Cmd+K flow lives inside the studio as `StudioCommandPalette` (#39).
- **§15.3 #35 `/design/cad`.** Also a **legacy redirect**, to `/projects/[id]?mode=cad` (the Workflow 1 CAD tab) — not a Stage 2 layered CAD editor. Per `CLAUDE.md`, Stage 2 CAD is explicitly out of scope today; no such editor exists in the codebase yet.
- **§15.7 #110 Activity timeline.** `components/activity-timeline.module.css` exists, but **no component imports it** — there is no `ActivityTimeline` component anywhere in the repo. This is dead CSS, not a shipped feature. Recommend dropping it from the Tier 2 priority list until it's actually built.
- **§15.7 #117/#118 — Dialog/Popover.** The real components are **`Dialog`** and **`Popover`**, living in `components/ui/` — not `KitDialog`/`KitPopover`, and not inside `components/ui/kit/` alongside the other Kit primitives. `components/ui/kit/` also ships `KitInput`, `KitSelect`, and `KitTabs`, which weren't in the original inventory — noted below the table.
- **§15.5 #90 — deposit page.** The client deposit page's actual component is **`DepositPage`** (`app/portal/deposit/[token]/page.tsx`), not `DepositPortal`.

**Flagged, not changed:**

- **§15.4 #75 `RightDataLane`** is a state/types module (`rightDataLane.ts`, no JSX) that tracks which right-lane panel is open — not itself a rendered panel. The rendered panels are the individual feature components (e.g. `SiteMetaPanel`) that read this state.
- The repo has two older designer-facing docs with stale technical specifics — `docs/EXTERNAL-DESIGNER-BRIEF.md` (2026-07-17, Garden Atelier/Fraunces/moss-green direction; URL corrected to Railway 2026-08-05 but typography/colour direction is stale) and `docs/DESIGNER-HANDOVER.md` (2026-05-21, Inter/JetBrains/orange direction, references `DesignStudio.tsx`/`DesignAssetPalette.tsx`/`ScaleBar.tsx` — all three confirmed deleted from the codebase). Their fonts, colors, and named components don't match the shipped product. **They were not deleted**, though — four of the five binding docs in §13 (`CANVAS-FIRST-UX.md`, `CAD-AI-2026-UX.md`, `OPERATOR-STUDIO-GOLD-WALKTHROUGH.md`, `STUDIO-PRODUCT-PHASES.md`) still cite `DESIGNER-HANDOVER.md` for product scope/context, and `docs/design/operator-redesign/design_handoff_landscape_cad_studio/` (an early HTML mockup + screenshots, also initially miscategorized as safe to delete) is named "Visual source of truth" by `apps/web/src/components/canvas/handoff/ARCHITECTURE.md` in the live studio code. Both need their factual claims corrected in place, not removal — deleting them would orphan several binding-doc references. The three dead `components/studio/` files from the same era (`DesignCanvasPlacement.tsx`, `GhostCursor.tsx`, `SwatchPad.tsx`) were removed — confirmed by import-graph search, not just doc mentions, that nothing in the live app references them.
- The design token system (§5), the camera-parenting CI gate (§4.3), and the WCAG contrast e2e test (§10) were checked in detail — colors, type scale, spacing, radii, elevation, and motion tokens all matched the CSS exactly, and both binding e2e tests exist and do what's described. No changes needed there.

**Status:** Living document — reflects shipped production state.

---
## 1. Product overview
Workstream is a landscape architecture + construction estimating platform. The operator (a Curtis & Co designer) opens a project, captures the site, sketches a concept, places planting/hardscape, generates a costing, and shares a client-facing quote. The product runs as a web app (Next.js 16) with a companion mobile app (Expo).
**The single most important UX law:** The drawing is the product. Chrome (toolbars, panels, menus) is frost glass that appears when needed and recedes when idle. The canvas is always the primary focal point.
---
## 2. User personas
| Persona | Surface | Goal |
|---------|---------|------|
| **Operator** (Curtis & Co designer) | Desktop web app (`/projects/[id]`) | Capture site, design garden, cost it, share with client |
| **Client** (homeowner) | Mobile web portal (`/portal/quote/[token]`, `/share/[token]`) | Review concept, accept quote, pay deposit |
| **On-site operator** | Mobile app (Expo) or web with `[data-density="onsite"]` | Walk the site, capture photos/measurements in daylight |
---
## 3. Product surface map
### 3.1 Operator web app (desktop-first)
| Route | Purpose | UX paradigm |
|-------|---------|-------------|
| `/home` | Operator dashboard — address composer + project list | Swiss/International Typographic Style: strict grid, oversized type, hairline dividers, limited palette |
| `/confirm-pin` | Locate loader — full-bleed aerial zoom onto the parcel while Vicmap/title data is fetched, right after the operator picks an address and before the project exists. Not client-facing, no PIN entry (see §0). | Canvas-first: full-bleed aerial plane + frost chrome, same law as the studio |
| `/projects/[id]` | The design studio — six mode lenses on one canvas | Spatial HUD: gallery frame, frosted chrome, disappearing interface |
| `/projects/[id]?mode=survey` | Site capture: title boundary, dwelling, trees, levels, services | Canvas + survey tools (trace, calibrate, place existing) |
| `/projects/[id]?mode=sketch` | Freehand intent sketching | Canvas + ink tools, AI ghost scan, NL assist |
| `/projects/[id]?mode=cad` | Design: place/paint materials, zones, dims | Canvas + asset panel, selection orbit, AI ghosts |
| `/projects/[id]?mode=elevation` | Working section view | Canvas + elevation garden reader |
| `/projects/[id]?mode=quote` | Indicative pricing | Frosted right-side quote panel over canvas |
| `/projects/[id]?mode=share` | Client handoff: portal link, revision management | Canvas + share controls |

*Note: `/` is the public marketing landing page, not the dashboard — see §15.6 #99.*
### 3.2 Client-facing surfaces
| Route | Purpose | UX paradigm |
|-------|---------|-------------|
| `/portal/quote/[token]` | Client reviews and accepts quote | Printable document — light sheet on dark chrome |
| `/portal/deposit/[token]` | Client pays deposit | Minimal payment form |
| `/share/[token]` | Client views concept plan | Light frosted panel, plan gallery |
### 3.3 Mobile app (Expo — forked, not responsive web)
Separate codebase. Project list + canvas viewer + site capture. Not in scope for this design spec unless explicitly requested.
---
## 4. Design studio — the canvas (binding UX)
This is the core product surface. All binding rules are in `docs/STUDIO-STYLING-AND-UX.md` and `docs/CAD-AI-2026-UX.md`. Below is the summary a designer needs.
### 4.1 Gallery frame architecture
The studio is a **framed artwork**: a premium dark grey frame holds the tools, the cream plan is the subject, and nothing persistent is ever painted on the plan.
```
┌─────────────────────────────────────────────┐
│  TOP BAND (46px) — mode tabs, view controls  │
├──────┬──────────────────────────┬────────────┤
│ LEFT │                          │   RIGHT    │
│ BAND │     CREAM PLAN           │   BAND     │
│ 48px │     (the drawing)        │  (collapsed│
│      │                          │   by def)  │
│ tools│                          │  AI sidecar│
│      │                          │  layers    │
│      │                          │  measures  │
├──────┴──────────────────────────┴────────────┤
│  BOTTOM BAND (46px) — undo/redo, sheets strip │
└─────────────────────────────────────────────┘
```
| Part | Rule |
|------|------|
| Frame | Always dark grey (`--gray-d-50`). Both light and dark themes. The cream plan must always read as the subject. |
| Artwork | Cream paper (`--canvas` / `--gray-l-50`), inset by frame bands, radius 4px, with a rabbet lip (hairline + cast shadow). |
| Band chrome | Lives in the frame bands — categorically outside the camera transform. Flat monochrome line icons, IDE-titlebar style. |
| Frame never jumps | Band sizes are stable across modes. Client view empties left/bottom bands but top band keeps its height. |
### 4.2 Disappearing interface (progressive disclosure)
| Layer | What it owns | Default state |
|-------|-------------|---------------|
| Drawing plane | Boundary, building, symbols, TPZ, measures on-plan | Always on |
| Object orbit | Delete / Lock / Ask AI / deselect | Only when an object is selected; positioned outside the glyph |
| Summoned instruments | Draft tools, measure, zoom, undo | Hidden until margin summon / tool arm |
| Inventory popup | Fold-out library: search + Draft kit + catalog | Hidden until Add / Paint |
| Structure rail (left) | Layers / constraints | Collapsed by default |
| AI sidecar (right) | Utility, live measures, dialogue | Collapsed by default |
| Fit / focus / client / foundation | Paper-first overlays | Almost all floats off |
**Idle recession:** After 6 seconds of no input, frame rails fade to ~0.5 opacity. Any hover or input restores them. Idle is suspended while any panel/palette/sheet is open.
### 4.3 Camera parenting (hard constraint)
The `.zoomWorld` element is the **geometry camera only** (translate → rotate → scale). It must never parent frosted UI. All chrome portals through a `CameraChrome` component to a sibling of the camera. This is enforced by an e2e test (`e2e/canvas-chrome-detector.spec.ts`, "Gate C") — any chrome found inside the camera fails CI. *Verified: the test asserts zero `[data-camera-chrome]` nodes under `[data-testid="zoom-world"]`, exactly as described.*
### 4.4 Six mode lenses
| Tab | Name | Operator job | Unlocks when |
|-----|------|-------------|--------------|
| Survey | Site capture | Record title, dwelling, trees, levels, services | Always (project open) |
| Sketch | Intent | Freehand ink + rough massing | Title/aerial ready |
| CAD | Design | Place/paint materials, zones, dims; accept AI ghosts | Same as Sketch |
| Elevation | Working section | Read height relationships | Same as Sketch |
| Quote | Indicative price | Read live BOM total + line items | Accepted CAD geometry |
| Share | Client handoff | Promote quote → portal link / revision | Costed BOM |
```
Survey ──> Sketch ──> CAD ──> Quote ──> Share
              |         |
              └─ Elevation (read-only lens anytime after Sketch unlock)
```
### 4.5 AI as spatial collaborator
AI is a **spatial intern inside the drawing**, not a chatbot. AI generates "ghosts" — ephemeral proposals that overlay the plan until the operator Accepts or Rejects them. Ghosts never silent-write. Constraint-first: title, setbacks, existing trees are hard constraints; softscape is the sandbox.
---
## 5. Design token system

*Verified 2026-08-05 against `apps/web/src/styles/globals.css` and `color-tokens.css` — every value below matched exactly. No corrections in this section.*

### 5.1 Color tokens
**Raw palette** (never use directly in components — use semantic tokens):
| Family | Light | Dark |
|--------|-------|------|
| Neutrals | `--gray-l-0` (#fff) through `--gray-l-900` (#1b1e23) | `--gray-d-0` (#0f1115) through `--gray-d-900` (#e8e9ec) |
| Crimson (existing) | `--crimson-l-600` (#b33a32) | `--crimson-d-500` (#c4463b) |
| Cobalt (proposed) | `--cobalt-l-600` (#2450c7) | `--cobalt-d-500` (#3d6be0) |
| Forest (retained) | `--forest-l-600` (#2f5d3a) | `--forest-d-400` (#4c9662) |
| Sprout (new planting) | `--sprout-l-500` (#4b8f5e) | `--sprout-d-400` (#5ca871) |
| Slate (easement) | `--slate-l-500` (#5b7fbf) | `--slate-d-400` (#6e93e0) |
**Semantic tokens** (what components use):
| Role | Token | Light source |
|------|-------|-------------|
| Canvas / page | `--canvas` | `--gray-l-50` (#f7f6f3) |
| Panel surface | `--panel` | `--gray-l-100` |
| Border | `--border` | `--gray-l-200` |
| Text primary | `--text-primary` | `--gray-l-900` (#1b1e23) |
| Text secondary | `--text-secondary` | `--gray-l-500` (#6b7078) |
| Text muted | `--text-muted` | `--gray-l-500` (same as secondary — AA floor) |
| Existing (crimson) | `--existing-stroke` | `--crimson-l-600` |
| Proposed (cobalt) | `--proposed-stroke` | `--cobalt-l-600` |
| New planting | `--planting-new-stroke` | `--sprout-l-500` |
| Warning | `--warning` | #b8860b |
| Danger | `--danger` | `--crimson-l-600` |
| Success | `--success` | `--sprout-l-500` |
**App shell** (dark grey gallery mount — separate from canvas):
| Role | Token | Value |
|------|-------|-------|
| Surface base | `--surface-base` | #14171C |
| Surface elevated | `--surface-elevated` | #1B1E24 |
| Surface sunken | `--surface-sunken` | #0F1115 |
| Ink primary | `--ink-primary` | #E8E9EC |
| Ink secondary | `--ink-secondary` | #9AA0AC |
| Ink tertiary | `--ink-tertiary` | #7A8088 |
| Line hairline | `--line-hairline` | rgba(232,233,236,0.10) |
| Accent | `--accent` | #5A789B |
### 5.2 Chrome API tokens (`--hc-*`)
The handoff studio has its own chrome token layer that aliases the semantic tokens:
| Role | Token | Purpose |
|------|-------|---------|
| Ink | `--hc-ink` | Primary text on chrome |
| Ink muted | `--hc-ink-muted` | Secondary text |
| Ink faint | `--hc-ink-faint` | Tertiary (borders, disabled) |
| Frost glass | `--hc-glass` | `color-mix(--gray-l-0 97%, transparent)` |
| Frost soft | `--hc-glass-soft` | `color-mix(--gray-l-0 94%, transparent)` |
| Line | `--hc-line` | Hairline on chrome |
| Line soft | `--hc-line-soft` | Lighter hairline |
| Neu surface | `--hc-neu-surface` | Dock plastic |
| Neu raised | `--hc-neu-raised` | Chip plastic |
### 5.3 Typography
| Token | Size | Use |
|-------|------|-----|
| `--text-femto` | 7px | Canvas annotations only |
| `--text-pico` | 8px | Canvas chrome micro-labels |
| `--text-nano` | 9px | Canvas chrome dense labels |
| `--text-micro` | 10px | Section headers, kickers, mono labels |
| `--text-xs` | 11px | Badges, metadata, small UI |
| `--text-sm` | 13px | Body text, list items, button labels |
| `--text-base` | 15px | Default body, inputs |
| `--text-md` | 17px | Section headings |
| `--text-lg` | 20px | Page headings |
| `--text-xl` | 24px | Hero headings |
| `--text-2xl` | 32px | Display numbers |
| `--text-3xl` | 42px | Hero financial figures |
**Font families:**
| Token | Family | Use |
|-------|--------|-----|
| `--font-display` | IBM Plex Mono | Display headings, financial figures |
| `--font-body` | IBM Plex Sans | All body text, UI labels |
| `--font-mono` | IBM Plex Mono | Metadata, counts, measurements, CAD labels |
| `--font-serif` | IBM Plex Serif | Portal/client documents |
| `--font-hand` | Architects Daughter | Hand-lettered plan annotations only |
**Numeric typography rules:**
- All financial figures, measurements, and counts use `font-variant-numeric: tabular-nums`
- All numeric table cells use `font-family: var(--font-mono)` and `text-align: right`
- Long labels use `text-overflow: ellipsis; white-space: nowrap; overflow: hidden`
### 5.4 Spacing
| Token | Value |
|-------|-------|
| `--s-1` | 4px |
| `--s-2` | 8px |
| `--s-3` | 12px |
| `--s-4` | 16px |
| `--s-5` | 24px |
| `--s-6` | 32px |
| `--s-7` | 48px |
| `--s-8` | 64px |
### 5.5 Radii
| Token | Value | Use |
|-------|-------|-----|
| `--r-sm` | 5px | Small controls, badges |
| `--r-md` | 7px | Inputs, buttons |
| `--r-lg` | 10px | Cards, panels |
| `--r-xl` | 14px | Large panels, sheets |
| `--r-pill` | 999px | Pills, status chips |
### 5.6 Elevation
| Token | Value |
|-------|-------|
| `--elev-1` | 0 8px 28px rgba(0,0,0,0.28) |
| `--elev-2` | 0 14px 44px rgba(0,0,0,0.36) |
### 5.7 Motion
| Token | Value | Use |
|-------|-------|-----|
| `--dur-fast` | 140ms | Hover states, toggles |
| `--dur-base` | 260ms | Panel transitions |
| `--dur-slow` | 480ms | Page transitions |
| `--ease` | cubic-bezier(0.22, 1, 0.36, 1) | Default easing |
---
## 6. Control language
### 6.1 Frame band controls (top/left/right/bottom bands)
Flat monochrome line icons — IDE titlebar style. No chips, no frost, no plastic.
| State | Treatment |
|-------|-----------|
| Rest | `--ws-frame-ink-dim` glyph, transparent background |
| Hover | `--ws-frame-wash` background + `--ws-frame-ink` glyph |
| Engaged | `--ws-frame-wash` + inset hairline + full ink |
| Glyph size | 17px inside 38px tap target (44px on touch) |
### 6.2 Dock controls (floating on canvas)
Neumorphic soft-plastic language matching the left swatch rail.
| Surface | Treatment |
|---------|-----------|
| Left swatch rail, header icon chips, instruments hub | `--hc-neu-raised` + soft outer shadow; armed/pressed = inset shadow |
| Large summoned panels (Layers, inventory, pointer sheet) | Frost glass `--hc-glass` + `--hc-elev-*` |
| Control size | 40-46px dock chips |
### 6.3 Pointer cursor
| Context | Cursor |
|---------|--------|
| Add / place | Copy |
| Paint | Cell |
| Measure / trace / zone | Crosshair |
| Sketch (pen) | Graded fine-tip to thick marker |
| Sketch (eraser) | Eraser rubber |
| Lock / locked edit | Not-allowed |
| Handle hover (move / insert) | Grab / copy |
| Fit sheet | Default |
---
## 7. Non-canvas surfaces
### 7.1 Operator dashboard (`/home`)
Swiss/International Typographic Style:
- Strict grid (single column, max-width 1400px)
- Oversized type (clamp(3rem, 8vw, 4.5rem) masthead)
- Hairline dividers, no drop shadows
- Limited palette: blue (planning), red (focus/urgent), green (season/weather), yellow (reminders)
- Left column: planner widgets (date, weather, focus, reminders, calendar, season)
- Right column: project list + address composer
### 7.2 Project page (`/projects/[id]`)
Sub-navigation tabs (Survey / Sketch / CAD / Elevation / Quote / Share) + pipeline stage cards + zone/task/output lists. The studio mounts in the main viewport.
### 7.3 Client portal (`/portal/quote/[token]`)
Printable client document:
- Light sheet (`--portal-sheet: #FAFAF8`) on dark chrome
- Max-width 720px, centered
- Brand masthead + document metadata
- Hero with address + aerial image
- Summary metrics (grid of label + mono value)
- Planting story sections
- Investment section with scenario cards + line-items table
- Accept section (dark inverted)
- Colophon footer
### 7.4 Client share (`/share/[token]`)
Light frosted panel over plan gallery. Quote summary with total, line items, and accept/decline actions.
---
## 8. Density modes
| Mode | Trigger | Effect |
|------|---------|--------|
| Desk (default) | `:root` | 32px control height, 36px tap min, 1px borders |
| On-site | `[data-density="onsite"]` or touch | 44px control height, 48px tap min, 1.5px borders, higher contrast hairlines |
Touch inputs get 16px font size (prevents iOS focus zoom).
---
## 9. Forbidden looks
- Blush pink page wash / umber ink palette as light chrome
- Hardcoded hex colors in handoff modules (use `var(--hc-*)` — CI gate enforces)
- Dark slate glass as the light default
- Purple-on-white / glow / multi-layer neon shadows
- Sepia / stained board as the default canvas
- Opaque solid panels that read as a second app chrome bar on the canvas
- Game language: loadout, hotbar, equip, bag tabs as combat UI
- Static AutoCAD-style ribbons (progressive disclosure only)
- Chatbot-only AI (AI is spatial, in the drawing)
---
## 10. WCAG 2.2 AA compliance
All text must pass 4.5:1 contrast (3:1 for large text >= 24px or >= 18.66px bold). This is enforced by an e2e test (`canvas-contrast-aa.spec.ts`) that walks every studio mode and measures every rendered text node against its composited background. *Verified: the test file's own header comment confirms the same history cited below — 23 failures across 22 rules on the original audit.*
Key rules:
- `--gray-l-400` (#9aa0ac) is only 2.63:1 on white — do NOT use for text. Use `--gray-l-500` (#6b7078) instead.
- "Muted" and "secondary" share the same ink token because any AA-passing grey on white sits in a narrow band. The quiet tier is carried by size, weight, letter-spacing, and caps — not by lightness.
- Translucent chrome must be flattened (composited) before measuring contrast. A color that looks fine on a token value can fail when blended through multiple translucent layers.
---
## 11. Current known UI debt
Items flagged for the designer's attention:
1. **Dashboard project cards** — currently a bulky card grid with thumbnails. Candidate for flattening to dense rows with hairline dividers (spreadsheet-lite).
2. **Project page lists** — zones, tasks, outputs, recordings, measurements all use card-based layouts with borders + border-radius + box-shadow. Should be dense rows with `border-bottom` only.
3. **Secondary actions visible by default** — task actions and output actions are always visible. Should be hover-revealed (pattern exists in dashboard cards).
4. **Hardcoded pixel values** — some CSS modules still use hardcoded `blur(Npx)`, row heights, and padding instead of design tokens. Tokenization in progress.
5. **JetBrains Mono in tier1 ledger** — inconsistent with the IBM Plex Mono used everywhere else. Should be unified. *Verified: `components/tier1/tier1SavingsLedger.module.css` and `tier1ZoneCards.module.css` both still hardcode `"JetBrains Mono", monospace`.*
---
## 12. File structure for reference
```
apps/web/src/
  styles/
    globals.css          — design tokens (colors, type, spacing, radii, motion)
    color-tokens.css     — raw palette + semantic tokens
    app.module.css       — shared primitives (page shell, button, card, pill, table)
  app/
    home.module.css      — operator dashboard (Swiss style)
    dashboard.module.css — address composer + project list
    projects/[id]/
      project.module.css       — project page (pipeline, zones, tasks, outputs)
      project-layout.module.css — project shell + breadcrumb
    portal/quote/[token]/      — client quote portal
    portal/deposit/[token]/    — client deposit portal
    share/[token]/             — client share page
    confirm-pin/               — operator locate loader (query params, no [token] segment)
  components/
    canvas/handoff/            — the design studio (binding UX docs govern this)
    share/                     — client share components
    app-nav.module.css         — top navigation bar
    bottom-dock.module.css     — mobile bottom dock
    DashboardProjects.tsx      — project list component
    QuotePortal.tsx            — quote portal component
    activity-timeline.module.css — exists but unused; no component imports it (see §0)
```
---
## 13. Binding documents (read before designing)
| Document | Purpose |
|----------|---------|
| `docs/STUDIO-STYLING-AND-UX.md` | Binding chrome laws, tokens, camera parenting, mode matrix |
| `docs/CAD-AI-2026-UX.md` | Binding AI UX: disappearing interface, constraint-first, HITL ghosts |
| `docs/OPERATOR-STUDIO-GOLD-WALKTHROUGH.md` | Six-mode workflow walkthrough, site vs design matrix |
| `docs/STUDIO-PRODUCT-PHASES.md` | Workflow 1 (now) vs Stage 2 (later) scope |
| `docs/CANVAS-FIRST-UX.md` | Canvas-first UX principles |
| `apps/web/src/styles/globals.css` | All design tokens (source of truth) |
| `apps/web/src/styles/color-tokens.css` | Raw color palette + semantic mappings |

*All five binding docs above were confirmed present in `docs/` as of 2026-08-05. Four of them still cite `docs/DESIGNER-HANDOVER.md` and/or `docs/design/operator-redesign/` for context — see §0 before touching either.*
---
## 14. Design deliverables expected
When handing designs back to engineering:
1. **Figma file** with:
   - All six mode lenses in desktop viewport (1600x950)
   - Mobile breakpoints (375px) for portal/share surfaces
   - On-site density variant for at least one mode
   - Component states (rest, hover, active, disabled, focus)
   - Annotation of which tokens each component uses
2. **Token additions** — if new tokens are needed, specify them as `--token-name: value` with the semantic role and which components use them.
3. **Do NOT redesign the canvas chrome** without reading `STUDIO-STYLING-AND-UX.md`. The gallery frame, camera parenting, and disappearing interface laws are binding and enforced by CI tests.
4. **Focus areas** (per the UI debt list in section 11):
   - Dashboard project list: card grid → dense rows
   - Project page lists: cards → rows with hairline dividers
   - Progressive disclosure: hover-reveal secondary actions
   - Token centralization: blur values, row heights, padding
---
## 15. Complete feature inventory (every UI surface)
This is the exhaustive list of features that have a front-end UI and need design coverage. Grouped by surface.
### 15.1 Operator dashboard (`/home`) + project creation
| # | Feature | Component | UX notes |
|---|---------|-----------|----------|
| 1 | Address composer (geocode search) | `NewProjectAddressForm` | Autocomplete dropdown, creates project on submit |
| 2 | Project list | `DashboardProjects` | Card grid today; candidate for dense rows |
| 3 | Home planner (left column widgets) | `HomePlanner` | Date, weather, focus stage, reminders, calendar, season |
| 4 | Project card thumbnail | `DashboardProjects` | Aerial image preview |
| 5 | Project card delete action | `DashboardProjects` | Hover-revealed delete button |
| 6 | Project status badge | `DashboardProjects` | Pipeline stage label |
| 7 | Search/filter projects | `DashboardProjects` | Text search input |
| 8 | Suggestion dropdown | `NewProjectAddressForm` | Address autocomplete results |
| 94 | Locate loader | `ConfirmPinClient` | Operator-only aerial zoom + Vicmap boundary trace between picking an address and entering the studio. Moved from the client-facing table in the original draft — see §0. |
### 15.2 Project page shell (`/projects/[id]`)
| # | Feature | Component | UX notes |
|---|---------|-----------|----------|
| 9 | Sub-navigation tabs | `project.module.css` | Survey/Sketch/CAD/Elevation/Quote/Share + sub-pages |
| 10 | Pipeline stage cards | `project.module.css` | Stage progression display |
| 11 | Zone cards | `project.module.css` | Garden zone list |
| 12 | Task cards (kanban) | `project.module.css` | Task columns with status |
| 13 | Output cards | `project.module.css` | Generated document list |
| 14 | Recording cards | `project.module.css` | Site recording list |
| 15 | Measurement cards | `project.module.css` | Site measurement list |
| 16 | Weather forecast strip | `project.module.css` | 7-day weather day cards |
| 17 | Total card (quote summary) | `project.module.css` | Heavy bordered total display |
| 18 | Processing hero | `ProcessingScreen` | AI processing status with stages |
| 19 | Processing stage indicators | `ProcessingScreen` | Per-stage active/pending/done states |
| 20 | Breadcrumb | `project-layout.module.css` | Project breadcrumb nav |
### 15.3 Project sub-pages
| # | Route | Feature | UX notes |
|---|-------|---------|----------|
| 21 | `/overview` | Project overview | Summary dashboard |
| 22 | `/survey` | Survey checklist + capture | 5-point survey completion |
| 23 | `/tasks` | Task management | Kanban board |
| 24 | `/recordings` | Site recordings | Photo/audio list |
| 25 | `/measurements` | Site measurements | Measurement cards with images |
| 26 | `/outputs` | Generated outputs | Document list with download |
| 27 | `/costing` | Costing breakdown | Line-item costing |
| 28 | `/carbon` | Carbon + canopy statement | Sustainability metrics |
| 29 | `/audit` | Audit trail | Compliance audit log |
| 30 | `/filing` | Document filing | Filed documents |
| 31 | `/processing` | AI processing screen | Pipeline status |
| 32 | `/design` | Design studio entry | Legacy redirect → `?mode=sketch` |
| 33 | `/design/studio` | Handoff design studio | The canvas (see section 4) |
| 34 | `/design/develop` | Legacy redirect → `?mode=quote` | Not a distinct page — see §0. The real Cmd+K flow is `StudioCommandPalette` (#39). |
| 35 | `/design/cad` | Legacy redirect → `?mode=cad` | Workflow 1 CAD tab, not a Stage 2 editor — see §0. Stage 2 CAD doesn't exist yet. |
### 15.4 Design studio — canvas features (binding UX)
These are the features inside `HandoffDesignStudio`. Each has a UI that the designer should understand but **must not redesign without reading the binding docs** (section 13).
| # | Feature | Component | Mode | UX notes |
|---|---------|-----------|------|----------|
| 36 | Gallery frame | `HandoffDesignStudio` | All | Dark frame, cream plan, frosted chrome |
| 37 | Mode tabs (6 lenses) | `Tier1TopBar` | All | Survey/Sketch/CAD/Elevation/Quote/Share |
| 38 | Save status indicator | `UnifiedSaveStatus` | All | Autosave state chip |
| 39 | Command palette (Cmd+K) | `StudioCommandPalette` | All | Quick actions, mode switch, view toggles |
| 40 | Header view menu | `HeaderViewMenu` | All | View settings dropdown |
| 41 | Tool dock (left) | `ToolDock` | Sketch/CAD | Summoned instrument rail |
| 42 | Contextual tool strip | `ContextualToolStrip` | Sketch/CAD | Active tool controls |
| 43 | Tool glyphs | `ToolGlyph` | Sketch/CAD | Symbol-based tool buttons |
| 44 | Canvas header rail | `CanvasHeaderRail` | All | Top band controls |
| 45 | Canvas top border | `CanvasTopBorder` | All | Frame top edge |
| 46 | Sketch board | `SketchBoard` | Sketch | Freehand ink canvas |
| 47 | Sketch dock | `SketchDock` | Sketch | Pen/eraser/color tools |
| 48 | Image layer panel | `ImageLayerPanel` | Sketch | Reference image layers |
| 49 | Image layer slot | `ImageLayerSlot` | Sketch | Layer thumbnails |
| 50 | CAD plan board | `CadPlanBoard` | CAD | Geometry placement canvas |
| 51 | Survey checklist | `SurveyChecklist` | Survey | 5-point completion checklist |
| 52 | Survey annotation layer | `SurveyAnnotationLayer` | Survey | On-plan survey annotations |
| 53 | Trace overlay | `TraceOverlay` | Survey | Boundary tracing tool |
| 54 | Elevation board | `ElevationBoard` | Elevation | Section view renderer |
| 55 | Elevation glyphs | `GardenElevationGlyph` | Elevation | Plant elevation symbols |
| 56 | Elevation texture defs | `ElevationTextureDefs` | Elevation | SVG texture patterns |
| 57 | Plan thumbnails | `PlanThumbnail` | Elevation | Mini plan views for elevation pick |
| 58 | Garden viewpoint strip | `GardenViewpointStrip` | Elevation | N/E/S/W viewpoint selector |
| 59 | Fit sheet overlay | `FitSheetOverlay` | All | Cream paper working drawing |
| 60 | Sheet widget stack | `SheetWidgetStack` | Fit | Scale bar, north arrow, status stamp |
| 61 | Sheet compose dock | `SheetComposeDock` | Fit | Pen/atmosphere selector |
| 62 | Artboard strip | `ArtboardStrip` | Fit | Plan/Fit/Elev artboard switcher |
| 63 | Aerial imagery slot | `AerialSlot` | All | Satellite underlay |
| 64 | Tactile ground | `TactileGround` | All | Paper texture underlay |
| 65 | Ground ruler overlay | `GroundRulerOverlay` | All | Scale ruler on plan |
| 66 | Sun cast overlay | `SunCastOverlay` | All | Shadow rendering |
| 67 | Sun growth dock | `SunGrowthDock` | All | Sun position + growth scrubber |
| 68 | Climate bed wash | `ClimateBedWash` | All | Microclimate zone wash |
| 69 | Keyless overlay wash | `KeylessOverlayWash` | Survey | Vicmap overlay washes (BMO, flood, heritage) |
| 70 | Trench overlay | `TrenchOverlay` | CAD | Auto-trench dig paths (ghost until accept) |
| 71 | Buildable area overlay | `BuildableAreaOverlay` | CAD | Computed buildable polygon |
| 72 | Variation filmstrip | `VariationFilmstrip` | CAD/Sketch | A/B/C scheme thumbnails |
| 73 | AI capability cue | `AiCapabilityCue` | All | Contextual AI hint pill |
| 74 | Frame drawer | `FrameDrawer` | All | Slide-out panel from frame edge |
| 75 | Right data lane | `RightDataLane` (state module, not a rendered component — see §0) | All | AI sidecar / live measures slot |
| 76 | Margin strip | `MarginStrip` | All | Canvas margin summon zone |
| 77 | VicGov status chip row | `VicGovStatusChipRow` | All | Sticky compliance chips (planning, BMO, etc.) |
| 78 | Site meta panel | `SiteMetaPanel` | All | Expandable site metadata |
| 79 | Tilt billboard | `TiltBillboard` | CAD | 3D billboard under tilt lens |
| 80 | Render defs | `RenderDefs` | All | SVG symbol/gradient definitions |
| 81 | Species symbols (6) | `speciesSymbols.tsx` | CAD | Canopy, pleached, hedge, mass, cycas, existing |
| 82 | Studio glyph | `StudioGlyph` | All | Asset glyph renderer |
| 83 | Present surface | `PresentSurface` | Share | Client presentation mode |
| 84 | Deck inspector dock | `DeckInspectorDock` | Present | Presentation slide inspector |
| 85 | Quote builder | `QuoteBuilder` | Quote | Frosted right panel with line items |
| 86 | Quote line row | `QuoteLineRow` | Quote | Individual quote line item |
| 87 | Quote surface (tier1) | `QuoteSurface` | Quote | Tier-1 quote with savings ledger |
| 88 | Share surface | `ShareSurface` | Share | Portal link generation + revision management |

*All 51 components in this table (#36–#88, #81) were confirmed present in `components/canvas/handoff/` under these exact names as of 2026-08-05.*
### 15.5 Client-facing surfaces
| # | Route | Feature | Component | UX notes |
|---|-------|---------|-----------|----------|
| 89 | `/portal/quote/[token]` | Client quote portal | `QuotePortal` | Printable document, accept/decline |
| 90 | `/portal/deposit/[token]` | Deposit payment | `DepositPage` | Stripe payment form |
| 91 | `/portal/deposit-success` | Payment success | `DepositSuccessPage` | Confirmation page |
| 92 | `/portal/deposit-cancel` | Payment cancelled | `DepositCancelPage` | Cancellation page |
| 93 | `/share/[token]` | Client share page | `SharePlanSvg` + `ClientShareDecision` | Plan gallery + accept/decline |

*#94 (PIN confirmation in the original draft) moved to §15.1 — it's an operator surface, not client-facing. See §0.*
### 15.6 Auth + system pages
| # | Route | Feature | UX notes |
|---|-------|---------|----------|
| 95 | `/sign-in` | Sign in | Clerk-hosted |
| 96 | `/sign-up` | Sign up | Clerk-hosted |
| 97 | `/legal/privacy` | Privacy policy | Static content |
| 98 | `/legal/terms` | Terms of service | Static content |
| 99 | `/` (landing) | Landing page | Marketing surface |
| 100 | Global error | Error boundary | Full-page error |
| 101 | Project not found | 404 for projects | Inline 404 |
| 102 | Portal error | Portal error boundary | Portal-specific error |
| 103 | Loading states | Per-route loading | Skeleton/spinner for every async route |
### 15.7 Shared chrome + UI kit
| # | Feature | Component | UX notes |
|---|---------|-----------|----------|
| 104 | App navigation bar | `AppNav` | Top nav, translucent, blur |
| 105 | Rail drawer | `RailDrawer` | Slide-out right drawer |
| 106 | Bottom dock | `BottomDock` | Mobile bottom dock |
| 107 | Planner dock | `PlannerDock` | Dashboard planner widget container |
| 108 | Toast host | `ToastHost` | Notification toasts |
| 109 | Spinner | `Spinner` | Loading spinner |
| 110 | Activity timeline | ~~`ActivityTimeline`~~ — not implemented (see §0) | Only an orphaned CSS module exists; no component renders this today |
| 111 | Not found view | `NotFoundView` | Generic 404 |
| 112 | UI kit — button | `KitButton` | Button primitive (sm/md/lg/icon variants) |
| 113 | UI kit — toggle | `KitToggle` | Toggle switch (sm/md) |
| 114 | UI kit — sheet | `KitSheet` | Bottom sheet / modal |
| 115 | UI kit — tooltip | `KitTooltip` | Hover tooltip |
| 116 | UI kit — separator | `KitSeparator` | Horizontal/vertical divider |
| 117 | UI kit — dialog | `Dialog` (`components/ui/`, not `ui/kit/` — see §0) | Modal dialog + scrim |
| 118 | UI kit — popover | `Popover` (`components/ui/`, not `ui/kit/` — see §0) | Popover menu |
| 119 | Tier1 savings ledger | `Tier1SavingsLedger` | Wrights Terrace savings display |
| 120 | Client share decision | `ClientShareDecision` | Accept/decline UI for shared plan |
| 121 | Submit button | `SubmitButton` | Form submit with pending state |
| 122 | New project address form | `NewProjectAddressForm` | Address autocomplete |

*Also present in `components/ui/kit/` but not in the original inventory: `KitInput` (text input), `KitSelect` (select), `KitTabs` (tab group).*
### 15.8 Mobile app (Expo — separate codebase)
| # | Feature | UX notes |
|---|---------|----------|
| 123 | Project list | Mobile project list |
| 124 | Project detail | Mobile project view |
| 125 | Canvas viewer | Read-only canvas on mobile |
---
## 16. Feature priority for design work
### Tier 1 — High-visibility, high-impact (design first)
| Priority | Feature | Why |
|----------|---------|-----|
| P0 | Dashboard project list (#2) | First thing operators see; currently bulky cards |
| P0 | Project page lists (#11-15) | Zones, tasks, outputs, recordings, measurements — all card-based, should be dense rows |
| P0 | Quote builder (#85) | Core revenue surface; frosted panel needs polish |
| P0 | Client quote portal (#89) | Client-facing; first impression of Curtis & Co |
| P1 | Client share page (#93) | Client-facing; accept/decline flow |
| P1 | Locate loader (#94) | Operator-facing, not client-facing as originally listed (see §0); the first thing an operator sees after creating a project, sets the tone for the studio |
| P1 | Processing screen (#18) | Operator waits here during AI; needs clear progress |
| P1 | Command palette (#39) | Power-user surface; needs clear hierarchy |
### Tier 2 — Polish and consistency
| Priority | Feature | Why |
|----------|---------|-----|
| P2 | Auth pages (#95-96) | Clerk-hosted but need brand alignment |
| P2 | Legal pages (#97-98) | Static but should match brand |
| P2 | Landing page (#99) | Marketing surface |
| P2 | Error states (#100-102) | Currently generic; should be on-brand |
| P2 | Loading states (#103) | Currently bare spinners; should be skeleton screens |
| P2 | Toast host (#108) | Notification styling |
| ~~P2~~ | ~~Activity timeline (#110)~~ | Removed — not implemented, see §0. Re-add once a component actually exists. |
### Tier 3 — Canvas chrome (binding — do not redesign without reading docs)
| Priority | Feature | Why |
|----------|---------|-----|
| P3 | All studio features (#36-88) | Governed by binding UX docs; CI-enforced. Only refine if doc-compliant. |
---
*Generated from the Workstream codebase, August 2026. Verified against the codebase 2026-08-05 — see §0 for the full list of corrections. Questions: refer to the binding documents or ask the engineering team.*
