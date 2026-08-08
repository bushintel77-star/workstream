# Present mode — designer feature & UI inventory

**Audience:** Graphic / UI designer (operator Present surface)  
**Product:** Workstream — Curtis & Co landscape co-pilot  
**Surface:** `/projects/[id]?mode=present` → `PresentSurface`  
**Platform:** Desktop-first web (`apps/web`)  
**Date:** 2026-08-09  
**Status:** Feature inventory + design brief (Workflow 1)

**Read with:**  
[`STUDIO-STYLING-AND-UX.md`](../STUDIO-STYLING-AND-UX.md) · [`DESIGNER-FEATURE-INVENTORY.md`](../DESIGNER-FEATURE-INVENTORY.md) · [`TIER1-2026-FRONTEND-DESIGN-SPEC.md`](./TIER1-2026-FRONTEND-DESIGN-SPEC.md) · [`CAD-AI-2026-UX.md`](../CAD-AI-2026-UX.md)

---

## 1. What Present is (and is not)

| Present **is** | Present **is not** |
|----------------|--------------------|
| Operator **meeting-deck authoring** — compose pages for a client conversation | **Client presentation** (View → Client presentation) — chrome-off theatre on the plan |
| Live-bound panels from the CAD board + estimate | **Share** — client portal URL + liability gate |
| Ghost-until-accept AI (Dissect / Format) | A second CAD canvas or Fit sheet |
| Printable / screen-shareable page paper | The Quote live-cost rail (right lane on CAD) |

One sentence: **Present turns the working drawing into a client-facing deck the operator builds page by page.**

---

## 2. Product law for this surface

1. **Sentence case** labels; **AU locale** (en-AU, AUD, GST).
2. **AI is ghost until Accept** — Dissect / Format proposals never silent-write into the deck.
3. **Summoned chrome** — Deck settings is a dock, not a permanent slab over the page paper.
4. **Honesty** — live widgets (quote totals, etc.) stay indicative; footer honesty language is first-class.
5. **Identity** — Present workspace uses a **paper / instrument** composition (page on a workbench), while the surrounding studio frame stays the dark gallery mount. Do not restyle Present as blush-pink chrome, purple glow, or dashboard card soup.
6. **Fonts in product:** Fraunces (display) · Sora (UI) · IBM Plex Mono (meta). Deck theme may also offer Inter / Hand-written as content fonts.

---

## 3. Unlock & entry

| Gate | Behaviour |
|------|-----------|
| Unlock | Accepted CAD geometry exists (placements, strokes, or zones) |
| Locked tab copy | “Accept CAD geometry before presenting.” |
| Entry | Mode strip **Present**, or `?mode=present` |
| Exit | **Back** → returns to CAD |

Surface banner states (`data-surface-state` / `data-testid="present-surface-banner"`):

| State | When | Designer note |
|-------|------|----------------|
| `empty` | No deck selected / none exist | Empty workspace + “New deck” CTA |
| `ready` | Draft deck open, no AI review | Normal compose |
| `ghost` | Dissect or Format review open | Ghost review overlays page |
| `locked` | Deck `status = issued` | Issued / freeze treatment — edits blocked |

---

## 4. User logic flow (operator)

```text
CAD unlocked
  → Present tab
  → New deck  (or pick existing)
  → Add page (if needed)
  → Compose panels (text / plan crop / image / swatches / widgets)
  → Optional: Dissect plan  → Accept / Reject crop ghosts
  → Optional: Format page   → Accept / Reject layout ghosts
  → Optional: Apply template
  → Deck settings (title, deliverable, template, palette, font)
  → Print  (meeting pack)
  → Issue  (freeze → locked)   [status path]
```

---

## 5. Screen inventory (regions to design)

Design **one composition**: left rail + page stage + bottom page nav. Not a multi-dashboard.

### 5.1 Shell

| Region | Role | Contents |
|--------|------|----------|
| **Surface root** | Full takeover inside studio board area | `data-testid="present-surface"` |
| **State banner** | One-line mode status | Empty / ready / ghost / locked copy |
| **Sidebar** (~260px) | Deck library | Back, title “Present”, New deck, deck list, delete |
| **Workspace** | Active deck | Toolbar + page area + page nav |
| **Empty workspace** | No deck selected | Lead + New deck |

### 5.2 Deck sidebar

| Element | Spec |
|---------|------|
| Back | Ghost button → CAD |
| Title | “Present” |
| New deck | Primary CTA |
| Deck row | Title + deliverable label + “— issued” when locked |
| Delete | Per-row destructive (warn / reversible preference) |
| Empty list | “No decks yet. Create one to start.” |

