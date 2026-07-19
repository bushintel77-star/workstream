# Tier-1 AI-first · Canvas-first · CAD landscape — gap audit

**Date:** 2026-07-19  
**Surface audited:** Live mount `HandoffDesignStudio` (`%-coord` parchment / aerial board on `/projects/[id]`)  
**Residual surface:** MapLibre `SiteCanvas` (geo Fit sheet, Clay Walk, worker BOM) — still in repo, **not** default  
**Binding UX:** [CANVAS-FIRST-UX.md](../../../CANVAS-FIRST-UX.md) · handoff README § mandate  
**Phases:** [STUDIO-PRODUCT-PHASES.md](../../../STUDIO-PRODUCT-PHASES.md) — Workflow 1 now; Stage 2 deferred  

---

## Executive verdict

Workstream’s handoff studio is **ahead of typical 2026 residential landscape SaaS on AI-HITL and progressive disclosure**, and **behind professional BIM/CAD suites on site modelling, grading, irrigation, and survey-locked output**.

| Pillar | Score (0–5) | One-line |
|--------|-------------|---------|
| Canvas-first / calm chrome | **4.2** | Mode chrome matrix + parchment plane; Share/Walk thinner than SiteCanvas |
| AI-first HITL | **4.0** | Ghosts / coach / horizon binary loop is gold; vision depth still heuristic |
| Material orchestrator | **3.6** | Continuous assembly estimate + Advanced disclosure; no worker pulse on handoff |
| Compliance foresight | **3.8** | Stonnington / AS 4970 live; authored DBH + utilities missing |
| Drafting competence | **3.5** | Trace / edit / snap / layers solid for Workflow 1; not Land F/X grading |
| Site intelligence | **2.4** | Sun scrubber only; shade mesh / easements / DBYD thin or absent |
| Paper / Fit sheet | **3.7** | Working-drawing frame done; portal-grade export honesty partial |
| Immersive walk / clay | **1.0** | Clay Walk exists on SiteCanvas only — not on live mount |
| Persistence / share | **2.2** | Session undo + tick; durable `DesignCanvas` + portal unlock weak on handoff |
| Survey-grade CAD (Stage 2) | **1.5** | `@workstream/cad` / DXF exist elsewhere; intentionally off handoff |

**Product stance (do not relitigate):** stay **indicative + honest** for Workflow 1. Do not chase Vectorworks grading or Land F/X irrigation on `%` geometry. Close the gaps that make Curtis & Co’s **tier-1 residential loop** (Wrights Terrace DNA) feel AI-first and canvas-first end-to-end.

---

## 1. 2026 gold-standard logic (what “tier-1” means here)

Industry reference points (2026): Vectorworks Landmark (BIM site → schedules), Land F/X / F/X CAD (planting + irrigation automation on AutoCAD), SketchUp + Lumion (client 3D), AI visualizers as **accelerators** not authors of lodgement geometry.

Workstream’s **tier-1 gold standard** is not “feature parity with Landmark.” It is the intersection of:

1. **Canvas-first** — drawing plane is the product; chrome is a state machine ([CANVAS-FIRST-UX.md](../../../CANVAS-FIRST-UX.md)).
2. **AI-first HITL** — proposals are ghosts; Accept / Reject / Yes / Not now; never silent mutation ([STUDIO-SITE-INTELLIGENCE.md](../../../STUDIO-SITE-INTELLIGENCE.md) §6).
3. **Material orchestration** — every vector expands secondary/tertiary assemblies into a live cost HUD without Design↔Quote mode thrash.
4. **Preemptive compliance** — permeability, setback, TPZ, drainage foresight update on every commit.
5. **AU residential honesty** — indicative metres, GST, AS 4970, council flags, “not a construction drawing.”
6. **Tier-1 Wrights Terrace** — address-gated value ledger + savings narrative on quote / portal.

### Gold-standard interaction loop (target)

```text
Survey aerial → Sketch intent → CAD tag materials
        ↓              ↓              ↓
   site intel     AI ghosts     live cost + horizon
        ↓              ↓              ↓
   Fit sheet ←—— Accept/Reject ——→ Quote → Share/portal
```

Every arrow is **progressive disclosure**: Sketch never sees QS; CAD never dumps assembly recipes; AI never writes accepted geometry without a binary confirm.

### Gold-standard engine split (target)

