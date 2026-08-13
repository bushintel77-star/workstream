# Frontend design spec (consolidated)

Status: active handoff specification for desktop web and mobile.

This document consolidates the relevant design direction across canvas/studio docs into one comprehensive frontend spec.

## 1) Product intent

Workstream is a canvas-first landscape design and delivery system.  
The primary UX rule is: **the drawing is the product**.

That means:

- Site facts, design intent, pricing, and client handoff all stay anchored to one spatial surface.
- UI chrome supports the drawing and should not dominate it.
- Workflow progression follows explicit gates instead of disconnected tools.

---

## 2) Methodology: seven core pillars

## 2.1 AI-native core logic (not a bolt-on)

AI is part of the operating system of the product, not an optional plugin:

- It participates in interpretation, suggestion, and stage progression.
- It powers ghost proposals, command-palette actions, and context-aware next steps.
- It remains human-governed via explicit accept/reject/override actions.

Design implication: AI controls must be integrated into normal task flow, not isolated as novelty widgets.

## 2.2 Preemptive intelligence

The experience should anticipate needs rather than wait for failure:

- Stage-aware next actions (survey -> design -> costing -> audit -> output).
- Early surfacing of risk/compliance friction before client handoff.
- Live estimate signal during drawing (not delayed spreadsheet reconciliation).

Design implication: expose likely next move and likely risk at the moment of decision.

## 2.3 Progressive disclosure (strict state machine)

Show only what matters for the current stage.

- Survey: capture tools and context controls.
- Sketch/CAD: design-authoring controls.
- Quote/Share: pricing and handoff controls.
- Deep controls remain hidden until summoned.

Design implication: avoid persistent monolithic ribbons; use contextual reveal by mode.

## 2.4 Visual hierarchy (drawing first)

Hierarchy order:

1. Drawing geometry and site context
2. Contextual overlays
3. Transient chrome

Design implication:

- Canvas remains dominant.
- Rails/panels recede and appear when needed.
- Interaction focus stays on space, not UI furniture.

## 2.5 Separation of concerns through semantic color

Color is structural, not decorative:

- Existing vs proposed
- Retained vs new planting
- Utilities/easements/services
- Warning/block/info/success states

Design implication: encode domain meaning with stable semantic colors and avoid arbitrary palette shifts.

## 2.6 Single project graph (one model, many lenses)

Survey, Sketch, CAD, Quote, and Share are lenses over one evolving project graph.

- No fractured copies of truth between stages.
- Quote derives from live geometry and tagged items.
- Audit and handoff reference current state.

Design implication: states and transitions must feel continuous, not app-switching.

## 2.7 Human governance and accountability

Automation accelerates work but does not remove professional control:

- AI proposals are reviewable.
- Overrides are explicit and attributable.
- Locked facts remain protected once commercial stages begin.

Design implication: trust comes from transparent control, not hidden automation.

---

## 3) End-to-end workflow model

## 3.1 Stage sequence

Survey -> Sketch -> CAD -> Elevation (optional lens) -> Quote -> Share

## 3.2 Stage definitions

### Survey (capture reality)

Purpose: establish factual site baseline.

Capture:

- Title boundary
- Existing dwelling
- Existing trees
- Spot levels (RL)
- Services/easements
- Optional scale calibration

Outcome gate:

- Site context completeness reached (ready for design stages).

### Sketch (express intent fast)

Purpose: rapid concept exploration and client-direction clarity.

Behavior:

- Low-friction drawing and massing.
- Early concept communication.
- Optional formalization pathways toward CAD.

Outcome gate:

- Concept intent clear enough to resolve in structured design.

### CAD (resolve design)

Purpose: convert intent into structured, editable, measurable design.

Behavior:

- Place/paint assets and materials.
- Author zones/paths.
- Review AI ghosts and decide accept/reject.
- Summon measures and technical overlays.

Outcome gate:

- Design state suitable for indicative costing.

### Elevation (working view)

Purpose: read vertical/spatial relationships without leaving project context.

Behavior:

- Section/elevation interpretation as supplementary lens.

Outcome:

- Better design confidence for proportion and level relationships.

### Quote (commercialization)

Purpose: price from live design state.

Behavior:

- Live cost rail (empty -> estimation -> expanded quote builder).
- Editable line-level quote controls.
- Margin and subtotal governance.
- Services/site locks respected as required by stage logic.

Outcome gate:

- Client-ready indicative quote can be promoted.

### Share (controlled handoff)

Purpose: publish validated deliverables.

Behavior:

- Promote quote output.
- Create/copy portal link.
- Capture revision/acceptance flow.
- Blocked when unresolved AI draft dependencies exist.

