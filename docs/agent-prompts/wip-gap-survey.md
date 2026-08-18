# WIP & gap survey — end-to-end pipeline integrity audit

Standalone task for a fresh agent context. You do not share any prior
conversation; everything you need is below. You produce a survey report; you do
NOT write or fix feature code, and you do NOT edit any doc. Report only.

## Mission

Survey the Workstream monorepo to establish, with code-level evidence:

1. **WIP** — what is genuinely in flight (uncommitted work, half-wired
   features, env-gated paths) versus what the docs claim is done.
2. **Gap** — what stands between today's state and a real user completing a
   real project end-to-end through the pipeline: **title data → sketch → CAD
   parsing → elevation tracing → inspector → 3D render**.
3. **Best practice** — per pipeline stage, whether the implementation meets the
   repo's own quality bar (contract-first schema, pure tested math,
   reachability/wiring, persistence + undo, title-boundary reconciliation, e2e
   probes) and industry norms for a 3D CAD-grade canvas (selection at
   production scale, transform manipulation, section documentation).

The product framing under test: the pipeline is a real vertical slice with
integrity at each stage, and three interaction gaps are claimed to block
end-to-end completion: **no gizmos** (move/rotate/scale in 3D), **no marquee**
(bulk selection), **no section/cut** (architectural documentation). Your job is
not to rubber-stamp or refute these claims — it is to verify each one against
the code with `file:line` evidence, and to find WIP and gaps the claims miss.

## Golden rules (violations are findings, not skips)

1. **Never trust a doc premise.** AGENTS.md, ONBOARDING.md, the
   GOLD-STANDARD docs, OUTSTANDING.md, the handover files, and the agent
   prompts in `docs/agent-prompts/` all drift from code. The repo has an
   entire "shipped inert" history of features that passed typecheck and unit
   tests and shipped doing nothing because the final wiring was missing.
   Verify every claim against current code; flag every false premise
   explicitly.
2. **"Shipped" ≠ "on main".** Per ONBOARDING §3, "shipped" has meant
   "implemented in the working tree, commit/PR pending". Check `git status`
   and `git log --oneline -20` early; treat working-tree-only code as WIP,
   not shipped.
3. **Evidence standard.** Every claim carries `file:line` citations (or git
   / command output). Separate three buckets: **verified** (read in code,
   wired, reachable), **docs claim** (stated in a doc, not confirmed in
   code), **unverified** (could not confirm this session). No bucket gets
   skipped.
4. **The two-studio split is real.** `apps/web/src/components/canvas/webgl/`
   is the product (R3F, metre-space). `apps/web/src/components/canvas/
   handoff/HandoffDesignStudio.tsx` (~6,500 lines) is the `?svg=1`-only
   fallback and is not developed further. Survey WebGL as primary; mention
   SVG only where a parity claim actually routes there.
5. **Title-boundary reconciliation is a standing rule.** Any geometry that
   represents something physically sited on the property must snap to the
   title boundary (`DesignSiteFrame.boundary`, board-% ring; world space via
   `pctToWorld`/`worldToPct` in `webgl/coordTransform.ts`) or be stamped
   locational-indicative. Any artifact that invents positions without
   reconciling is a defect finding. The known open case is the photo-trace
   plane-to-ground projection (facade → plan), blocked on a product
   decision (depth rule).
6. **Reachability is the failure mode.** The repo's own audit found features
   "complete except for one connection". Static gates (lint, the reachability
   script) cannot see a component imported and rendered behind a condition
   that is never true. For each claimed gap, check not just that code exists
   but that a user can reach it: rail tool present and armed, store action
   called, pointer plumbing live, persistence wired.
7. **No fixing.** Record failures, drift, and red gates with evidence; do not
   fix them. Gate runs limited to `pnpm typecheck`, `pnpm lint`, and targeted
   vitest. Do not run `pnpm run ci`'s install/build steps unless required.
   Note the domain build gotcha: after any domain edit (you will make none),
   api tests read stale `dist` until `pnpm --filter @workstream/domain build`.
8. **Known operational red herrings — do not re-debug.** The GitHub account
   billing freeze (Actions `startup_failure`, Railway git-build silent
   failures) is a human billing problem (2026-08-18 handover). The
   `webgl-asset-fanout.spec.ts` positional flake (passes alone, intermittently
   fails last-in-batch) is tracked in OUTSTANDING. Report both as known, not
   new findings.

