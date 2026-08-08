# Workstream � External Designer Project Brief

**Version:** 2026-07-17 (visual system + routes corrected 2026-08-05 — see note below)  
**Prepared for:** External website / app designer  
**Client / studio:** Curtis & Co (Melbourne landscape design & build)  
**Product name:** Workstream  
**Live reference:** https://web-production-3c194.up.railway.app (Railway is canonical; the fly.dev host in the original version of this brief is legacy — see `CLAUDE.md`)  

This brief is self-contained. Use it as the kickoff pack for visual / UX redesign of the operator web app, client portal, and (optionally) operator mobile chrome. Engineering handback still follows `docs/templates/DESIGN-RETURN-TEMPLATE.md`.

**2026-08-05 correction note:** Section 9's "Garden Atelier 2026" typography and colour tokens were never shipped — the live app uses a different, darker system (see the corrected §9 below). The dashboard route and the Stage 2 CAD row in §6 were also wrong; both are fixed in place. Everything else in this brief (personas, journey, honesty-copy rules, deliverables) was not affected and still holds. Current, verified specs: `docs/design/UIUX-DESIGNER-HANDOFF-SPEC.md`.

---

## 1. One-line pitch

Tim walks a Melbourne site and talks. Workstream turns that into survey ? concept sketch ? estimate ? AI design ? costing ? audit ? client quote � so by the time he�s at the car, the job is moving.

---

## 2. What you are designing

| Surface | Who uses it | Brand in the UI | Primary job |
| --- | --- | --- | --- |
| **Operator web** | Tim / Morgan (crew) | **Workstream** | Run the job end-to-end |
| **Client portal** | Homeowner (token link) | **Curtis & Co** | Understand design, compare price, pay deposit |
| **Operator mobile** | Tim on site | **Workstream** | Capture walkthrough + next-step CTA |

**Do not mix brands.** Operator chrome = Workstream. Quotes, deposit, and portal chrome = Curtis & Co. Same product DNA; different skins.

---

## 3. Business context

- **Industry:** Residential / boutique landscape design & build (Melbourne inner suburbs � Stonnington, Yarra, etc.).
- **Users:** Small crew; not enterprise SaaS buyers. Operators are outdoors, muddy, in a hurry.
- **Money path:** Concept plan ? three cost scenarios (Lean / Standard / Buffer) ? client picks ? deposit via Stripe portal.
- **Honesty is a product feature:** Plans are **concept for estimating**, never construction drawings. Design must never look like CAD sign-off.

---

## 4. Personas

### Tim � Lead / on-site operator
- Walks sites, dictates scope, places trees/lawn/paving on aerial.
- Needs one obvious next step; hates hunting for buttons.
- Uses phone on site, laptop back at the studio.

### Morgan � Studio / ops
- Reviews costing, audit, outputs, client handoff.
- Needs clarity over decoration; pipeline status at a glance.

### Homeowner � Portal only
- Opens a magic link. Sees Curtis & Co, not �Workstream�.
- Needs confidence: what am I buying, why three prices, how do I pay a deposit.
- Zero training; calm, premium, garden-aware.

---

## 5. End-to-end product journey

```text
New project (address)
  ? Pin site on aerial
  ? Record / upload walkthrough (voice)
  ? Auto pipeline processing
  ? Survey review (aerial + lot + m�)
  ? Design studio: sketch on aerial (envelope)
  ? Envelope estimate + planning flags (TRP, stormwater, heritage)
  ? AI design from sketch
  ? Costing (Lean / Standard / Buffer)
  ? Audit
  ? Outputs + client portal link
  ? Homeowner pays deposit
```

**Design studio sits early:** sketch *where* things go before AI and formal quote. That order is intentional.

---

## 6. Information architecture (operator web)

### Global
- Sticky **AppNav:** Workstream wordmark � Projects � Settings (and related ops links)
- **Project shell:** address masthead � horizontal stage subnav � content � mobile sticky CTA

### Key screens to design