Outcome:

- Immutable, shareable client handoff state.

---

## 4) Workflow guardrails and unlock logic

- Sketch/CAD/Elevation unlock after survey/aerial readiness.
- Quote unlock requires accepted CAD geometry.
- Share unlock requires costed or persisted quote state.
- Pending AI ghost proposals can gate client-facing promotion.
- Survey context becomes progressively protected as pipeline matures.

---

## 5) Product surfaces to design

## 5.1 Desktop web (primary operator surface)

Core routes:

- `/`
- `/home`
- `/projects/[id]`
- `/projects/[id]/processing`
- `/projects/[id]/recordings`
- `/projects/[id]/audit`
- `/projects/[id]/outputs`
- `/projects/[id]/carbon`
- `/projects/[id]/filing`
- `/projects/[id]/measurements`
- `/portal/quote/[token]`
- `/portal/deposit/[token]`
- `/share/[token]`

Redirected but still state-relevant:

- `/projects/[id]/overview`
- `/projects/[id]/survey`
- `/projects/[id]/design`
- `/projects/[id]/design/develop`
- `/projects/[id]/costing`
- `/projects/[id]/tasks`

## 5.2 Mobile app (on-site companion)

Core mobile routes:

- `/(app)/index`
- `/(app)/new-project`
- `/(app)/project/[id]`
- `/(app)/design-studio/[id]`
- `/(app)/processing/[id]`
- `/(app)/recording`
- `/(app)/measure-photo`
- `/(app)/filing/[id]`
- `/(app)/settings/*`

---

## 6) Canvas/studio UX architecture

## 6.1 Frame + board model

- Dark gallery frame contains controls.
- Cream/plan surface is the subject.
- Persistent chrome should not sit as opaque slabs over geometry.

## 6.2 Lane law

- Right data lane is single-occupancy (one active panel at a time).
- Summoned panels should resolve collisions predictably.
- Left tools are contextual and stage-gated.

## 6.3 Summon model

- Controls appear at point-of-intent.
- Idle chrome recedes.
- Secondary complexity stays behind explicit user intent.

## 6.4 Camera vs UI separation

- Geometry layers live in the zoom/camera world.
- UI chrome is rendered outside camera transforms.
- No counter-scaling hacks for UI readability.

---

## 7) Token system (source of truth)

## 7.1 Web token files

- `apps/web/src/styles/color-tokens.css`
- `apps/web/src/styles/globals.css`

Token layers:

1. Raw hue and neutral ramps
2. Semantic drawing tokens
3. Surface/ink/line/accent chrome tokens
4. Type/space/radius/elevation/motion primitives
5. Studio-specific sizing variables (top bar, rails, insets)

## 7.2 Shared cross-platform tokens

- `packages/ui/src/tokens.ts`

Domains:

- `color.surface`, `color.ink`, `color.line`, `color.accent`, `color.semantic`
- `font`, `type`
- `space`, `radius`
- `elevation`
- `motion`

---

## 8) Semantic color methodology

## 8.1 Canvas semantics

- Existing context: crimson family
- Proposed geometry: cobalt family
- Retained planting: forest family
- New planting: sprout/sage/hedge/olive family
- Easements/services: slate + APWA utility colors
- Material semantics: soil/mulch/bluestone/concrete/timber/water/gravel/lawn

## 8.2 UI semantics

- `ok`, `warn`, `block`, `info` are reserved status channels
- Accent supports interaction emphasis, not arbitrary branding noise
- Ink hierarchy (primary/secondary/tertiary) carries legibility and attention

Rule: **semantic token usage only** (avoid direct ad-hoc hex in components).

---

## 9) Preemptive estimate and quote methodology

The commercial flow must remain continuously tied to design state:

1. Empty live-cost rail prompts placement
2. Estimation rail shows live running totals and section signals
3. Expanded quote builder enables line-level commercial editing
4. Share promotion publishes controlled client state

Design principle: estimate feedback should feel immediate and trustworthy, with clear confidence and handoff boundaries.

---

## 10) Required UI states (every major screen)

- Loading
- Empty
- Populated
- Validation failure
- API/network error
- Permission/lock/disabled
- Pending long-run operations
- Success confirmation

Studio-specific additions:

- No-survey baseline
- AI-pending gate
- Quote empty vs quote populated
- Share blocked vs share ready

---

## 11) Content and honesty system

Non-negotiable messaging themes:

- Concept estimate vs construction reality must be explicit
- Site facts vs proposed design must remain visually and verbally distinct
- Quote and portal outputs must carry AU/GST language and professional caveats

---