## Reading order

1. `ONBOARDING.md` — entry: two-studio situation, camera machine, sketch→CAD
   wiring, ranked work.
2. Binding: `docs/GOLD-STANDARD-2026.md`, `docs/GOLD-STANDARD-2026-TOKENS.md`,
   `docs/GOLD-STANDARD-2026-ARCHITECTURE.md` — skim for architecture facts
   (`SpatialObject`, metre-space peg, camera/chrome layering).
3. Living: `OUTSTANDING.md` (ranked punch list),
   `docs/CAMERA-STATE-MACHINE.md`, `docs/PRODUCTION-ROADMAP-2026-08-17.md`,
   `docs/FEATURE-LIST-CONCEPT-TO-SIGNOFF.md`.
4. `docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md` (snapshot, superseded for state —
   treat as historical) and the current handover
   `docs/SESSION-HANDOVER-2026-08-18-CONTINUATION.md`.
5. Agent prompts: `docs/agent-prompts/differentiator-backlog.md` first (the
   product's own parity/differentiator sequence), then
   `docs/agent-prompts/inspector-scope.md` + `inspector-scope-output.md`.

## Method — walk the pipeline stage by stage

For each stage verify: (a) persisted inputs/outputs in `packages/contracts`
schemas, (b) API route/job, (c) the WebGL surface, (d) unit tests + e2e
probes, (e) end-to-end wiring (can a user actually traverse it), (f)
best-practice assessment. Stage anchors (start here; verify independently):

1. **Title data / site truth.** `apps/api/src/lib/vicmap.ts` (keyless DELWP
   GeoServer WFS), hydrate route `site-boundary.ts`, keyless overlays
   (EVC/planning/bushfire/contour/water_corp), web import
   `webgl/siteTruthImport.ts`, `DesignSiteFrame.boundary`,
   `webgl/DimensionLayer.tsx` (per-edge world segments via `pctToWorld`).
2. **Sketch.** `webgl/FusedSketchLayer.tsx` (freehand ink on the GL surface),
   `studioStore.sketchMode`, ink persistence in `DesignCanvas`, photo-trace
   interplay (elevation-space ink is scoped out of plan convert with a
   stamped notice).
3. **CAD parsing.** `POST /projects/:id/sketch-cad`
   (`apps/api/src/routes/design-sketch-cad.ts`) →
   `apps/api/src/lib/claude.ts` `formalizeSketchToCad` (vision + heuristic
   fallback); domain `sketch-to-cad.ts` (`interpretSketchStrokesToCad`
   classifier) and `stroke-recognize.ts` (`recognizeStroke` →
   `buildLandscapeFeatureFromStroke`); WebGL rail **Tidy** →
   `webgl/sketchCad.ts` → `SketchCadReviewCard.tsx` accept/reject; one-click
   **Convert to CAD features** mints `LandscapeFeature`s persisted in
   `DesignCanvas.features`; source ink kept on both paths.
4. **Elevation tracing.** Photo-trace capstone: `webgl/PhotoTracePlane.tsx`,
   `PhotoTraceHud.tsx`, `SitePhotoGallery.tsx`, `PhotoElevationSheet.tsx`,
   `photoTraceMath.ts`; reference-line calibration; `boundary_snap` +
   `elevationFacadeAzimuth` in `cameraRig.ts`;
   `apps/api/src/routes/site-photos.ts`.
5. **Inspector + selection.** `webgl/InspectorCard.tsx`, `inspectorPolicy.ts`
   (which fields edit, which clamp, which are attribute-only),
   `selectionPick.ts` (click/shift-click/Esc, `SelectionRef` families:
   placement | feature | photoStroke), `studioStore` selection actions,
   `marqueeSelect.ts` + rail tool, persistence/undo (`useStudioAutosave.ts`,
   `stateBridge.ts`, design-VCS upsert + three-way merge).
6. **3D render.** `webgl/StudioScene.tsx`, `TerrainMesh.tsx`, `sceneItems.tsx`
   (foliage ramp, ground bounce — the tracked "murk" item), `FusedCamera.tsx`
   + `cameraAnimation.ts` (fused ortho↔persp), real sun (`sunLight.ts`),
   `present` lens / `SplitViewLens.tsx`, quote/fit-sheet (`FitSheetCard.tsx`),
   live BOM.

## Investigation checklist

### A. The three parity claims — verify, don't assume

Known tension (session observations; must be independently verified):

- **Gizmos (move/rotate/scale).** Claimed absent. Observed: no
  `TransformControls`/gizmo/drag-move implementation anywhere in
  `apps/web/src` (only comments naming "the gizmo phase"),
  `inspectorPolicy.ts` defers position editing to that phase, and
  `differentiator-backlog.md` item 4 lists the gizmo phase as a parity gap.
  The inspector edits `scale` and `canopy_radius_m` as numeric fields only.
  `@react-three/drei` (which ships `TransformControls`) is already a
  dependency — no library blocker. Verify: any drag-move of placements or
  features at all? Any object rotation (`rotateDeg` in `cameraRig.ts` is
  camera azimuth, not object rotation — do not count it)? Snap integration
  (`snapWorld.ts`)? Undo surface? What precisely remains versus a v1 gizmo
  (translate-only? translate+rotate? scale?).
- **Marquee.** Claimed absent. Observed: a marquee rail tool appears fully
  shipped in code — `marqueeSelect.ts` (pure Liang-Barsky + point-in-polygon
  hit tests, unit-tested), `studioStore` `marqueeActive`/`marqueeDraft`/
  `marqueeSelectBox`, pointer plumbing in `StudioControls.tsx` (tool-gated so
  plain drag still pans), dashed draft box in `StudioScene.tsx`, rail tool id
  `"marquee"` in `StudioToolRail.tsx`. Meanwhile the docs drift: AGENTS.md
  says "marquee is deliberately not used", `differentiator-backlog.md` says
  "in build", `inspector-scope.md` says "no marquee". Verify end-to-end
  reachability; find the e2e probe (a marquee spec in sketch mode is
  referenced); check the known open items: marquee in cad mode blocked by the
  always-open CAD drafter panel over the board centre (chrome issue, not
  marquee scope), and whether marquee selection feeds anything downstream
  (bulk-edit is a documented post-marquee item — is there a many-refs
  read-only summary in the inspector?).
- **Section/cut.** Claimed absent; the repo holds a full section/cut *system*
  as a differentiator (`differentiator-backlog.md` item 1) while a partial
  surface exists: rail tool `"section"` ("Elevation slice", `sliceActive`),
  `SliceProfileCard.tsx`, `ElevationSliceLine.tsx`, plus earthworks cut/fill
  math (`cutFill.ts`, `EarthworksLayer.tsx`). Scope check per the doc:
  determine what the current slice tool lacks versus a true cut system —
  persistent named cut planes, section marks on plan, saved section views on
  the elevation sheet, section-vs-elevation semantics, annotation/
  dimensioning. Note the operator's framing conflict (section/cut claimed as
  both parity — "standard architectural documentation" — and differentiator);
  state the facts and the tradeoff, do not decide it.

