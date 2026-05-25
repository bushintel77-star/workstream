# Designer handover — Workstream layout & design studio

**Audience:** Product / UI designer redesigning operator web layout and the aerial design studio.  
**Product:** Workstream (operator) · **Client brand:** Curtis & Co (quotes & portal only)  
**Last updated:** 2026-05-21

Companion specs: [DESIGNER-HANDOVER.md](./DESIGNER-HANDOVER.md) · [DESIGN-HANDOVER-FORMAT.md](./DESIGN-HANDOVER-FORMAT.md) · [QUOTE_WORKFLOW.md](./QUOTE_WORKFLOW.md) · [UI-FOCUS.md](./UI-FOCUS.md) · [CAPTURE.md](./CAPTURE.md)

**Hand back designs using:** [templates/DESIGN-RETURN-TEMPLATE.md](./templates/DESIGN-RETURN-TEMPLATE.md) → save to `docs/design-returns/`.

---

## 1. What this product is

Workstream is a **voice-first landscape design + build co-pilot** for Curtis & Co (Melbourne). Tim walks a site, talks through the job, and the system produces survey → sketch → estimate → AI design → costing → audit → client quote.

**Two surfaces — do not conflate them:**

| Surface | User | Brand in UI | Job |
| --- | --- | --- | --- |
| **Operator web + mobile** | Tim / Morgan | **Workstream** chrome | Run the job end-to-end |
| **Client portal** | Homeowner | **Curtis & Co** | Understand design, pick scenario, pay deposit |

This handover focuses on **operator web**, especially **layout** and **design studio**.

---

## 2. Design principles (locked)

These are product decisions, not suggestions:

1. **Concept sketch, not CAD** — The design studio is a back-of-envelope tool. It must never read as construction-grade or survey-accurate. Copy and visual treatment must reinforce “estimate / concept only”.
2. **2D top-down only** — Aerial + symbols on a flat plan. No 3D, isometric, photoreal, or tilt.
3. **Single accent colour** — `--accent` (`#C2410C` light / `#FB923C` dark) on **≤3% of surface**: Save CTA + armed Place/Draw mode only. Everything else is achromatic ink + surfaces.
4. **CSS variables only** — No hex literals in component CSS. Tokens live in `apps/web/src/styles/globals.css`; shared primitives in `app.module.css`.
5. **Curtis palette species** — Off-palette plants are rejected in product logic (hornbeam, Lomandra, bluestone, etc.). Custom SVG uploads merge into the library via Settings.
6. **AU locale** — en-AU, AUD, GST, Stonnington/Yarra heritage overlays, AS 4970 tree protection (TRP).
7. **Mobile-first operator** — 44px min tap targets, 16px input font, sticky bottom CTAs on phones.

**Typography (current shipped):** Inter Display (headlines), Inter (body), JetBrains Mono (codes, coords, metrics). An older agent brief referenced Cormorant/DM Mono — **superseded** by the Workstream token set above.

---

## 3. Design token reference

Source of truth: `apps/web/src/styles/globals.css`

| Token | Role |
| --- | --- |
| `--surface-base` | Page canvas (warm off-white / dark base) |
| `--surface-elevated` | Cards, inputs, active tabs |
| `--surface-sunken` | Tracks (subnav, mode bar, catalog background) |
| `--surface-inset` | Recessed wells |
| `--ink-primary / secondary / tertiary` | Text hierarchy |
| `--line-hairline / subtle / strong` | Borders — prefer hairline + tonal depth over heavy strokes |
| `--accent`, `--accent-soft`, `--accent-ink` | Signal only (Save, armed tool) |
| `--ok`, `--warn`, `--block`, `--info` | Status pills & semantic feedback |
| `--elev-1`, `--elev-2`, `--elev-inset` | Layered depth (2026 tonal stack) |
| `--s-1` … `--s-8` | 4px spacing scale |
| `--r-sm/md/lg` | Border radius |

Dark mode: `prefers-color-scheme` only — no class-based theme switcher.

Mobile tokens mirror web in `packages/ui` (`@workstream/ui`).

---

## 4. Operator information architecture

### Global chrome

- **AppNav** — sticky top bar: Workstream wordmark, Projects, Integrations, Accounting, Lite/Studio pill.
- **Project masthead** — address + created date + “← Projects” crumb.
- **Subnav** — horizontal pill track (Overview, Survey, Design, Costing, Audit, Outputs, Filing, Tasks, …). Sticky on mobile below masthead.

Route: `/projects/:id/*`

### Project hub (Overview)

**Purpose:** Single glance at pipeline state + one obvious next action.

Shows: pipeline stage cards (5 steps), metrics row, weather strip, activity timeline, client handoff strip, sticky bottom CTA on mobile.

### Tab map (design-relevant)

