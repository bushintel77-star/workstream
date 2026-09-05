# HANDOVER — Tier-1 widgets + e2e signal + Phase 4 seam + stress split (2026-09-05)

For a fresh context window. Updated through commit `ab3c7b3` — CI on `main`
is fully green (gate, secret-scan, stress, all 6 e2e shards, deploy; live
200). Prior context:
[`HANDOVER-2026-09-04-STUDIO-TIER1.md`](HANDOVER-2026-09-04-STUDIO-TIER1.md)
(the Tier-1 design brief this session executed) and [`AGENTS.md`](AGENTS.md).

**Outstanding work lives in §4 (threads) and §5 (the Trace-fluency feature
backlog, itemized with status). Between them they are the complete list.**

---

## 1. Shipped this session (all pushed; gates green at commit time)

| Commit | Content |
|---|---|
| `f61b7b9` | **Tier-1 widget standard** (the prior handover's §2, executed in its §2.5 order): `BrushWidget.tsx` (nibs + W + new **OP opacity dial** + SM + ERASE hold-to-latch + Falloff as collapsed disclosure), `PaletteWidget.tsx` (21-material canon + **RECENT row** + active well with **previous-swap** + **WCAG contrast readout**), `useFlyoutAnchor.ts` (live tile-geometry anchoring: ResizeObserver + window listeners, bloom side from the ribbon's MEASURED edge, vertical clamp honours the bottom chrome stack), colour-well ribbon tile, tiered columns when both panels open (`FLYOUT_COLUMN_STEP_PX`), keyboard B/E/[/]/X + slider arrow-duality (shift ×10), per-nib smoothing defaults, `CanvasStroke.opacity` contract field, `materialContrast.ts` pure OKLCH→WCAG math. Collision gate now measures brush-open + both-open states (20 states × 3 viewports, all clean). `MaterialPalette.tsx` retired. |
| `3fb81b8` | **Contrast-AA cleared + cad.ts refactor.** AI RUN's hardcoded unavailable state was grey-on-gold (1.2:1) → now a hollow key (gold text/border on panel, ~7:1); SRV cell used raw `--ws-dwg-redline` as text (4.47:1) → new `--ws-dwg-redline-ink` tint in tokens.css (6.8:1, mirrors the `truth`/`truth-ink` pattern). `webgl-contrast-aa` shard flipped red→green in CI. `cad.ts`: new `requireOwnedProject(store, request, reply)` chokepoint in `project-guard.ts`; all 12 handlers carry `project.id` (store-validated) past the gate — the raw `:projectId` param is only ever the lookup key. |
| `970e671` | **e2e signal greened** (see §3). 10 files, +142/−904. |

### 1b. Shipped after this doc was first written (continuation sessions)

| Commit | Content |
|---|---|
| `56aa6f4` + `32e9225` | **Phase 4 seam decision record** (`PHASE4-SEAM-DECISION-2026.md`), v2 after an in-session Pro review that caught three v1 defects (vacuous provenance inheritance; preset-tag standing vs the hinge gizmo; bare `height_m` naming). |
| `dc21a32` | **Phase 4 seam BUILD** — elevation-drawn ink becomes massing geometry: `wallSeam.ts` (geometric standing test ε=1°, closed-outline wall conversion, drawn height, boundary containment/crossing stamps), `convertStrokesToFeatures` standing-canvas branch, Tidy HUD wall preset (massing + drawn height + reconciliation chip), `assignFeaturesToPlane` bulk re-plane in one history commit + LayersPanel strip, additive `LandscapeFeature` schema fields, `canvasPose.ts` extraction (bundle ratchet: 3557→3446 kB). New `webgl-wall-seam.spec.ts` e2e through persistence. |
| `059f936` | **Stress economics split** — `pnpm test` excludes the stress suites (local gate 55s, was ~12 min); `pnpm test:stress` runs the 4 suites standalone; pre-commit `vitest related` excludes them; ci.yml `stress` job with its own 45m clock (gate 5m50→3m58 in CI, stress green 2m51). Deploy still gated on the static gate + secret scan only. |

Deploy is live and verified (web + API 200) through `dc21a32`; later commits
are config/doc-only.

### 1c. Shipped in the 2026-09-05 continuation session (threads #5 + #6 + the straightedge)