### B. WIP — everything actually in flight

- `git status` / `git log --oneline -20`: uncommitted or unpushed work;
  working-tree-only code. (The photo-trace capstone was in exactly this state
  at the last handover — verify its current state.)
- `OUTSTANDING.md` open items (P0 single API replica; P1 mobile EAS
  credentials, Redis worker env, Litestream bucket, branch protection; P3
  classic-studio e2e debt, asset-fanout flake) — map each to code where
  possible; label each human-owned vs code-owned.
- Env-gated paths that silently change behaviour: `CLERK_SECRET_KEY`
  (dev-user fallback), `REDIS_URL` (in-process vs BullMQ), `SENTRY_DSN`,
  vision-key absence → heuristic fallback in sketch-CAD, `NEXT_PUBLIC_E2E`
  gating quiet auto-trace.
- TODO/FIXME/HACK/`_`-prefixed markers in the webgl surface and pipeline
  libs — list only ones indicating incomplete wiring or scoped-out work.
- The "shipped inert" pattern: exported component never imported (the
  reachability gate catches this) or imported but rendered behind a
  never-true condition (invisible to static gates) — check the highest-risk
  candidates that look finished yet are never mounted.

### C. Docs-vs-code drift register

ONBOARDING §7 lists known stale comments (PerimeterTabStrip "classic-board
modes navigate to `?svg=1`", `stateBridge.ts`, `studioStore.ts` aerial-underlay
comment, `cameraRig.ts` tilt note) — verify each and add new drift you find
(AGENTS.md's marquee sentence is a live candidate). This register is a
deliverable, not a tangent: drift is how gaps get papered over.

### D. Production-scale integrity (the "200+ plantings" bar)

A real site has 200+ plantings. Assess whether each stage degrades gracefully
at that scale and at print-documentation fidelity:

- Selection: single-click vs bulk paths; can 200+ placements be selected,
  filtered, or bulk-edited in one gesture?
- Render: per-placement meshes vs instancing; foliage cost; bundle budget
  (`scripts/check-bundle-size.mjs` + `bundle-size-budget.json`).
- Live BOM / quote recompute cost on edit; fit-sheet at scale.
- Elevation and section sheets as deliverable documents (metre ticks, scale,
  stamps) — what a landscape architect actually hands over.
- Persistence: autosave fingerprint + three-way merge behaviour under rapid
  multi-edit.

### E. Best-practice audit per stage (the deep-analysis layer)

Score each pipeline stage against the repo's own quality bar with evidence:

1. **Contract-first:** changes land in `packages/contracts` (Zod) before API/
   client; any schema drift between boundary and implementation?
2. **Pure, unit-tested math:** the webgl pattern is pure modules + colocated
   tests (`marqueeSelect`, `selectionPick`, `photoTraceMath`, `cutFill`,
   `flowField`, `cameraRig`, `snapWorld`, `trenchPath`, `lightingPath`,
   `irrigationZonePath`) — which stage lacks this pattern?
3. **Wiring:** everything reachable by a real user (rail tool → store action →
   pointer path → persist → reload)?
4. **Persistence + undo:** does each mutating path go through autosave +
   design-VCS upsert + merge? Any path mutating the document off the journal?
5. **Title-boundary reconciliation:** any geometry placed without snap or an
   indicative stamp?
6. **Tests:** unit tests colocated; e2e probes in `apps/web/e2e/`; which
   stages have live probes, which have none; which probes are red or flaky
   (known: asset-fanout).
7. **Performance:** the 200+ bar above.
8. **Accessibility:** the canvas contrast gate exists
   (`e2e/canvas-contrast-aa.spec.ts`) — only note regressions verifiable
   cheaply; do not run the whole a11y suite.
9. **Honesty:** canned data in live paths (OUTSTANDING "production
   placeholders": supplier prices, Melbourne trade catalog, plant carbon
   stubs, polygon-difference stub, preemptive-risk stub) — verify each is
   still stubbed and where it hits the pipeline.

## Deliverables

One markdown report. Return it as your final message and write it to
`docs/agent-prompts/wip-gap-survey-output.md`.

Structure (sentence case headings, no emojis):

1. **Executive summary** — the pipeline as a health map: one row per stage
   (title → sketch → CAD parsing → elevation tracing → inspector → 3D render)
   with status (verified working / partial / gap / blocked), the three parity
   claim verdicts in one line each, and the top WIP items.
2. **Parity claim verdicts** — gizmos, marquee, section/cut: verified vs
   claimed, with the evidence chain (code → wiring → reachability → test →
   docs claim), confidence, and the exact gap that remains, if any.
3. **WIP register** — in-flight items with owner (code vs human), state, and
   the one next action each.
4. **Gap analysis** — ranked by how each blocks a real end-to-end project,
   separating parity (blocks completion) from differentiators (tier-above,
   held) from product-gated scope (Stage 2 CAD, mobile AR). Note explicitly
   where your findings contradict the repo's own gap docs.
5. **Docs-vs-code drift register** — every false premise found, with the
   correction.
6. **Best-practice findings** — per stage and cross-cutting, each with
   evidence; call out the strongest patterns (to protect) and the weakest (to
   fix).
7. **Recommendations** — ranked, each with effort estimate (S/M/L), risk, and
   the specific file/module where the work lands. No code changes this
   session.
8. **Evidence index** — every `file:line` cited, grouped by claim.

Acceptance criteria: every claim in sections 2–4 is cited to `file:line` or
explicitly marked unverified; each parity claim ends with a one-paragraph
verdict; the report is honest about what this session could not confirm.

## Constraints

- Workspace `C:\Users\Tim\Downloads\CURTIS-CO\workstream`. Use read / grep /
  glob; cite `file:line`.
- Sentence case, no emojis, AU English.
- Do not modify code or docs. Do not run heavy installs. Gate runs limited to
  `pnpm typecheck`, `pnpm lint`, targeted vitest.
- Do not start dev servers or Playwright unless a single cheap spec run is
  needed to settle a verdict; the batch-flake caveat applies to the WebGL
  suite.
