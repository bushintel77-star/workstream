# Operator studio — gold-standard walkthrough & assist UX

**Status:** Training reference for Curtis & Co operators and AI assist prompts.  
**Surface:** Live mount `HandoffDesignStudio` at `/projects/[id]?mode=…`  
**Binding UX:** [CANVAS-FIRST-UX.md](./CANVAS-FIRST-UX.md) · [STUDIO-STYLING-AND-UX.md](./STUDIO-STYLING-AND-UX.md) · [CAD-AI-2026-UX.md](./CAD-AI-2026-UX.md) · [STUDIO-PRODUCT-PHASES.md](./STUDIO-PRODUCT-PHASES.md)

---

## 0. One sentence for every trainee

**The drawing is the product.** One canvas, six **lenses** (tabs), progressive unlock. Survey captures **what the site is**; Sketch/CAD capture **what you propose**; Quote/Share capture **what it costs and what the client sees**.

Permanent honesty: *Concept sketch for estimating — not a construction drawing.*

---

## 1. What is a “workflow” here?

### 1.1 The six mode tabs (workflows)

These are the only top-level workflows. Each is a **lens** on the same project geometry — not a separate app.

| Tab | Workflow name | Operator job | Unlocks when |
| --- | --- | --- | --- |
| **Survey** | Site capture | Record title, dwelling, trees, levels, services | Always (project open) |
| **Sketch** | Intent | Freehand ink + rough massing; envelope conversation | Title/aerial ready (`hasAerial`) |
| **CAD** | Design | Place/paint materials, zones, dims; accept AI ghosts | Same as Sketch |
| **Elevation** | Working section | Read height relationships along one axis | Same as Sketch |
| **Quote** | Indicative price | Read live BOM total + line items | Accepted CAD geometry (`hasCad`) |
| **Share** | Client handoff | Promote quote → portal link / revision | Costed BOM or persisted quote (`hasQuote`) |

```text
Survey ──▶ Sketch ──▶ CAD ──▶ Quote ──▶ Share
              │         │
              └─ Elevation (read-only lens anytime after Sketch unlock)
```

### 1.2 What is **not** a workflow tab

These are **site context** or **layers** — captured in Survey, shown read-only later, locked at Quote.

| Item | Part of | Not a tab because |
| --- | --- | --- |
| **Services & utilities** (drainage corridors, RL levels, easements) | **Survey** | Site facts you discover, not design you author in CAD |
| **Existing dwelling** | **Survey** (+ Vicmap hydrate) | Fixed envelope; garden is designed *around* it |
| **Title boundary** | **Survey** (+ Vicmap snap) | Cadastral fact; lock when Vicmap/traced |
| **Existing trees** | **Survey** | Retained context; TRP overlays in CAD |
| **Layers panel** | Chrome (any CAD-like lens) | View toggles — not a workflow stage |
| **Fit sheet** | Overlay (toggle **F**) | Working-drawing presentation, not a mode |
| **Tilt view** | View-only (Cmd+K → Tilt) | Massing read; plan stays authoritative |
| **Live BOM / measures** | Summoned right lane | Analytics — not a workflow |

**Rule:** If it describes *what was on the lot before you designed*, it belongs to **Survey**. If it describes *what Curtis proposes to build/plant*, it belongs to **Sketch/CAD**.

---

## 2. Site context vs design — the matrix

| Geometry / data | Survey | Sketch | CAD | Quote | Locked at Quote? |
| --- | --- | --- | --- | --- | --- |
| Title boundary | Trace / Vicmap snap | Faint guide | Editable nodes if unlocked | Context | Title lock when Vicmap |
| Existing dwelling | Vicmap / trace / empty cue | Hatch overlay | Hatch overlay | Context | Yes (envelope) |
| Existing trees | Place `exist` symbols | Dimmed | TPZ / compliance | Context | N/A (symbols editable until share) |
| Spot RL levels | **Level** tool | Labels | Labels | Context | **Yes** |
| Service corridors | **Servc** tool | Lines | Lines | Context | **Yes** |
| Easements | **Servc** (≥3 pts) | Hatch | Hatch | Context | **Yes** |
| Scale calibration | **Calib** tool | — | — | — | Yes (board scale set) |
| Lawn / paving / plants | — | Ink / Add | Add / Paint | Costed | Design (live BOM) |
| Drip / lighting zones | — | — | **Zone** tool | Costed | Design |
| AI ghosts | — | Optional | Accept/Reject | Draft gate if pending | Must clear before client quote |