| Tab | Route | Primary content |
| --- | --- | --- |
| Survey | `/survey` | Site plan hero (aerial + lot ring), Vicmap data, zone table |
| **Design** | `/design` | Workflow steps, envelope brief, AI proposal, CTAs to studio |
| **Design studio** | `/design/studio` | Full-screen sketch tool (this doc §6) |
| Costing | `/costing` | Lean / Standard / Buffer scenarios |
| Audit | `/audit` | Self-audit checklist + overrides |
| Outputs | `/outputs` | Quote HTML, stormwater pack, regenerate |
| Filing | `/filing` | Swipe gallery of uploads |
| Settings | `/settings` | Integrations, crew, rate card, design assets |

---

## 5. End-to-end operator workflow

```text
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│ New project │───▶│ Confirm pin  │───▶│ Record / upload │───▶│ Processing   │
│ (address)   │    │ on aerial    │    │ walkthrough     │    │ (auto pipe)  │
└─────────────┘    └──────────────┘    └─────────────────┘    └──────┬───────┘
                                                                      │
                    ┌─────────────────────────────────────────────────▼
                    │
         ┌──────────▼──────────┐
         │ Survey review       │  aerial + title polygon + m²
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐     ┌─────────────────────┐
         │ Design studio       │────▶│ Envelope estimate   │
         │ sketch on aerial    │     │ + planning flags    │
         └──────────┬──────────┘     └──────────┬──────────┘
                    │                            │
         ┌──────────▼──────────┐                 │
         │ AI design from      │◀────────────────┘
         │ sketch              │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐    ┌─────────┐    ┌─────────┐
         │ Costing (3-way)     │───▶│ Audit   │───▶│ Outputs │
         └─────────────────────┘    └─────────┘    │ + portal│
                                                   └─────────┘
```

### Quote workflow (design studio sits at step 2)

Canonical sequence on **Design** page (`QuoteWorkflowSteps`):

1. **Survey** — site confirmed  
2. **Sketch on aerial** — design studio (requires saved placements)  
3. **Envelope estimate** — rough budget band + planning flags (TRP, stormwater, heritage)  
4. **AI design from sketch** — Claude zones honour layout  
5. **Cost & quote** — formal scenarios → audit → outputs  

**Why sketch before AI:** The envelope sketch anchors *where* things go for client conversation and council flags before AI refines specifications.

---

## 6. Design studio — product spec

### 6.1 Purpose

In-house **back-of-envelope** sketch tool: drop Curtis CAD symbols onto a **static Mapbox aerial** of the lot, optionally mark up with freehand ink, save a concept plan that feeds:

- Envelope estimate on Design page  
- Planning flags (TRP / stormwater / heritage)  
- AI “develop from sketch”  
- Quote site-plan table (quantities on plan)

**Not in scope:** Working drawings, survey accuracy, 3D, silent AI placement.

### 6.2 Entry & prerequisites

- URL: `/projects/:id/design/studio`  
- **Requires survey** — if missing, empty state with CTA to Survey tab.  
- Data loaded: `survey.aerial_uri`, `survey.title_polygon`, catalog symbols, saved canvas.

### 6.3 Layout (current shipped — redesign starting point)

**Desktop (≥960px):**

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Project masthead + subnav (inherited from project shell)                    │
├──────────────────────────────────────────────────────────────────────────┤
│ H1 + lede (honesty copy — TRP symbols explained)                           │
├──────────────────────────────────────────────────────────────────────────┤
│ Toolbar: [Place|Draw|Select modes]  autosave label  [Save plan]          │
├───────────────────────────────────────────────┬──────────────────────────┤
│                                               │  Asset rail (320px)       │
│  Aerial canvas (hero)                         │  ┌ search ─────────────┐ │
│  · lot ring overlay                           │  │ category chips       │ │
│  · symbol placements                          │  ├──────────────────────┤ │
│  · freehand strokes                           │  │ Planning (TRP) group │ │
│  · scale bar (indicative)                     │  │ pinned at top        │ │
│  · selection handles                          │  ├──────────────────────┤ │
│  · empty-state prompt                         │  │ asset grid           │ │
│                                               │  │ code + label + glyph │ │
│  Honesty caption (fixed)                      │  └──────────────────────┘ │
└───────────────────────────────────────────────┴──────────────────────────┘
│ Keyboard shortcuts (collapsible details)                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Mobile:** Stack — toolbar → canvas → rail below (scroll). Subnav remains sticky.

**Key layout files:**

- `apps/web/src/components/DesignStudio.tsx` — behaviour + composition  
- `apps/web/src/components/designStudio.module.css` — studio layout  
- `apps/web/src/components/studio/DesignAssetPalette.tsx` + `designAssetPalette.module.css` — rail  
- `apps/web/src/components/studio/DesignCanvasPlacement.tsx` — symbol rendering  
- `apps/web/src/components/studio/ScaleBar.tsx` — indicative metres from map bounds  