## 12) Designer deliverables expected from this spec

1. Stage wireflows and transition maps
2. Component library with full state variants
3. Desktop-first responsive specs + touch-density variants
4. Interaction choreography (summon/dismiss, lane ownership, command triggers)
5. Semantic color usage map for geometry and chrome
6. Quote/share commercial-state map
7. Error and recovery pattern catalog

---

## 13) Screenshot pack linkage

Reference screenshots:

- `docs/design-spec/screenshots/`
- index file: `docs/design-spec/index.md`

Use these captures as visual baseline for state-specific design reviews.

---

## 14) Primary reference docs consolidated into this spec

- `docs/CANVAS-FIRST-UX.md`
- `docs/STUDIO-STYLING-AND-UX.md`
- `docs/OPERATOR-STUDIO-GOLD-WALKTHROUGH.md`
- `docs/STUDIO-PRODUCT-PHASES.md`
- `docs/DESIGN-DNA.md`
- `docs/CAD-AI-2026-UX.md`

Implementation anchors:

- `apps/web/src/components/canvas/handoff/state/handoffChrome.ts`
- `apps/web/src/components/canvas/handoff/features/quote/LiveCostRail.tsx`
- `apps/web/src/components/canvas/handoff/features/quote/QuoteBuilder.tsx`
- `apps/web/src/components/canvas/handoff/features/share/ShareSurface.tsx`
- `apps/web/src/lib/project-next-action.ts`

---

## 15) 2026+ future-proof UX trends for LS canvas-first

LS (landscape studio) UX is moving toward an **intelligence-native spatial cockpit** rather than a traditional design tool UI. The product should stay aligned to these trajectory shifts:

## 15.1 Ambient AI copilot, not chat dependency

- AI appears as inline proposals, risk flags, and next-step automation at the locus of work.
- Chat remains available but is secondary to direct, context-aware action controls.
- Ghost previews and auto-routing (for trenches/services pathways) become default interaction primitives.

Future-proof rule: prioritize in-canvas intent handling over separate assistant panels.

## 15.2 Constraint-first authoring

- Tools should enforce site/legal/constructability constraints during creation, not after.
- Boundary, services, and compliance overlays are active constraints that shape geometry behavior.
- Errors shift from retrospective warnings to real-time guardrails.

Future-proof rule: “draw valid by default.”

## 15.3 Progressive autonomy with explicit human checkpoints

- Repetitive operations become machine-assisted batches (tagging, quantity rolls, draft costing).
- High-stakes transitions (quote publish/share) remain approval-gated.
- Confidence signaling (low/med/high confidence suggestions) should be visible before acceptance.

Future-proof rule: automate execution, preserve accountability.

## 15.4 Disappearing chrome and commandable interfaces

- Persistent controls shrink; summon-based UI and command palette flows expand.
- Contextual radial/near-cursor affordances reduce eye travel and panel thrash.
- Keyboard/gesture commandability becomes a first-class productivity channel.

Future-proof rule: less always-visible UI, more just-in-time capability.

## 15.5 Multimodal site capture to live model

- Voice notes, photos, measurements, and quick annotations should land on one project graph.
- Mobile capture must round-trip into desktop canvas without manual reconciliation.
- Provenance (who captured what, when) becomes part of operational trust.

Future-proof rule: every capture modality feeds one canonical design state.

## 15.6 Semantically encoded visual systems

- Semantic color systems expand beyond static legend use into mode-aware and risk-aware highlighting.
- Visual language differentiates fact/proposal/risk/commercial certainty at a glance.
- Accessibility-aware contrast and color redundancy (pattern/label backup) are mandatory.

Future-proof rule: color communicates operational meaning, never pure decoration.

## 15.7 Quote intelligence as continuous feedback

- Cost and carbon should behave like continuous overlays, not end-stage exports.
- Sensitivity previews (material swap, area shift, labor assumptions) should be immediate.
- Client-facing outputs inherit the current validated model, minimizing drift.

Future-proof rule: commercial insight is co-authored with design, not appended later.

## 15.8 System observability for UX trust

- Users should see pipeline status, blockers, and retry states without ambiguity.
- AI actions and automated transitions need traceable event history.
- Reliability UX (clear loading/error/recovery loops) is part of product quality, not edge handling.

Future-proof rule: transparent system state beats optimistic opacity.

## 15.9 Desktop-first depth + mobile field precision

- Desktop remains the deep-authoring cockpit.
- Mobile specializes in high-signal capture, verification, and on-site updates.
- Shared semantics/tokens keep cross-surface coherence while respecting device intent.

Future-proof rule: one product language, role-specific interaction depth.