---

## 3. Progressive unlock (assist UX)

When a tab is greyed/locked, use this copy — do not paraphrase into softer language.

| Locked tab | Assist says |
| --- | --- |
| Sketch, CAD, Elevation | “Complete survey and title boundary first.” |
| Quote | “Accept CAD geometry before quoting.” |
| Share | “Cost something on the drawing before sharing.” |

**Suggested next tab** (empty `?mode=`): Survey → CAD → Quote → Share based on progress.

---

## 4. Gold-standard walkthrough — Wrights Terrace loop

Use **12 Wrights Terrace, Prahran** (or any live project) for tier-1 training. Address-gated ledger appears on Quote when `isTier1WrightsTerrace(address)`.

### Phase A — Survey (site capture)

**Goal:** Complete checklist **5/5** before serious CAD.

| Step | Operator action | Assist UX (trainer / AI sidecar) | Pass criterion |
| --- | --- | --- | --- |
| A1 | Open project → **Survey** tab active | “Confirm Vicmap title loaded — no demo parallelogram dwelling. If outline unavailable, Trace → Existing dwelling.” | Title ring on board; checklist open |
| A2 | **Trace** → boundary (or accept Vicmap snap) | “Hover node to move · edge diamond to add · right-click delete. Tab can rectangle.” | Checklist: Boundary traced ✓ |
| A3 | Confirm **existing dwelling** | “Dwelling is context, not hero — hatch only. Vicmap footprint or operator trace; never seed warp.” | Checklist: Existing dwelling ✓ |
| A4 | **Add** → place existing trees (`exist`) | “Mark every retain tree you will protect — AS 4970 TPZ follows in CAD.” | Checklist: Existing trees ✓ |
| A5 | **Level** → click points, enter RL | “Spot levels are survey facts — one RL per click.” | Checklist: Spot levels ✓ |
| A6 | **Servc** → 2 pts = corridor; ≥3 + Enter = easement | “Services are not design — trace what’s on site before you plant around it.” | Checklist: Services / easements ✓ |
| A7 | Optional **Calib** | “Two known points + distance — only if Vicmap scale needs confirmation.” | Board metres coherent |
| A8 | Close checklist when **5/5** | “Base complete — ready for CAD.” | Foot reads ready |

**Survey tools in left dock:** Trace · Select · Add · … · **Calib · Level · Servc** · Grid  
(Servc/Level/Calib only appear in Survey before Quote lock.)

### Phase B — Sketch (intent)

**Goal:** Client-visible envelope without precision CAD.

| Step | Operator action | Assist UX | Pass criterion |
| --- | --- | --- | --- |
| B1 | Switch **Sketch** | “Sketch is conversation — ink and massing, not lodgement CAD.” | Sketch board visible |
| B2 | Pen / eraser on sketch pad | “Coarse strokes only; formalize to CAD when intent is clear.” | Strokes saved |
| B3 | Optional AI formalize → CAD | “Ghosts land on CAD — nothing writes until Accept.” | User chooses when |

**Hidden in Sketch:** Live BOM hero, full QS sheet, CAD line dock (chrome matrix).

### Phase C — CAD (design)

**Goal:** Tagged materials, compliance green, ghosts cleared, live BOM > $0.

| Step | Operator action | Assist UX | Pass criterion |
| --- | --- | --- | --- |
| C1 | Switch **CAD** | “Select is ground state — pan with Space/middle-drag, not a Pan tool.” | CAD plan board |
| C2 | **Add** → inventory popup at margin | “Library summons at gutter — never a slab on the glyph.” | Placement on outdoor area |
| C3 | **Paint** → swatch tray for fills | “Soft/Hard chips — digits 1–9 arm swatches.” | Surfaces tagged |
| C4 | **Zone** → drip or lighting path | “Authored zones feed irrigation BOM lines.” | Zones if irrigating |
| C5 | Review **AI ghosts** | “Accept or Reject every ghost before client-ready quote.” | `pendingGhosts === 0` |
| C6 | Summon **measures** (chip or Cmd+K) | “Live measures are analytics — summoned, not parked.” | Title / outdoor / selection rows |
| C7 | Optional **Fit sheet** (**F**) | “Working drawing frame — cream paper, outside dims. Toggle off to return to board.” | Frame on/off understood |
| C8 | Optional **Tilt** (Cmd+K) | “View-only massing — roof reads above footprint; never author geometry in tilt.” | Esc exits tilt |