### 5.3 Deck toolbar (active deck)

| Control | Spec |
|---------|------|
| Deck title | Live title readout |
| Deck settings | Toggles summoned inspector dock |
| Print | Browser print |

### 5.4 Deck settings dock (summoned)

| Field | Options (labels) |
|-------|------------------|
| Title | Free text |
| Deliverable | Client deck · Quotation · Mood board · Concept sketch |
| Template | Editorial classic · Editorial minimal · Editorial feature · Editorial schedule |
| Palette | Stone · Sage · Ink · Blush · Parchment |
| Font | Fraunces · Sora · Inter · Hand-written |

**Design ask:** One dock language (dark translucent / high-contrast inspector), close control, field hierarchy. Not a second browser settings page.

### 5.5 Page stage

| Element | Spec |
|---------|------|
| Page paper | Single page artboard — the hero of Present |
| Panels | Freely placed rectangles on the page (% layout) |
| Add bar | Add text · Add plan crop · Add swatch board · Add image · Add widget |
| AI bar | Dissect plan · Format page · Apply template |
| Pickers | Image picker · Widget picker (popovers) |
| Ghost reviews | Dissect review · Format review (Accept / Accept all / Reject / Close) |

### 5.6 Page nav

| Element | Spec |
|---------|------|
| Page tabs | 1 · 2 · 3 … |
| Count | “N pages” |
| Add page | Secondary |

---

## 6. Panel types (content inventory)

Each panel is a **kind** with a rect on the page (`x/y/w/h %`, z-index).

| Kind | Purpose | Designer notes |
|------|---------|----------------|
| **text** | Heading + body | Roles: body (and heading emphasis). Editable in place. |
| **plan_crop** | Crop of live CAD plan | Shows boundary/building/items/strokes from plan snapshot; label + reason from Dissect; “sync crop” when board revision moves |
| **image** | Photo / underlay from canvas image layers | Empty picker if no layers — copy: import in Sketch/CAD first |
| **swatch_board** | Material chips from live board | Columns (default 3), toggle swatches, caption |
| **widget** | Live data tile | Bound to estimate / materials — see §7 |

### Panel chrome (per panel)

Design selected / hover / drag / resize / bring-to-front / remove affordances. Keep handles calm — instrument bezel, not game HUD.

---

## 7. Live widgets

| Widget | Slot hint | Content |
|--------|-----------|---------|
| Quote total | title_meta | Total incl. GST (AUD) |
| Savings ledger | side_stack | Indicative savings / ledger lines |
| Zone summary | side_stack | Zone metrics from estimate |
| Material swatches | footer_band | Live material chips |
| Caption | footer_band | Short caption text |
| Honesty footer | footer_band | Indicative pricing disclaimer |

Widgets must read as **live instrument readouts**, not marketing stats pills.

---

## 8. AI flows (ghost theatre)

Same human-in-the-loop law as CAD ghosts.

### 8.1 Dissect plan

1. Operator clicks **Dissect plan**.  
2. API returns crop proposals (`label`, `reason`, crop rect).  
3. **Ghost review** lists proposals.  
4. Accept → becomes `plan_crop` panel(s). Reject → discard. Accept all → batch.

### 8.2 Format page

1. Requires ≥1 panel on the page.  
2. **Format page** proposes new rects / placement.  
3. **Format review** shows rationale + per-panel Accept / Reject.  
4. Accept writes layout; never auto-applies without Accept.

### 8.3 Apply template

Template-driven layout pass (destructive-adjacent — treat as strong confirm visually). Disabled when page has no panels.

**Design ask:** Distinct ghost language for Present (editorial paper ghosts) vs CAD board ghosts — related family, not identical.

---

## 9. Deliverable × template matrix (design variants)

Design **cover + 2 interior page samples** for each deliverable × at least two templates.

| Deliverable | Intent |
|-------------|--------|
| Client deck | Meeting narrative — plan crops + story text |
| Quotation | Price-forward — quote widgets + honesty |
| Mood board | Material / image heavy — swatches + images |
| Concept sketch | Early intent — sketch-forward imagery + light copy |

| Template | Layout character |
|----------|------------------|
| Editorial classic | Balanced title + body + side stack |
| Editorial minimal | Sparse margins, one hero crop |
| Editorial feature | Large plan / image feature |
| Editorial schedule | Denser meta + lists |