| Layer | Must stay invisible | May surface |
|-------|---------------------|-------------|
| Turf / boolean / % maths | Always | Never in primary HUD |
| Assembly depths, tippers | Advanced only | Quote ledger / Advanced |
| Compliance thresholds | Canvas border + calm ticker | Compliance sheet on demand |
| AI confidence factors | Collapsed by default | Expand in ghost card |
| Worker estimate settle | Skeletal pulse on total | Never raw JSON |

---

## 2. Dual-surface hazard (audit constraint)

| | **Handoff (live)** | **SiteCanvas (residual)** |
|--|--------------------|---------------------------|
| Geometry | `%` parchment + aerial slot | MapLibre / Vicmap title |
| Mount | `page.tsx` → `HandoffDesignStudio` | Unmounted default |
| Worker BOM | **Not wired** | `bom.worker.ts` + `LiveBomHud` |
| Clay Walk | **Missing** | `ClayWalkthrough` |
| Share / portal unlock | Copy URL thin | Portal copy/open + quote gate |

`IMPLEMENTATION-STATUS.md` still marks some MapLibre items **Done** from the residual stack. Treat those as **not shipped on the live surface** until ported or re-mounted.

---

## 3. Pillar audit — Now vs gold

Legend: **G** = meets gold for Workflow 1 · **P** = partial · **M** = missing · **S2** = Stage 2 only (correctly deferred)

### 3.1 Canvas-first UX

| Capability | Status | Evidence | Gap |
|------------|--------|----------|-----|
| Mode chrome matrix | **G** | `resolveHandoffChrome` + tests | Keep Share lens parity with SiteCanvas |
| Sketch hides Live BOM / QS | **G** | chrome: `liveBom: false` in sketch | — |
| Floating HUDs / indicator tabs | **G** | `UtilityDrawer`, ambient ribbon | Avoid re-introducing fixed QS sidebars |
| Drawing collapses utility | **G** | `collapseUtility` on Trace/Edit/Add | — |
| Edge-to-edge plane | **P** | Parchment under aerial; inset paper board aesthetic from v4 | Bleed vs inset: decide one composition rule for CAD lens |
| No AutoCAD ribbon | **G** | Ambient proximity strip, not tool wallpaper | Resist ribbon creep from site-intel brainstorm |

### 3.2 AI-first HITL

| Capability | Status | Evidence | Gap |
|------------|--------|----------|-----|
| Ghost propose → Accept/Reject | **G** | `studioAiEngine`, `AiGhostReview` | — |
| Conversational coach | **G** | `AiCoachDock` NL status | Keep data tables out of coach |
| Stale-ghost after nearby edit | **G** | `markStaleGhostsNearEdit` | — |
| Confidence factors | **G** | Expand-in-card | Default collapsed (already) |
| Aerial canopy | **P** | Colour-cluster heuristic | Trained detector / vision API quality bar |
| NL assist → ghosts | **P** | `designAssistAction` + prompt builders | Grounding to site intel (shade/utility) weak |
| Preemptive horizon cards | **G** | Drainage / TPZ / engineer Yes/Not now | Cap card noise (max 2 — done) |
| AI draft gate on Quote | **G** | `QuoteSurface` unverified gate | Mirror on Share/portal unlock |
| Generative 3D / AI visualizer | **M** | — | Optional moodboard path; not Workflow 1 critical |
| Silent AI overwrite | **G** (absent) | Ghosts only | Keep ban absolute |

### 3.3 Material / cost orchestration

| Capability | Status | Evidence | Gap |
|------------|--------|----------|-----|
| Continuous `estimateStudioDrawing` | **G** | Domain + `useStudioState` | — |
| Primary HUD = total + tags | **G** | `LiveBomDock` | — |
| Nested assembly under Advanced | **G** | excavation / CR6 / tippers | — |
| Labour + access factor | **P** | `accessConstrained` heuristic | Real access / bobcat rules from site walk |
| Irrigation / lighting BOM | **M** | Softscape labour only | Zone tags → secondary BOM (Workflow 1 backlog) |
| Web Worker + skeletal pulse | **M** on handoff | Worker only on SiteCanvas | Port `bom.worker` settle path or document main-thread OK |
| Cut / fill volumes | **M** / **S2** | — | Needs topo; Stage 2 or later |
| Supplier / Land F/X plant database | **M** | Curtis palette gate only | Intentional; deepen house palette, not generic catalogs |

### 3.4 Compliance & ecological foresight

