> ⚠️ **SUPERSEDED — do not follow.**
> This document is archived under `docs/archive/pre-gold-standard-2026/`.
> It was superseded by [`docs/GOLD-STANDARD-2026.md`](../../GOLD-STANDARD-2026.md)
> (the supreme binding brief) and its companion specs
> [`GOLD-STANDARD-2026-TOKENS.md`](../../GOLD-STANDARD-2026-TOKENS.md) and
> [`GOLD-STANDARD-2026-ARCHITECTURE.md`](../../GOLD-STANDARD-2026-ARCHITECTURE.md).
> Retained for historical reference only.

# CAD–AI 2026 UX (binding)

**Status:** Binding for `HandoffDesignStudio` and CAD/AI chrome.  
**Companions:** [STUDIO-STYLING-AND-UX.md](./STUDIO-STYLING-AND-UX.md) (tokens + chrome laws) · [CANVAS-FIRST-UX.md](./CANVAS-FIRST-UX.md) · [DESIGN-KIT-INVENTORY.md](./DESIGN-KIT-INVENTORY.md) · Fitts proximity (`features/reach/fittsProximity.ts`) · [CAD-TILT-2026-UX.md](./CAD-TILT-2026-UX.md) (draft — tilt/2.5D pivot proposal for the "1:1 CAD plan ↔ 3D AI lock" gap below).

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
| Contextual floating tools | Object stays clear; inventory grows in place from the Fill rail | AssetPanel + selection ring |
| AI sidecar (right) | Collapsible: dialogue, variations, analytics | Utility hub + Live measures (collapsed by default); **ghost review** mounts in the right data lane when pending |
| Structure rail (left) | Collapsed CAD data: layers, constraints | Layers panel (`layersOpen` default false) |
| Instruments | Summon only (header / margin / Q) — no sticky ribbon on idle | `instrumentsSummoned` gates ToolDock + ContextualToolStrip; craft tools keep strip until Select |
| Variation filmstrip | Large 16:9 / 3:2 thumbs, bottom or sidecar | **Partial** — A/B/C session schemes + plan minimap thumbs; generative AI thumbs deferred |

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

Object-local actions (lock, delete, Ask AI, DBH) orbit **outside** the glyph so the drawing stays free. Material + open-source library inventory lives in the **unified left AssetPanel** (Fill rail → Pinned + catalog accordion → Path Grammar). See `features/assetPanel/AssetPanel.tsx`.

---

## Gap tracker (short)

| Guide item | Status |
| --- | --- |
| Contextual materials / CAD params on selection | **Yes** — AssetPanel Expanded / Placing; orbit ring clears glyph |
| AI sidecar (dialogue + analytics) | **Yes** — utility + live measures gated by `aiSidecar`; ghost review in right lane via header **Ask AI** → `POST /projects/:id/design/assist` (`runStudioAssist`) |
| Structure rail left, collapsed | **Yes** — Layers left; gated by `structureRail` |
| Variation filmstrip | **Yes (session schemes)** — `VariationFilmstrip` A/B/C under shared title; plan minimap thumbs. Generative 16:9 AI thumbs are a separate future feature, not a wiring gap |
| 1:1 CAD plan ↔ 3D AI lock | **Not started** (Workflow 1 2D) — deferred by policy; draft pivot proposal: [CAD-TILT-2026-UX.md](./CAD-TILT-2026-UX.md) |
| Non-destructive zone regen | **Partial** — ghosts / flora accept-reject; no mask paint tool or backend inpainting endpoint yet |
| Constraint-first setback explain | **Partial** — council ambient + compliance disclaimers feed the AI; end-to-end "refused because {setback/TPZ}" tooltip not fully wired |
| Flora Ring (planting Add) | **Yes** — summoned when `floraSession` active (`floraRing` chrome); `rankCurtisFloraCandidates()` against house-palette catalog |
| Preemptive horizon | **Yes** — summoned when foresight cards > 0 (max 2); `buildStudioEstimate()` heuristics, client-side |
| Meeting pack print | **Yes** — client view `window.print()` + scheme caption; backend `presentation-pack` PDF is a separate output path |
| Vicmap easement auto-install | **Yes** — WFS → quiet hydrate / title trace; hatch + honesty; utilities manual + DBYD |
| Develop site loop (Cmd+K) | **Yes** — scan ghosts + scheme/Flora tip + Live BOM via `runDevelopLoop`; HITL (no auto-accept) |
| Lighting conduit + watering plan | **Yes** — fixture catalog snap → LV trench→house; agg PoD / spray valve tip; Zone niche; indicative BOM (`proposeLightingAssist` + `assessLvCircuit`) |
| Sun-cast UI | **Yes** — live `resolveBoardSunCast` + CameraChrome dock; static when shade off |
| Fit Sheet pens + compose | **Yes** — header-summoned CameraChrome peel; pens `technical` / Rough freehand / grey_wash / watercolour; Atmosphere pigments; idle Fit = paper only (Sheets strip hidden); technical furniture honesty matrix |
| Export liability overlay | **Yes** — `ExportLiabilityPrompt` + share gate before issue |

Update [IMPLEMENTATION-STATUS.md](./design/operator-redesign/design_handoff_landscape_cad_studio/IMPLEMENTATION-STATUS.md) when closing gaps.