**Services in CAD:** read-only overlay (lines + RL labels). **No Servc tools** — survey already captured them.

### Phase D — Elevation (optional lens)

**Goal:** Read height, trace planting back to plan.

| Step | Operator action | Assist UX |
| --- | --- | --- |
| D1 | **Elevation** tab | “Section lens — toggle axis, trace in plan returns to CAD.” |

### Phase E — Quote (indicative price)

**Goal:** Understand live BOM; know services + dwelling are locked.

| Step | Operator action | Assist UX | Pass criterion |
| --- | --- | --- | --- |
| E1 | Switch **Quote** | “Totals come from live preemptive BOM on this drawing — not a frozen tender until Share promote.” | Quote surface |
| E2 | Read line items + GST total | “Survey services and dwelling are locked site context as of this visit.” | Copy understood |
| E3 | Tier-1 ledger (Wrights) | “Value reallocation narrative — target quote vs cottage-scatter scope.” | Ledger visible if tier-1 |
| E4 | If AI draft gate | “Pending proposals still on board — review before client-ready.” | Resolve ghosts |
| E5 | **Back to CAD** if scope change | “Design changes update quote live until you promote.” | — |

**On Quote entry:** `servicesLocked = true` — Servc/Level/Calib removed; Services layer slider → **Survey locked**.

### Phase F — Share (client handoff)

**Goal:** Immutable revision + portal.

| Step | Operator action | Assist UX | Pass criterion |
| --- | --- | --- | --- |
| F1 | Switch **Share** or share icon | “Promote live cost → quote before portal link.” | Quote persisted |
| F2 | **Share revision popup** | “Capture immutable revision — client accepts on portal.” | Revision saved |
| F3 | Copy portal URL | “Curtis & Co brand on portal — Workstream on operator shell.” | Link opens |

---

## 5. Assist UX scripts (Cmd+K / Ask AI)

Use natural language; binary outcomes. Never silent-write geometry.

### 5.1 Stage detection prompts

| User says | Assist routes to | Response shape |
| --- | --- | --- |
| “Snap title / Vicmap / foundation” | Spatial correction or Stage 1 foundation cleanse | Bullet notes: parcel snapped, dwelling hydrated/cleared |
| “What’s missing on survey?” | Survey checklist | List unchecked rows + one next action |
| “Quote this” | Quote tab if `hasCad` | Open Quote or explain lock reason |
| “Share with client” | Share if costed | Promote flow or BOM empty state |

### 5.2 Constraint-first refusals (explain why)

| Situation | Assist says |
| --- | --- |
| Plant in TPZ | “Hardscape inside tree protection zone — AS 4970. Move outside TPZ or confirm arborist waiver on site.” |
| Structure past setback | “Outside council setback overlay — indicative flag only; confirm certificate.” |
| Quote with pending ghosts | “AI draft unverified — N proposals on board. Accept or reject before client-ready quote.” |
| Edit services after Quote | “Survey services locked at quote — site context. Return to Survey only before first Quote visit (session); otherwise note site change in scope.” |

### 5.3 Coach marks (first-run overlay)

Built-in three-step coach (`StudioCoachMarks`):

1. **Trace the lot** — boundary + building over aerial; Tab rectangle.
2. **Add planting & hardscape** — Add + ghosts; amber pulse when stale.
3. **Fit sheet & quote** — F for working drawing; Quote for live BOM.

Trainer: set `?guide=1` or clear `localStorage cc_coach_done` to replay.

---

## 6. Chrome & lane law (trainee must internalize)

### 6.1 Right data lane — one panel at a time

| Panel | Opens from | Occupies |
| --- | --- | --- |
| Survey checklist | Survey auto-open | Right lane |
| Layers | Layers icon | Right lane |
| Live measures | Measures chip / summon | Right lane |
| Sites (demo) | Hidden on live projects | — |

**Lane law:** Opening checklist hides measures chip collision; only one right-lane occupant.

### 6.2 Left tool dock (static frost rail)

| Tool | Survey | Sketch | CAD | Quote/Share |
| --- | --- | --- | --- | --- |
| Trace | ✓ | ✓ | ✓ | hidden |
| Select | ✓ | ✓ | ✓ | hidden |
| Add / Paint / Zone | ✓ | ✓ | ✓ | hidden |
| Measure | ✓ | ✓ | ✓ | hidden |
| Calib / Level / Servc | ✓ (pre-quote) | — | — | — |
| Grid | ✓ | ✓ | ✓ | hidden |