| Capability | Status | Evidence | Gap |
|------------|--------|----------|-----|
| Permeability / canopy targets | **G** | `studio-preemptive-compliance` | Multi-council profiles beyond Stonnington |
| 1.5 m setback snap | **G** | Envelope helpers | — |
| AS 4970 TPZ | **P** | Default DBH by type | Operator-authored DBH / survey tree fields |
| Drainage foresight | **G** | Horizon + French-drain ghost | Stormwater volume estimate still qualitative |
| Retaining / engineer fee | **P** | heightM threshold | Explicit retaining-wall type + >1.2 m AU rule copy |
| Utility / DBYD conflict | **M** | Site-intel S4 only | Dashed utility overlay + honesty footer |
| Root vs hardscape maturity | **P** | Growth scrubber + TPZ | Mature canopy boolean vs paving still light |

### 3.5 Drafting (Workflow 1)

| Capability | Status | Evidence | Gap |
|------------|--------|----------|-----|
| Trace + Tab rectangle | **G** | `TraceOverlay`, domain completion | — |
| Edit / marquee / undo | **G** | `CadPlanBoard`, history | — |
| Measure indicative | **G** | `MeasureOverlay` | Always label “indicative” |
| Layer opacity buckets | **G** | 4-bucket model | Site-intel overlay stack not full |
| Grading / contours | **S2** | — | Correctly deferred |
| Irrigation design engine | **S2**/M | — | Zones on `DesignCanvas` later |
| DXF / paper-space dims | **S2** | `@workstream/cad` elsewhere | Do not bolt onto `%` board |

### 3.6 Site intelligence (2026 practical needs)

From [STUDIO-SITE-INTELLIGENCE.md](../../../STUDIO-SITE-INTELLIGENCE.md):

| Need | Gold | Handoff now | Gap |
|------|------|-------------|-----|
| Sun / shade bands | Time + season mesh on aerial | Heuristic scrubber length | Port `shade-grid` overlay to `%` board |
| TRP / TPZ | Live rings + conflicts | Done indicative | Authored DBH |
| Utilities | Dashed + “confirm locate” | Missing | Overlay + honesty |
| Easements | Hatch from title | Thin types | Render + conflict matrix |
| Permits rail | Live flags as sketch changes | Compliance ticker only | Site inspector accordion |
| Planting suitability | Shade → palette filter | Missing | Filter Add strip by sun metadata |
| Client overlays | Read-only portal | Thin Share | Portal share path |

### 3.7 Fit sheet / paper / Walk

| Capability | Status | Gap |
|------------|--------|-----|
| A3/A4 working drawing | **G** | — |
| Schedule + edge dims + stacked elev | **G** | — |
| Honesty caption | **G** | Keep permanent |
| PDF / print pack | **P** | Browser print vs exported sheet pack |
| Digital Clay Walk cross-fade | **M** on handoff | Port `ClayWalkthrough` or defer with explicit copy |
| AR on-site walkthrough | **M** | Industry 2026 stretch; not Workflow 1 |

### 3.8 Persistence, share, tier-1 business loop

| Capability | Status | Gap |
|------------|--------|-----|
| In-session undo / site snapshots | **G** | — |
| Durable canvas → API | **P**/M | Autosave tick ≠ persist `DesignCanvas` |
| Share → portal unlock | **P** | Handoff copies URL; SiteCanvas has unlock |
| Tier-1 Wrights ledger | **G** on Quote | Ensure Share/portal still gates |
| Multiplayer | **M** | Out of scope (store single-tenant) |

---

## 4. Gap priority matrix (Workflow 1 only)

Priorities are **product impact × Canvas-First / AI-first fit**. Stage 2 items listed separately — do not pull forward without schema brief.

### P0 — Close the live-mount honesty loop

| ID | Gap | Why gold | Suggested move | Status |
|----|-----|----------|----------------|--------|
| P0.1 | Durable handoff → `DesignCanvas` / API persist | Tier-1 jobs cannot live in session memory | Wire mutate path → existing design save actions | **Done** — `canvasBridge` + debounced `saveDesignCanvasAction` |
| P0.2 | Share / portal unlock parity with SiteCanvas | Client confidence = product | Port quote-persisted unlock + honesty watermark | **Done** — `ShareSurface` + `cadQuoteAction` / `copyPortalLinkAction` |
| P0.3 | AI draft gate on Share | Unverified ghosts must not look client-ready | Same gate as `QuoteSurface` | **Done** — `share-ai-draft-gate` |

