# AEC-2026 Rollout Plan (2026-08-25)

> **Status:** the binding sequencing plan for the adopted scope of
> [`AEC-2026-RESEARCH-ADOPTION.md`](./AEC-2026-RESEARCH-ADOPTION.md)
> (ResCode A2-6 canopy compliance, motion-aware chrome recede, ARIA graphics
> tree). Subordinate to the Gold Standard docs. Work items tick off in
> [`OUTSTANDING.md`](../OUTSTANDING.md); current state in
> [`ONBOARDING.md`](../ONBOARDING.md).

---

## 0. Ground rules (apply to every wave)

- **Single branch:** all waves land on `main`; no parallel feature branches
  (AGENTS.md single-branch law).
- **Gate per wave (mandatory, no exceptions):** `pnpm typecheck` green →
  touched/new unit tests green (`pnpm --filter @workstream/domain build`
  first if domain changed) → the wave's kept e2e **executed** green (small
  batches or `RATE_LIMIT_MAX=10000`, per AGENTS.md) → conventional commit
  when the user says ship.
- **Tokens:** chrome uses `--la-*`/`--gs-*` tokens by name; no raw hex; no
  reintroduction of resting frost/blur, blue chrome accents, or dark mode.
- **Legal honesty:** A2-6 output stamps the standard's identity
  (A2-6 / 54.02-6, VC298); thresholds live in ONE named constant; never a
  VicSmart/permit claim. Canopy-over-boundary is advisory only.
- **Boundary law:** compliance reads the title boundary; it never places
  geometry, so it raises no new boundary-reconciliation event.

## 1. Wave map

| Wave | Scope | Depends on | Risk | Surface |
|---|---|---|---|---|
| 0 | Unblock + baseline | — | none | docs, e2e baseline |
| 1 | Domain A2-6 kernel | 0 | low | `packages/domain` only |
| 2 | Compliance surfacing (2a survey → 2b sketch/cad → 2c quote) | 1 | medium | webgl chrome, 3 modes |
| 3 | Motion chrome recede | 0 (parallel-safe with 1–2) | medium (perf) | GlassCard, camera rig, CSS |
| 4 | ARIA graphics tree | 2 (so compliance surfaces get roles too) | low | studio root + entity layers |
| 5 | Close-out: docs sync + full `pnpm run ci` | 1–4 | none | docs, CI |

Waves 1 and 3 are independent and may interleave; 2 must follow 1; 4 lands
last among features so every new surface (compliance chips/rows) ships with
its ARIA roles in the same commit rather than retrofitted.

---

## Wave 0 — Unblock + baseline (immediate)

1. **Apply the staged `VISION-POLISH-BRIEF.md` palette edit** — blocked by a
   Word file lock at authoring time; content is prepared (LA tokens
   sanctioned, charcoal accent, no blue/frost reintroduction). Retry until
   applied.
2. **Baseline run:** `pnpm typecheck` + `pnpm test` green on `main` before
   any feature code, so a later red is attributable to the wave.