### 6.3 Keyboard shortcuts (gold path)

| Key | Action |
| --- | --- |
| **F** | Toggle Fit sheet |
| **Esc** | Clear selection / exit tilt / dismiss dial |
| **A** / **Enter** | Accept ghost (when review open) |
| **1–9** | Arm paint swatch / quick-add type |
| **Cmd+K** | Command palette (tilt, layers, quote, etc.) |
| **Space** + drag | Pan camera |
| **Tab** (trace) | Close rectangle |

---

## 7. Honesty & AU locale (non-negotiable copy)

| Surface | Copy |
| --- | --- |
| Board banner | Concept sketch for estimating — not a construction drawing. |
| Dwelling label | Existing dwelling · Vicmap / operator-traced · confirm on site |
| Empty dwelling | Existing dwelling outline unavailable · Trace → Existing dwelling |
| Quote | Incl. GST from live preemptive BOM · promote from Share for client-ready revision |
| Fit sheet dims | Indicative metres — confirm on site before lodgement |
| Portal | Curtis & Co · scenario picker · deposit in AUD incl. GST |

---

## 8. Anti-patterns (trainer stops immediately)

| Anti-pattern | Why wrong | Correct |
| --- | --- | --- |
| Edit services in CAD after survey | Services are site facts | Complete Servc/Level in Survey |
| Trust demo dwelling parallelogram | Seed warp breaks scale | Vicmap hydrate or trace; empty is OK |
| Ship quote with amber ghosts | AI unverified | Accept/Reject all |
| Fixed opaque inventory bar | Violates disappearing UI | Summoned popup at margin |
| Chrome inside zoom-world | Gate C failure; breaks rotate | `CameraChrome` portal only |
| Treat Quote as frozen tender | Live BOM until Share promote | Promote revision for portal |
| “Services tab” expectation | No such workflow | Survey checklist row + Servc tool |

---

## 9. Pipeline outside the canvas (same project)

These routes **redirect into canvas lenses** — train as one world:

| Legacy route | Lens |
| --- | --- |
| `/projects/:id/survey` | `?mode=survey` |
| `/projects/:id/design` | `?mode=sketch` |
| `/projects/:id/design/cad` | `?mode=cad` |
| `/projects/:id/design/develop` | `?mode=quote` |
| `/projects/:id/costing` | `?mode=quote` |
| `/projects/:id/outputs` | `?mode=share` |

Downstream jobs (full pipeline costing, audit, permit outputs) consume **accepted** canvas geometry — not survey placeholders.

---

## 10. Training completion checklist

Trainee demonstrates end-to-end without trainer prompts:

- [ ] Survey checklist **5/5** on a live Melbourne address  
- [ ] Dwelling honest (Vicmap, traced, or empty — never seed warp)  
- [ ] Services traced in Survey; read-only in CAD  
- [ ] CAD design with ≥1 material; live BOM updates  
- [ ] All ghosts accepted or rejected  
- [ ] Quote opened; understands live vs promoted  
- [ ] Services **Survey locked** in Layers after Quote  
- [ ] Share revision captured (or explained why skipped)  
- [ ] Can state where Services lives (**Survey**, not a tab)  

---

## 11. Related docs

| Doc | Use |
| --- | --- |
| [STUDIO-PRODUCT-PHASES.md](./STUDIO-PRODUCT-PHASES.md) | Workflow 1 vs Stage 2 boundary |
| [QUOTE_WORKFLOW.md](./QUOTE_WORKFLOW.md) | Envelope → develop → quote sequence |
| [STUDIO-SITE-INTELLIGENCE.md](./STUDIO-SITE-INTELLIGENCE.md) | AI HITL, horizon cards |
| [DESIGNER-HANDOVER.md](./DESIGNER-HANDOVER.md) | Symbol palette, tier-1 species |
| [TIER1-AI-CANVAS-GAP-AUDIT.md](./design/operator-redesign/design_handoff_landscape_cad_studio/TIER1-AI-CANVAS-GAP-AUDIT.md) | Scorecard vs gold |
| [SITE-INFRASTRUCTURE-AUTOMATED-LINKS.md](./SITE-INFRASTRUCTURE-AUTOMATED-LINKS.md) | Pre-construction LA due diligence + Vicmap/BYDA automation map |

---

*Last updated: 2026-07-24 — aligns with HandoffDesignStudio six-tab strip, survey-only services authoring, quote-time services lock, Vicmap dwelling hydrate.*