### 6.4 Interaction model (modeless-first)

Primary intent (no mode required):

| User action | Result |
| --- | --- |
| Click asset in rail | Arms symbol; cursor hint on canvas |
| Click empty canvas (armed) | Places symbol at click |
| Drag asset from rail | Drop on canvas to place |
| Click placed symbol | Select; show move / rotate / scale handles |
| Drag selected symbol | Move |
| Drag empty canvas | Marquee / pan behaviour per implementation |
| Draw mode (D) or toolbar | Freehand markup strokes (survey ink colour) |

**Mode bar (fallback):** Place · Draw · Select — accent fill only on **active override**. Auto mode shows subtle inset border.

**Keyboard:** P Place · D Draw · V Select · Esc deselect · Delete remove · Ctrl+Z undo stroke. Legend in collapsible `<details>`.

### 6.5 Asset library

**Source:** `packages/domain/src/catalog.ts` + custom uploads (`custom-*` ids) from Settings → Design assets.

**Categories:** Planting, Hardscape, Structures, Water, Site furniture, Markup.

**Planning group (pinned):** Symbols with TRP/council meaning:

| Symbol | Code | Use |
| --- | --- | --- |
| Existing tree (retain) | — | Canopy to protect; arborist TPZ/SRP |
| Tree protection zone | TRP | Fence / no-dig area on plan |

Every tile shows: **glyph preview**, **asset code** (mono), **label**, optional **TRP** tag. Search filters by name, code, SKU.

**Custom assets:** Operators paste SVG `path_d` (viewBox 0 0 24 or 48). Built-in Curtis library always applies.

### 6.6 Canvas & coordinates

- Placements stored as **percent of aerial** (`x_pct`, `y_pct` 0–100) — responsive to canvas resize.  
- Rotation + scale per placement.  
- TPZ symbol: resizable with **indicative metre readout** (labelled indicative only).  
- Scale bar derived from static map bounds (`apps/web/src/lib/mapView.ts`) — not survey-grade.  
- Aerial is **static image** (Mapbox Static API). No Mapbox GL, no pan/zoom map engine.

### 6.7 States to design

| State | Behaviour |
| --- | --- |
| Empty canvas | Centred prompt: select asset, click aerial |
| Armed symbol | Cursor hint text follows pointer |
| Selected symbol | Handles + delete |
| Saving | Save button disabled + spinner; toast on success |
| Saved | “All changes saved {time}” in toolbar |
| Aerial load fail | Error overlay + retry |
| No survey | Full-page gate → Survey CTA |

### 6.8 Honesty UX (non-negotiable copy zones)

1. **Page lede** — back-of-envelope; TRP symbols named explicitly.  
2. **Canvas caption** — “Concept sketch for estimating — not a construction drawing.”  
3. **Save success toast** — mentions draftsperson for working drawings.  
4. **TPZ readout** — “indicative only” wherever metres shown.

Do not hide these in settings or first-run only — they are permanent affordances.

### 6.9 Mass planting (bed calculator)

**Rail tab:** Mass plant (mobile bottom rail).

**Flow:** Draw bed → tap aerial (≥3 points) → **Finish bed** → set spacing (cm) → **Fill area**.

- Area (m²) and plant count are **indicative** — confirm on site before order.
- Fill pushes `CatalogPlacement[]` in one undo step (staggered grid via `@workstream/domain` `mass-plant.ts`).
- Planting symbols only in the dropdown (Curtis catalog).

### 6.10 Irrigation wizard

**Rail tab:** Irrigation.

**Flow:** **New zone** → tap aerial to trace drip line → **Finish line** → per-zone spacing/flow → **Summary** for valve count.

- Pipe length, emitters, and flow are indicative — hydraulic sign-off by irrigation contractor.
- Schedule adds `IRR-DRIP` (lm) and `IRR-VALVE` (ea) from rate card when zones exist.
- `irrigation_zones[]` persisted on save (`DesignCanvas`).

### 6.11 Plant schedule & export

**Rail tab:** Schedule — live AUD preview (ex-GST, GST, total inc-GST).

- Rows from `summarizePlacementsForQuote` + `irrigationLineItems`; amber pill when SKU missing from rate card.
- **Copy schedule** — markdown table to clipboard.
- **Save & open outputs** — saves canvas then navigates to `/projects/:id/outputs`.

### 6.12 Undo / redo / measure

- **Undo / redo** — placements, strokes, and irrigation zones (cap 50); `Ctrl+Z` / `Ctrl+Shift+Z`.
- **Measure** — two taps on aerial; distance from scale bar math; labelled indicative only.

### 6.13 Planting catalog depth

When **Planting** category is active in the asset rail:

- Sun and water filter chips (from symbol metadata).
- Detail strip: botanical name, mature height, SKU when selected.
- Curtis-approved palette only — blocklisted species cannot be added via studio.

### 6.14 Save & downstream data

**Save** → `PUT /projects/:id/design-canvas` via server action `saveDesignCanvasAction`.

Payload (`DesignCanvas`):

- `placements[]` — symbol_id, x/y %, rotation, scale  
- `strokes[]` — freehand points, colour, width  
- `irrigation_zones[]` — drip-line polylines, emitter spacing/flow per zone  
- `updated_at`

Downstream consumers (do not break field names):

- `GET /projects/:id/envelope` — budget band + planning flags from canvas  
- `POST /projects/:id/costing/sketch` — envelope estimate  
- `POST /projects/:id/pipeline/develop` — AI from sketch  
- Quote generator — site plan quantity table from placements + rate card SKUs  

---

## 7. Broader layout system (outside studio)

Shared primitives: `apps/web/src/styles/app.module.css`

| Primitive | Use |
| --- | --- |
| `.page` / `.pageNarrow` | Max-width shell (960 / 720px) |
| `.masthead` | Sticky glass header on mobile |
| `.headline` / `.lede` / `.sectionHeading` | Type hierarchy |
| `.card` / `.metric` | Elevated surfaces with hairline + inset shadow |
| `.pill` + semantic variants | Status chips |
| `.btn` / `.btnAccent` / `.btnGhost` / `.btnDanger` | Actions |
| `.subnav` (project.module.css) | Tab track |
| `.bottomBar` | Mobile sticky CTA (hidden ≥720px) |
| `.empty` / `.error` / `.banner` | Feedback blocks |

**Loading:** Route-level skeletons (`PipelineShellLoading`, dashboard `loading.tsx`) mirror real layout — subnav pills, pipeline row, metric cards.

**Toasts:** Bottom-centre, glass + semantic tint (`toast-host.module.css`).

**Spinners:** Shared `Spinner` component in buttons and async search.

---

## 8. What is deferred (do not design as shipped)

| Item | Status |
| --- | --- |
| Phase 6 — AI assist (ghost detections, Cmd+K bar) | Proposal only — see `PROPOSAL.md` |
| Brochure output kind | Product TBD |
| Mobile design studio parity | Separate surface; horizontal strip + tap-to-place |
| 3D / photoreal / isometric | Explicitly out of scope |
| Portal redesign beyond scenario picker | Lower priority — see UI-FOCUS.md |

---

## 9. Files for Figma / handoff

| Asset | Location |
| --- | --- |
| Live reference | https://construct-web.fly.dev/projects/{id}/design |
| Design tokens | `apps/web/src/styles/globals.css` |
| Studio layout CSS | `apps/web/src/components/designStudio.module.css` |
| Asset rail CSS | `apps/web/src/components/studio/designAssetPalette.module.css` |
| Symbol glyphs | `packages/domain/src/catalog-assets.ts` |
| Studio components | `apps/web/src/components/studio/*` |
| E2E flows (QA) | `apps/web/e2e/design-studio.spec.ts` |

**Suggested Figma structure:**

1. Foundations — tokens, type, elevation, motion  
2. Components — nav, subnav, cards, pills, buttons, inputs, toasts  
3. Templates — dashboard, project hub, design page  
4. Design studio — breakpoints 375 / 720 / 960+  
5. States — empty, loading, error, honesty copy  
6. Portal (separate file) — Curtis & Co client skin  

---

## 10. Acceptance criteria for redesign

- [ ] Studio reads as **concept tool**, never CAD — honesty copy visible at all times  
- [ ] Accent ≤3% surface (Save + armed mode only)  
- [ ] All colours via CSS variables; dark mode parity  
- [ ] 44px touch targets; keyboard path documented  
- [ ] Asset codes visible on every tile; Planning/TRP group discoverable  
- [ ] Aerial remains hero; rail ~320px desktop; no dead void  
- [ ] WCAG AA contrast on rail labels (previous tinted tiles failed)  
- [ ] Layout survives: empty canvas, 50+ symbols, aerial load failure  
- [ ] No new interaction that implies survey accuracy or construction sign-off  
- [ ] Saved canvas payload unchanged unless engineering signs off  

---

## 11. Questions → engineering

| Question | Contact point |
| --- | --- |
| Can we change canvas coordinate system? | Breaking — discuss first |
| New symbol categories? | `packages/contracts` + domain catalog |
| Map interaction (zoom/pan)? | Currently static image only |
| AI ghost layer | Phase 6 not implemented |
| Brand split Workstream vs Curtis | Operator = Workstream; portal = Curtis |

---

*For implementation history see `CHANGES.md` and `AERIAL_DESIGN_STUDIO_AGENT_BRIEF.md`. For operator capture flow see `CAPTURE.md`.*