3. Leave untouched: `MASTER PROMPT.txt`, `gui-test-screenshots/`,
   `apps/web/apps/`, `apps/web/e2e/zprobe-prod.spec.ts`,
   `apps/web/scripts/capture-studio.mjs` (another agent's probe artifacts).

**Done when:** brief edit applied, baseline green, no probe files touched.

## Wave 1 — Domain: A2-6 canopy kernel (`packages/domain`)

New module `packages/domain/src/rescode-canopy.ts` (+ `rescode-canopy.test.ts`):

- `RESCODE_A2_6` constant block: `TREES_PER_100M2 = 1`, `MIN_HEIGHT_M = 6`,
  `MIN_CANOPY_WIDTH_M = 4`, effective date, standard identity string, source
  URLs (from the adoption doc §1) — the single threshold home.
- `requiredCanopyTrees(siteAreaM2)` — per the verified formula, with the
  rounding rule documented as unverified-verbatim and safe-direction (round
  the requirement UP so the check never under-warns).
- `isMatureCanopyTree({ heightM, canopyWidthM })` — the ≥6 m / ≥4 m gate.
- `assessCanopyCompliance({ siteAreaM2, trees })` → discriminated result:
  `{ status: 'compliant' | 'shortfall' | 'insufficient-data', required,
  provided, matureProvided, immature: [...], shortfall, standard:
  RESCODE_A2_6 }`. Empty/unknown site area ⇒ `insufficient-data` (never a
  silent pass).
- Export from the domain barrel; **run `pnpm --filter @workstream/domain
  build`** before api specs (build-order gotcha, AGENTS.md).

**Acceptance:** unit tests cover 0 trees, mixed mature/immature, boundary lot
sizes (e.g. 250 / 300 / 450 m²), insufficient-data; api specs still green
against the rebuilt `dist`.

## Wave 2 — Compliance surfacing, stage-threaded (webgl)

Three increments, each its own commit + e2e:

**2a — Survey baseline.** Once the title hydrate gives site area, the survey
HUD (MetaChipSet family) shows the **required** canopy-tree count for the
lot: "A2-6 requires N canopy trees for this site (≥6 m / ≥4 m at maturity)".
No design needed; the lot's obligation is visible from day one.
*e2e: `webgl-survey-setup` extension asserting the chip after title hydrate.*

**2b — Sketch/CAD live assessment.** Live count of placed trees (placements
with tree SKUs + canopy features) vs required, per-tree maturity gate
(immature trees listed by label), advisory canopy-over-boundary note (reads
`outdoorClamp`'s law — advisory, never clamps). Surface: a compliance tab /
chip in the right-panel chrome (`RightPanelTabs` / `MetaChipSet`), present in
sketch + cad modes.
*e2e: place mature + immature trees, assert provided/required + immature
callout; assert advisory (not blocking) overhang copy.*

**2c — Quote fit-sheet summary.** One row on `FitSheetCard` (LA ink tokens):
status, provided vs required, standard identity stamped — carried into the
signoff context. No permit/VicSmart language.
*e2e: quote mode with a known tree set → row reads compliant/shortfall.*

**Done when:** all three increments green and the tree count is live from
survey through quote.

## Wave 3 — Motion-aware chrome recede (webgl + css)

- Camera-motion detector: `useFrame` in a small dedicated component
  comparing the camera matrix vs the previous frame with an epsilon +
  rest-decay (~150 ms) — publishes a `chromeReceded` boolean to the studio
  store (throttled; store write only on state flip — no per-frame React
  renders).
- GlassCard cards + HUD chrome recede via a container class (hook:
  `[data-gs-glass-card]` + chrome roots) — `opacity ~0.55` while receded,
  full opaque paper at rest, CSS transition (~180 ms). **Opacity only:** no
  backdrop-filter animation, no refraction, no dark.
- Hold-key peek: an unbound key (chosen after auditing the shortcuts map —
  candidate `H`) fades chrome fully while held; listed in the `?` sheet.
- Contrast: full contrast at rest is the only gated state; the transient
  receded state is non-interactive reading (pointer-events unchanged).

**Acceptance:** unit test for the motion-flip store logic; e2e asserting
recede during orbit + restore at rest + peek key (can extend
`webgl-studio-shortcuts`); `webgl-chrome-collision` + `contrast-aa` still
green; no fps regression in the coverage spec.

## Wave 4 — ARIA graphics tree (studio-wide)

- Studio root container: `role="graphics-document"` + `aria-label` (project
  + mode aware).
- Parallel accessible tree (sr-only region): placements and features as
  `graphics-symbol`/`graphics-object` with meaningful labels
  (species/SKU/size for trees; feature type for masses), selection state via
  the store's existing selection semantics.
- Wave-2 surfaces (compliance chip/tab/row) ship their roles in the same
  commit: labelled status regions, no bare text nodes.
- Keyboard: audit for traps only (Tab/Esc/`?` already handled); no new
  roving-tabindex machinery in this wave.

**Acceptance:** e2e asserting the tree renders for a seeded project (roles +
labels for N placements/features); studio chrome axe-style pass stays clean;
no layout shift (sr-only).

## Wave 5 — Close-out

- Tick the three adopted items in `OUTSTANDING.md`; update `ONBOARDING.md`
  §6 + the amendment logs if any law moved.
- Full `pnpm run ci` locally (the integration gate) — bundle budget (Wave 3
  CSS + Wave 4 DOM must stay tiny), feature reachability (new components
  must be imported — no allowlist additions unless justified), CSS scales
  (the opacity transition must not grow the ratchet count — token or
  custom-property it).
- Commit per wave (conventional); push + prod verify when the user says ship
  (Railway auto-deploys from `main`).

## Rollback

Each wave is one commit: `git revert <sha>` restores the prior state; no
schema/migration changes anywhere in the rollout (pure reads of existing
store data — placements, features, site frame). The only shared-state
addition is the `chromeReceded` store flag (Wave 3), inert when false.

## Out of scope (rejected — do not build) / deferred horizon

- **Rejected:** dark mode, Liquid-Glass refraction, WebGPU-first, OCCT/WASM,
  Autodesk Forma, RLRF/voice-gaze (adoption doc §5).
- **Deferred (revisit triggers):** DEM raster upgrade (trigger: Vicmap
  Elevation licensing/format confirmed), Bento inspector (trigger: next IA
  pass), next-stage asset pre-load (trigger: perf budget headroom), raster
  survey vectorization (trigger: raster import becomes a feature).