### P1 — Invisible engine polish

| ID | Gap | Why gold | Suggested move |
|----|-----|----------|----------------|
| P1.1 | Worker + skeletal Live cost pulse | Canvas-First live-cost rule | Reuse `bom.worker.ts` settle UX on handoff total |
| P1.2 | Shade grid on `%` aerial | 2026 site-intel baseline | Port `shade-grid` → `CadPlanBoard` / ground stack |
| P1.3 | Easement hatch + honesty footer | Title reality check | Render `easements` + “confirm title” |
| P1.4 | Authored DBH for TPZ | AS 4970 credibility | Selection ring → Advanced DBH field |

### P2 — AI depth without chrome fog

| ID | Gap | Why gold | Suggested move |
|----|-----|----------|----------------|
| P2.1 | Vision canopy quality | Better ghosts, less noise | Swap heuristic when vision API returns clusters |
| P2.2 | Assist grounded in compliance + shade | Conversational AI that knows the site | Inject compliance + shade summary into `buildStudioSystemPrompt` |
| P2.3 | Irrigation / lighting secondary BOM | Material orchestrator completeness | Tag zones → tertiary lines under Advanced |
| P2.4 | Planting palette sun filter | Shade → species suitability | Filter Add strip by `sunMin` / growth |

### P3 — Immersive / nice-to-have

| ID | Gap | Suggested move |
|----|-----|----------------|
| P3.1 | Clay Walk on handoff | Port cross-fade or mark “Coming on geo survey” |
| P3.2 | AI moodboard / visualizer | Optional; keep off primary CAD loop |
| P3.3 | Multi-council compliance profiles | Parameterize beyond Stonnington constants |

### Explicitly Stage 2 (do not build on `%` board)

- Metre grid origin / PostGIS / EPSG:7855  
- Cut-fill / contour grading  
- DXF paper space, dim styles, revision clouds  
- Full irrigation hydraulic design  
- Survey-locked lodgement sheets  

---

## 5. Gold-standard logic rules (engineering acceptance)

Use these as PR review gates for any studio change:

1. **State-machine chrome** — New dock must declare which modes may show it in `resolveHandoffChrome` (+ test).
2. **Invisible engine** — No new primary-path controls for assembly depth, Turf ops, or tipper counts.
3. **Binary AI** — New AI surfaces expose Accept/Reject (or Yes/Not now) before geometry commits.
4. **One estimate** — Quote / Live cost / horizon read the same `StudioEstimateReport`.
5. **Honesty** — Metre readouts and Fit sheet retain indicative / not-for-construction copy.
6. **No dual truth** — Do not mark MapLibre-only features Done for the handoff mount.
7. **Stage 2 firewall** — Metre / DXF / grading require schema brief; never silent upgrade of `%` items.

---

## 6. Recommended next slice (smallest high-leverage)

1. **P0.1–P0.3** — Persist + Share gate (closes tier-1 business loop).  
2. **P1.1** — Worker skeletal pulse on Live cost (Canvas-First mandate).  
3. **P1.2–P1.3** — Shade + easement overlays (site intelligence without ribbon fog).  

Defer Clay Walk and AI visualizer until the honesty loop is solid.

---

## 7. Scorecard snapshot

```text
Canvas-first ████████░░ 4.2
AI-first     ████████░░ 4.0
Materials    ███████░░░ 3.6
Compliance   ███████░░░ 3.8
Drafting     ███████░░░ 3.5
Site intel   ████░░░░░░ 2.4
Paper        ███████░░░ 3.7
Walk/clay    ██░░░░░░░░ 1.0
Persist/share████░░░░░░ 2.2
Stage 2 CAD  ███░░░░░░░ 1.5 (intentionally deferred)
```

---

## References

- Handoff architecture: `apps/web/src/components/canvas/handoff/ARCHITECTURE.md`
- Implementation checklist: [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md)
- Site intelligence brainstorm: [STUDIO-SITE-INTELLIGENCE.md](../../../STUDIO-SITE-INTELLIGENCE.md)
- Product phases: [STUDIO-PRODUCT-PHASES.md](../../../STUDIO-PRODUCT-PHASES.md)
- Industry 2026 context: Vectorworks Landmark / Land F/X / AI visualizer patterns (BIM + HITL accelerators — not lodgement AI)