| Screen | Route pattern | Designer focus |
| --- | --- | --- |
| Projects dashboard | `/home` (not `/` — `/` is the public marketing landing page) | Site list + �new project�; calm empty state |
| Project hub | `/projects/:id` | Pipeline stages + single next action |
| Survey | `/projects/:id/survey` | Aerial + lot context |
| Design | `/projects/:id/design` | Workflow steps into studio / AI |
| **Design studio** | `/projects/:id/design/studio` | Full-screen aerial sketch tool (hero surface) |
| **AI CAD (Stage 2)** | `/projects/:id/design/cad` | **Not built yet.** This route is currently a redirect into the Workflow 1 CAD tab (`?mode=cad`). Stage 2 (metre-space CAD, DXF export) is real future scope — see `docs/STUDIO-PRODUCT-PHASES.md` — but don't design against it as if it exists today. |
| Costing | `/projects/:id/costing` | Three scenario cards |
| Audit | `/projects/:id/audit` | Checklist / confidence |
| Outputs | `/projects/:id/outputs` | Quote + packs + send to client |
| Portal quote | `/portal/quote/[token]` | Curtis brand � scenarios � deposit |

---

## 7. Design studio � brief within the brief

### Purpose
Back-of-envelope concept on a **static Mapbox aerial**: drop landscape symbols, freehand ink, indicative scale. Feeds estimate, planning flags, AI develop, and quote quantities.

### Hard product rules
1. **Concept sketch, not CAD** � CAD-*inspired* chrome is OK; construction-grade accuracy is not.
2. **2D top-down only** � no 3D, isometric, photoreal, or tilt.
3. **Permanent honesty copy** (non-dismissible), including:  
   *�Concept sketch for estimating � not a construction drawing.�*
4. **Aerial is the hero** � asset rail ~320px desktop; canvas dominates.
5. **Accent sparingly** � signal CTAs and armed tools, not whole chrome.
6. **Indicative metres** � scale bar / TPZ readouts always labelled indicative.

### Core interactions
- Place / move / rotate / scale catalog symbols (percent coordinates on aerial)
- Freehand draw mode
- Planning symbols: existing tree, tree protection zone (TRP / AS 4970)
- Mass plant bed fill, irrigation drip zones (indicative)
- Undo/redo, measure tool, schedule preview (AUD + GST)
- Save plan ? downstream envelope / AI / quote

### States that must be designed
Empty canvas � armed symbol � selected symbol � saving / saved � aerial load fail � no survey gate

---

## 7b. AI CAD (Stage 2)

**Not shipped.** This section describes future scope, not a current surface — treat it as background, not a screen to design against yet.

- Separate from concept sketch: **Upgrade to AI CAD** after a saved sketch.
- Aerial underlay + SVG vector overlay; AI rail (generate / NL edit / accept ghosts).
- DXF download for **LibreCAD** � keep Workstream chrome; do not fake AutoCAD.
- Ghosts are low-opacity until Accept. Honesty copy remains permanent.
- See `docs/AI-CAD.md`.

---

## 8. Client portal � brief

- **No operator chrome** (no Workstream nav).
- **Curtis & Co** brand first; premium garden confidence.
- Homeowner understands the design, compares **Lean / Standard / Buffer**, pays deposit.
- Current visual direction: dark chrome shell + light quote sheet (`--portal-sheet: #FAFAF8`) — see corrected §9, not the "Garden Atelier" naming used elsewhere in this doc.
- Avoid SaaS dashboard patterns, stats strips, or studio tooling.

---

## 9. Visual system (corrected 2026-08-05 — this section originally described "Garden Atelier 2026," which was never shipped)

**Direction (actual, verified against `apps/web/src/styles/globals.css`):** a dark-grey gallery frame holding the tools, with the drawing itself on cream paper — the frame is premium/neutral, the plan is the subject. Not moss-green/biophilic, not cream+terracotta Inter, not purple SaaS, not neon cyber. See `docs/design/UIUX-DESIGNER-HANDOFF-SPEC.md` §5 for the full token system with the reasoning behind each choice.

### Typography
| Role | Family |
| --- | --- |
| Display / financial figures | **IBM Plex Mono** |
| Body / UI | **IBM Plex Sans** |
| Portal / client documents | **IBM Plex Serif** |
| Codes, metrics, measurements | **IBM Plex Mono** |
| Hand-lettered plan annotations only | **Architects Daughter** |

### Core colour tokens (map comps to CSS variables)

| Token | Hex | Role |
| --- | --- | --- |
| `--surface-base` | `#14171C` | Page field (app shell) |
| `--surface-elevated` | `#1B1E24` | Panels / sheets |
| `--surface-sunken` | `#0F1115` | Recessed tracks |
| `--ink-primary` | `#E8E9EC` | Primary text (light-on-dark) |
| `--ink-secondary` | `#9AA0AC` | Secondary |
| `--accent` | `#5A789B` | Muted blueprint slate (primary action) — kept deliberately distinct from the canvas's own cobalt/crimson plan-geometry colours |
| `--accent-bright` | `#7B9BC4` | Brighter accent variant |
| `--info` | `#6E93E0` | Info |
| `--ok` / `--warn` / `--block` | `#4C9662` / `#D4A017` / `#C4463B` | Semantics |
| `--canvas` (the plan itself, not the app shell) | `#F7F6F3` | Cream paper the drawing sits on |

