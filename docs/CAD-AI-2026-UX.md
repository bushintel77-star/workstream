# CAD–AI 2026 UX (binding)

**Status:** Binding for `HandoffDesignStudio` and CAD/AI chrome.  
**Companions:** [STUDIO-STYLING-AND-UX.md](./STUDIO-STYLING-AND-UX.md) (tokens + chrome laws) · [CANVAS-FIRST-UX.md](./CANVAS-FIRST-UX.md) · [DESIGN-KIT-INVENTORY.md](./DESIGN-KIT-INVENTORY.md) · Fitts proximity (`features/reach/fittsProximity.ts`).

Gold-standard UX for an AI-powered landscape / architectural CAD platform balances two paradigms:

| Paradigm | Owns | UX stance |
| --- | --- | --- |
| **Deterministic precision** | CAD geometry, site boundaries, topography, setbacks | Hard constraints; never silently violated |
| **Probabilistic generation** | AI ideation, ghosts, stylistic variations | Proposals only — Accept / Reject / undo |

AI is a **spatial collaborator inside the drawing**, not a separate chatbot. Treat it as an intelligent intern: the human architect always controls final constraints.

---

## 1. Disappearing interface

| Pattern | Rule | Workstream today |
| --- | --- | --- |
| Edge-to-edge canvas | Viewport is the drawing | Handoff board; chrome floats |
| Contextual floating tools | Object stays clear; inventory **pops up** as frost at summon point; orbit outside glyph | KitAssetDock (popup) + selection ring |
| AI sidecar (right) | Collapsible: dialogue, variations, analytics | Utility hub + Live measures (collapsed by default) |
| Structure rail (left) | Collapsed CAD data: layers, constraints | Layers panel (`layersOpen` default false) |
| Instruments | Summon only (margin / hub) — no sticky ribbon on select | Ambient ribbon + `instrumentsSummoned` |
| Variation filmstrip | Large 16:9 / 3:2 thumbs, bottom or sidecar | **Gap** — ghosts use review card today |

Static AutoCAD-style ribbons are forbidden. Progressive disclosure via `resolveHandoffChrome`.

---

## 2. Contextual logic

- **Semantic selection** — tools and AI read object metadata (softscape vs hardscape).
- **Progressive disclosure** — start simple; expose density / budget / growth after a proposal exists.
- **Non-destructive inpainting** — regenerate only a masked zone; protect locked geometry (existing trees, title, hardscape unless unlocked).
- **HITL** — ghosts never silent-write; Accept / Reject / Esc cancel.

---

## 3. Constraint-first CAD ↔ AI

| CAD layer | AI behaviour | UX |
| --- | --- | --- |
| Property lines & setbacks | Hard boundary | Block permanent structures beyond; explain via tooltip / council zone |
| Topography & slopes | Environmental input | Suggest retaining / terracing when grade warrants |
| Existing hardscape | Fixed / masked | Weathering / shadow only unless unlocked |
| Softscape zones | Probabilistic sandbox | Plant masses / paths within climate + zone |
| Existing trees (TRP) | Protected | Ambient council advice; TPZ local to selection |

Explainable AI: if the system refuses a plant or structure, say **why** (setback, invasive, TPZ).

---

## 4. Multi-modal workflow (target loop)

1. **Site ingestion** — GIS / aerial / survey drop → scale + orientation  
2. **Constraint definition** — lock must-keep (title, trees, utilities)  
3. **Generative ideation** — sketch + prompt → variations in sidecar  
4. **Extraction to CAD** — chosen variation → polygons / counts / m²  
5. **Environmental stress test** — sun / season / growth scrubbers  

Golden rule: override, undo, and manual adjust must stay effortless.

---

## 5. Spatial clustering (Fitts + proximity)

Object-local actions (lock, delete, Ask AI, DBH) orbit **outside** the glyph so the drawing stays free. Material + open-source library inventory lives in the **summoned fold-out library** (search + Draft kit + catalog category sections). See `features/kitInventory/KitAssetDock.tsx`.

---

## Gap tracker (short)

| Guide item | Status |
| --- | --- |
| Contextual materials / CAD params on selection | **Yes** — bottom KitAssetDock + open-source Library; orbit ring clears glyph |
| AI sidecar (dialogue + analytics) | **Partial** — utility + live measures gated by `aiSidecar` |
| Structure rail left, collapsed | **Yes** — Layers left; gated by `structureRail` |
| Variation filmstrip | **Not started** |
| 1:1 CAD plan ↔ 3D AI lock | **Not started** (Workflow 1 2D) |
| Non-destructive zone regen | **Partial** — ghosts / flora; no mask paint yet |
| Constraint-first setback explain | **Partial** — council ambient + compliance |

Update [IMPLEMENTATION-STATUS.md](./design/operator-redesign/design_handoff_landscape_cad_studio/IMPLEMENTATION-STATUS.md) when closing gaps.