| Content |
|---|
| **§4 #5 — brush-state session persistence**: `brushPrefs.ts` (pure sanitize/read/write over `sessionStorage` key `ws-brush-prefs:<projectId>`, the house per-project UI-state convention; every field validated against the nib/material canons + setter clamps), `studioStore.hydrateBrushPrefs` applied at the hydrate effect, and a store subscription persisting nib/material/width/opacity on change — with a skip while the projectId itself flips (a mid-swap write would stamp the outgoing project's pen onto the incoming key). Restoring does NOT rewrite the palette's recent/previous memory. Tests: `brushPrefs.test.ts` + a Tier-1 describe. |
| **§4 #6a — first-move hint resurrection**: retirement is LATCHED, not re-derived — `createFirstSketchHintLatch` (pure, unit-tested in `firstSketchGuide.test.ts`) observed at the design-content gate in `WebGLStudioPreview`; once ink lands the hint can never resurrect, whatever a later HUD cycle does to the transient content gate. Note: e2e runs with `NEXT_PUBLIC_E2E=1`, where the hint never arms — the e2e assertion was vacuous all along; the unit tests carry this. |
| **§4 #6b — chip-bar overflow strategy** (three degradation tiers in `WfsChips.module.css`): the primary chip absorbs squeeze first (`min-width: 0`; the address name already ellipsises), then overlay pills compress with ellipsised labels (`flex-shrink: 1` + label ellipsis; `title` carries the full text), `overflow: hidden` is only the last-resort guard. The collision spec now also probes intra-bar overflow (`scrollWidth − clientWidth ≤ 1`) at all 3 viewports × 4 modes — pairwise collision can't see a bar clipping its own children. |
| **§4 #6c — hold-last-good address**: `setProjectContext` no longer drops the chip to "Untitled site" when a re-hydrate arrives without an address for the SAME project id; a different id (real navigation) swaps unconditionally. Tested in `studioStore.test.ts`. |
| **§5 Phase 1 — the STRAIGHTEDGE rail tool** (the Trace ruler): `straightedge.ts` (pure: project-on-segment with a 1.5%-of-board proximity band, world-metre math, clamp-to-segment; session view state, nothing sited → no reconciliation event), `StraightedgeLayer.tsx` (RULE-armed ground drag places/re-places the edge; ruler furniture render with end ticks + metre hashes + live length chip; Esc clears), RULE tile in the DRAW group (hotkey R, no flyout), `LiveNibReadout` gained the RULER channel, pen ink on the GROUND draw path projects onto the edge after the stabilizer (`FusedSketchLayer` — assist, never constrain; canvas-plane strokes keep freehand + straighten). `StudioControls` yields the gesture while RULE is armed (capture-layer contract). e2e `webgl-straightedge.spec.ts` proves wobbly raw input persists as collinear ink; unit tests in `straightedge.test.ts`. Gap-analysis matrix + §5 Phase-1 status updated. |

## 2. The cad.ts Mimosa findings — status, and what is NOT done

The pre-commit/push hook still flags **12 medium taint findings** in
`apps/api/src/routes/cad.ts` (it flagged this session's commits too). After
the `3fb81b8` refactor the findings persist — the scanner does conservative
param→return tracking through `store.getProject` (an unmodeled cross-package
function), so anything derived from the lookup reads as tainted regardless of
route code. No in-repo annotation mechanism exists (`.mimosa/` is internal
scanner state only). The refactor DID remove the real smell (raw request
param flowing past the guard into store calls, filenames, error bodies);
guard semantics are test-covered (`cad.test.ts`, `contract.test.ts`).

**Still open, and the USER's call** (the hook requires user acknowledgment of
mediums): accept the findings as reviewed false-positives, or annotate/
suppress through Mimosa tooling outside the repo. Do not "fix" further at
route level — there is nothing route-level left to fix. The hook also states
its coverage is incomplete; absence of other findings is not a security claim.

## 3. The e2e signal: what was wrong, what was done, the method

Three of six CI e2e shards had been red on EVERY push (including docs-only)
for ~a week. **They were not CI flakes** — rerun locally, every failing spec
failed locally too. All were spec-vs-product drift: anchors on surfaces
deleted by the dashboard purge (`dcf7018`: HomePlanner/RailDrawer) and the
zero-chrome purge (`58bc9f6`: resting HUD cards, inspector chips,
communication-card, PerimeterTabStrip/InstrumentCard chrome).