| Palette | Mood (use product tokens; no raw hex in ship) |
|---------|-----------------------------------------------|
| Stone | Neutral grey stone |
| Sage | Soft green landscape |
| Ink | High-contrast dark editorial |
| Blush | Warm accent (content theme only — not studio chrome blush) |
| Parchment | Cream paper kinship with Fit sheet |

---

## 10. States & edge cases (must design)

| State | UI |
|-------|-----|
| Locked mode (no CAD yet) | Mode tab disabled + lock copy |
| Empty Present (no decks) | Banner `empty` + empty workspace CTA |
| Deck with no pages | “No pages. Add one…” |
| Image picker empty | Import guidance |
| Dissect / Format busy | Loading on buttons |
| Ghost review open | Banner `ghost` + review panel |
| Issued / locked | Banner `locked`; issued badge on list; no edit affordances |
| Autosave | Uses studio UnifiedSaveStatus (do not invent a second save pill) |
| Error | Inline error in sidebar (validation / network) |

---

## 11. Visual dialects on Present

| Layer | Dialect |
|-------|---------|
| Studio outer frame (mode strip still visible) | Flat frame IDE icons |
| Present sidebar + toolbar | Instrument / kit buttons — calm, dense enough for ops |
| Deck settings dock | Summoned dark translucent inspector |
| Page paper | Light printable sheet — the artwork |
| Ghost reviews | Frost / elevated review cards over the page |
| Live widgets | Mono meta + clear AUD figures |

Do **not** park a permanent opaque settings column on top of the page paper.

---

## 12. Related surfaces (do not merge in this brief)

| Surface | Relationship |
|---------|--------------|
| **Client presentation** | Chrome-off plan theatre for screen share — separate View toggle |
| **Fit sheet** | Cream working drawing on the plan — toggle **F**, not Present |
| **Quote / Live cost** | Right-lane BOM on CAD — feeds widgets, not Present itself |
| **Share / portal** | After costed quote — client URL, not deck authoring |
| **Print meeting pack** | Also available from Client presentation chrome |

---

## 13. Suggested designer deliverables (Present pack)

Ship as one Figma / FigJam pack named **Present mode — meeting deck**.

1. **Shell wire + hi-fi** — sidebar + page + nav (empty / ready / locked).  
2. **Deck settings dock** — open / closed, all field types.  
3. **Page paper system** — margins, type scale, panel chrome (rest / select / resize).  
4. **Panel kit** — text, plan crop, image, swatch board, each widget type.  
5. **Add + AI toolbar** — rest / hover / loading / disabled.  
6. **Ghost review** — Dissect list + Format list (Accept / Reject / Accept all).  
7. **Deliverable samples** — 4 deliverables × 2 templates (cover + interior).  
8. **Palette swatches** — 5 themes applied to one sample page.  
9. **Print preview** — A4/Letter page frame for meeting pack.  
10. **Motion notes** — dock in, ghost arrive, page tab change (2–3 intentional motions).

---

## 14. Copy bank (sentence case)

| Context | Copy |
|---------|------|
| Mode lock | Accept CAD geometry before presenting. |
| Empty banner | Empty — create a deck to start composing |
| Ready banner | Ready — compose pages and panels |
| Ghost banner | Ghost review — accept or reject proposals before issuing |
| Locked banner | Locked — this deck is issued; edits are blocked |
| Empty workspace | Select a deck or create one to start composing. |
| No pages | No pages. Add one to start composing. |
| Image empty | No image layers on the canvas. Import a photo or plan underlay in Sketch or CAD mode first. |
| Honesty (widgets) | Indicative pricing only. Final quote subject to site conditions… |
| AI | Dissect plan · Format page · Apply template |
| Ghost actions | Accept · Accept all · Reject |

---

## 15. Engineering anchors

| Area | Path |
|------|------|
| Surface | `apps/web/src/components/canvas/handoff/features/present/PresentSurface.tsx` |
| Deck settings | `…/present/DeckInspectorDock.tsx` |
| Styles | `…/present/present.module.css`, `deckInspectorDock.module.css` |
| Contracts | `packages/contracts/src/schemas/presentation-document.ts` |
| API | `apps/api/src/routes/presentation-documents.ts` |
| E2E | `apps/web/e2e/present-surface-state.spec.ts` |
| Unlock | `apps/web/src/lib/canvas-mode.ts` (`hasCad` → Present) |

---

## 16. Out of scope for this Present pack

- Redesigning the CAD board, Fit sheet, or Quote rail  
- R3F / 3D deck stage  
- Real-time multi-user co-editing  
- Client portal quote/deposit screens (separate pack)  
- Stage 2 survey-grade sheet export  

---

*End of Present mode designer feature spec.*