Source of truth in code: `apps/web/src/styles/globals.css` and `apps/web/src/styles/color-tokens.css`.

### Layout & craft rules
- Prefer tonal depth + hairlines over heavy cards and multi-layer shadows.
- Soft organic radii (`8 / 12 / 18`) � avoid candy pill clusters.
- Accent as signal, not wallpaper.
- Mobile-first: **44px** min tap targets; sticky bottom primary CTA on phones.
- Breakpoints to design: **375 / 720 / 960+**.
- Locale: **en-AU**, AUD, GST, sentence case.
- Accessibility: **WCAG AA** contrast on labels and rail text.

### Motion
Intentional, calm presence (page/panel transitions already tokenised). Prefer 2�3 meaningful motions per surface � not decorative noise.

---

## 10. Voice & copy

| Surface | Tone |
| --- | --- |
| Operator | Clear, terse, operational � �next step� language |
| Portal | Warm, confident, garden-literate Curtis & Co � never engineering jargon |

Always reinforce: concept / estimate / indicative. Never imply council approval or construction readiness from the sketch alone.

---

## 11. What success looks like

1. Operator opens a project and **knows the next action in under 3 seconds**.
2. Design studio feels like a **professional garden sketchboard**, not AutoCAD and not a toy.
3. Portal feels like a **Curtis & Co client experience**, not a software product.
4. Visual system feels like **one coherent gallery** across dashboard, studio chrome, and portal (brand split preserved).
5. Redesign is **implementable**: tokens named, components mapped, states covered.

---

## 12. Out of scope (do not propose as �shipped�)

- True survey CAD / coordinate export / working drawings (separate future phase)
- 3D / photoreal / isometric
- Silent AI auto-placement of geometry
- Excel import, unrelated products, or backend-only features with no UI
- Full mobile design-studio parity (separate surface unless scoped)

---

## 13. Deliverables we need from you

1. **Figma** (Dev Mode on) with pages roughly:
   - Foundations (tokens, type, elevation, motion)
   - Components (nav, subnav, buttons, pills, inputs, toasts)
   - Templates (dashboard, project hub, design, costing, outputs)
   - Design studio (375 / 720 / 960+)
   - Portal � **separate file or page set**, Curtis brand
   - States (empty, loading, error, honesty copy visible)
2. **Filled return doc** from `docs/templates/DESIGN-RETURN-TEMPLATE.md`
3. **Token delta table** vs `apps/web/src/styles/globals.css`
4. **Copy deck** � all en-AU strings for designed screens
5. **Component map** � Figma component ? suggested React / CSS module path  
6. Optional: ?5 min Loom for studio interactions

Engineering will not start until return markdown + Figma match.

---

## 14. Kickoff checklist for the designer

- [ ] Open live app: https://web-production-3c194.up.railway.app  
- [ ] Create / open a project ? Design ? Open design studio  
- [ ] Open a portal quote link if provided (or ask for a demo token)  
- [ ] Read this brief end-to-end  
- [ ] Confirm brand split: Workstream vs Curtis & Co  
- [ ] Confirm honesty / non-CAD constraints before exploring wild layouts  
- [ ] Align colours to CSS token names; propose new tokens in writing  

---

## 15. Contacts & related internal docs

| Topic | Doc |
| --- | --- |
| Deep studio + layout handover | `docs/DESIGNER-HANDOVER.md` |
| Figma file structure | `docs/DESIGN-HANDOVER-FORMAT.md` |
| Quote sequence | `docs/QUOTE_WORKFLOW.md` |
| UI priorities | `docs/UI-FOCUS.md` |
| Copy-paste kickoff prompts | `docs/templates/DESIGNER-PROMPTS.md` |
| Design ? code package format | `docs/DESIGN-TO-CODE-SPEC.md` |

**Product owner:** Tim (Curtis & Co / Workstream)  
**Implementation:** engineering via design-return markdown + Figma  

---

*This brief originally superseded older token notes that referenced Inter + terracotta accent with a "Garden Atelier 2026" system (Fraunces/Sora, moss-green) — that system was itself never shipped and §9 above has been corrected in place (2026-08-05) to match the actual live app. Current, fully verified spec: `docs/design/UIUX-DESIGNER-HANDOFF-SPEC.md`.*