- **Deleted** (surface gone, laws live elsewhere): `rail-drawer-hover.spec.ts`,
  `webgl-communication-modes.spec.ts`, `webgl-terrain-instruments.spec.ts`.
- **Rewritten**: `project-surface-reachability.spec.ts` (now pins: `/home` is
  a REDIRECT to the newest project; the **command palette is the ONLY inbound
  door to records + growth-studio**; the records rail is `aria-label="Project
  records navigation"` with `aria-current`), `webgl-gizmo-move.spec.ts` (gizmo
  auto-arms scene-side; the inspector chips are gone), `webgl-split-view.spec.ts`
  (split entry is the palette's "Split plan | 3D").
- **Fixed in place**: `chrome-contract` (pin `?mode=survey` — fresh projects
  suggest SKETCH where the depth rail legitimately returns null; drop the
  removed `coord-chip`), `chrome-recede` (assert opacity AGAINST the
  `--ws-op-recede` token, which was tuned 0.55→0.28 after the spec froze a
  literal), `preview-smoke` (assert ribbon + camera-dock, not the purged
  resting glass cards), `sketch-assist` (CI budget 600s via `process.env.CI`).

**The method (use it again):** never assume a red CI shard is a CI fault —
reproduce locally first. Classification is by anchor existence: grep the
testid/label in `apps/web/src`; if it exists nowhere, the spec is stale
(delete or rewrite against the current IA); if it exists, it's a real bug.

**Known gap left deliberately:** `docs/OPERATOR-UX-WORKFLOW-2026-08-23.md`
still tables the three deleted specs (§186, §229-232, §337-340). It's a
historical workflow doc; updating it is doc hygiene, not a gate.

## 4. Open threads (ranked)

1. **CI-verify `970e671`** — DONE 2026-09-05: all 6 e2e shards green on
   `a8ff1e7` (run `33906514141`). The signal is trustworthy.
2. **Stress-test economics** — DONE 2026-09-05 (`059f936`): `pnpm test`
   excludes the stress suites (55s locally, was ~12 min); `pnpm test:stress`
   runs the 4 suites standalone; pre-commit `vitest related` excludes them;
   ci.yml has the dedicated `stress` job (own 45m clock, gate 5m50→3m58 in
   CI). Deploy remains gated on the static gate + secret scan only.
3. **Phase 4 seam** — DONE 2026-09-05 (`32e9225` decision record v2 +
   `dc21a32` build): standing-canvas wall → massing with drawn height,
   operator provenance, boundary containment/crossing stamps; bulk re-plane
   in one history commit. Remaining Phase 4 items per the roadmap: assist on
   tilted planes stating true plane measurements, model import as underlay,
   cinematic flythrough authoring, AR bridge.
4. **cad.ts Mimosa findings** — user decision (see §2).
5. **Tier-1 leftover (small):** DONE 2026-09-05 continuation — session
   persistence of last nib/colour/width (and opacity) per project via
   `brushPrefs.ts` (see §1c).
6. **Cosmetic, repro known:** DONE 2026-09-05 continuation (see §1c) —
   first-move hint retirement is latched; chip bar degrades by squeeze with
   a collision-gate overflow probe; the chip holds last-good address on
   same-project re-hydrates.
6. **Orphaned dev servers** recur on this Windows box (ports 3001/3002,
   `netstat -ano | findstr LISTEN`). Playwright reuses a half-dead one and
   produces a Next.js "Runtime Error" dev-overlay page that looks like a
   product crash — kill orphans before e2e batches.
7. **Local dev API latency (new, observed 2026-09-05):** the dev API's
   design-canvas GET/PUT can take **5–16 s** to complete on this box (first
   hit compiles the route; sqlite write latency unknown). e2e specs that
   read back persisted geometry must poll (`expect.poll`, 60 s) instead of
   fixed waits — `webgl-straightedge.spec.ts` does. Worth a proper look if
   it worsens.

## 5. Outstanding — the Trace-fluency feature backlog

The Morpholio-Trace parity work (`MORPHOLIO-TRACE-3D-GAP-ANALYSIS-2026.md`
56-feature matrix; phased in `MENTAL-CANVAS-ROADMAP.md` §5). Itemized status
after the Phase 4 seam landed — this section is the feature backlog a fresh
session picks from. **2D leftovers first (cheapest felt value), then the
trace-stack, then scale-true.**

### Phase 1 leftovers — 2D fluency (highest value per line of code)
- ✅ **Straightedge rail tool** — DONE 2026-09-05 continuation (see §1c):
  RULE places an edge, pen ink within the proximity band projects onto it,
  live length rides the RULER readout channel.
- ❌ **Hold-to-extend** with typed length.
- ❌ Super Ruler / Triangle / Protractor (the ruler VERB is shipped; the
  instrument set is not).
- 🟡 Gesture/touch parity (2-finger undo, hold-to-erase) — the field persona.

### Phase 2 — the trace-stack, vector-native (iteration feel)
- ❌ **Per-plane ink opacity** (the "peel the trace" dial; note the shipped OP
  dial is per-BRUSH, not per-plane).
- ❌ **Duplicate plane** verb (PLT-alt / MAS-alt alternatives as siblings).
- ❌ Flood-fill hatch into closed ink regions.

### Phase 3 — scale-true drawing
- ❌ Scale-true stroke widths (px → 1:N print truth; extends the true-scale
  capture work).
- ❌ Straight-line dimension assist (near-axis stroke snaps the dim string).
- ✅ DXF export — DONE (the gap analysis's ❌ is stale; `cadDocumentToDxf` +
  `/cad.dxf` exist).

### Phase 4 remainder — the seams (the goal surface)
- ✅ Standing-canvas wall → massing with drawn height + reconciliation; bulk
  plane assignment (this session).
- ❌ Assist on tilted/hinged planes stating TRUE plane measurements (today
  only standing planes convert; tilted keep plan routing).
- ❌ Model import as underlay (USDZ/OBJ/glTF, boundary-snapped).
- ❌ Cinematic flythrough authoring + guided present (walk exists).
- ❌ AR SketchWalk bridge (mobile); LiDAR scan-to-sketch.

### Phase 1b — polish locks (meta; do before more polish)
- ❌ Visual-regression screenshot gate (~10 canonical views × 3 viewports).
- ❌ Interaction-latency budgets, ratcheted (time-to-first-stroke, flyout
  open, camera settle).
- 🟡 Stale-spec guard — the manual greening is done (§3); no automated
  dead-locator sweep yet.
- 🟡 Micro-interaction audit (cursor per tool, empty-state voice); ❌ one
  real tablet week (pressure/palm-rejection on device — cannot be automated).

## 6. Key files map (fresh-session shortcuts)

- Tier-1 widgets: `apps/web/src/components/canvas/webgl/{BrushWidget,PaletteWidget,useFlyoutAnchor,materialContrast}.tsx`
  (+ tests: `PaletteWidget.test.tsx`, `studioStoreTier1.test.ts`,
  `materialContrast.test.ts`)
- Brush-state persistence: `apps/web/src/components/canvas/webgl/brushPrefs.ts`
  (+ `studioStore.hydrateBrushPrefs` + the persist subscription at the foot
  of `studioStore.ts`)
- Straightedge: `apps/web/src/components/canvas/webgl/straightedge.ts` +
  `StraightedgeLayer.tsx`
  (+ `straightedge.test.ts`, e2e `webgl-straightedge.spec.ts`); projection
  hook in `FusedSketchLayer.tsx` ground path; gesture yield in
  `StudioControls.tsx`
- Store additions: `studioStore.ts` — `brushOpacity`, `recentMaterialIds`,
  `previousMaterialId`, `paletteOpen`, `smoothingTouched`,
  `swapActiveMaterial`, per-nib `defaultSmoothing` in `nibs.ts`
- Nib opacity resolution: `nibs.ts` `armedNibSpec`/`nibSpecForStroke`;
  commit stamp in `FusedSketchLayer.tsx` (~line 490)
- Contrast gate spec: `e2e/webgl-contrast-aa.spec.ts`; new text tint token
  `--ws-dwg-redline-ink` in `apps/web/src/styles/tokens.css`
- API guard: `apps/api/src/lib/project-guard.ts` (`requireOwnedProject`),
  consumers pattern in `apps/api/src/routes/cad.ts`
- Vision evidence: `apps/web/test-results/tier1-*.png` (9 shots, 3 states ×
  3 viewports)
- Design law: `docs/GOLD-STANDARD-2026.md` + `tokens.css` (supreme)
