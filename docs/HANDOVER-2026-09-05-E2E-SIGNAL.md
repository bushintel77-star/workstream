# HANDOVER — Tier-1 widgets shipped + e2e signal greened (2026-09-05)

For a fresh context window. Everything below is verified against git and the
live tree as of commit `970e671` (pushed to `origin/main`, CI run
`33905876662` in flight at handover time). Prior context:
[`HANDOVER-2026-09-04-STUDIO-TIER1.md`](HANDOVER-2026-09-04-STUDIO-TIER1.md)
(the Tier-1 design brief this session executed) and [`AGENTS.md`](AGENTS.md).

**First action for a fresh session: check the CI run that `970e671` triggered
— `gh run list --repo bushintel77-star/workstream --limit 2`.** Expected:
gate + secret-scan + deploy green as always; the e2e shards that were red on
every push for a week (2/4/6) should now be green — that is the claim of the
last commit and it had NOT been CI-verified when this doc was written. If a
shard is still red, pull its log (`gh api repos/.../actions/jobs/<id>/logs`
and grep `✘`) and triage locally before assuming CI fault — see §3, the
method matters.

---

## 1. Shipped this session (all pushed; gates green at commit time)

| Commit | Content |
|---|---|
| `f61b7b9` | **Tier-1 widget standard** (the prior handover's §2, executed in its §2.5 order): `BrushWidget.tsx` (nibs + W + new **OP opacity dial** + SM + ERASE hold-to-latch + Falloff as collapsed disclosure), `PaletteWidget.tsx` (21-material canon + **RECENT row** + active well with **previous-swap** + **WCAG contrast readout**), `useFlyoutAnchor.ts` (live tile-geometry anchoring: ResizeObserver + window listeners, bloom side from the ribbon's MEASURED edge, vertical clamp honours the bottom chrome stack), colour-well ribbon tile, tiered columns when both panels open (`FLYOUT_COLUMN_STEP_PX`), keyboard B/E/[/]/X + slider arrow-duality (shift ×10), per-nib smoothing defaults, `CanvasStroke.opacity` contract field, `materialContrast.ts` pure OKLCH→WCAG math. Collision gate now measures brush-open + both-open states (20 states × 3 viewports, all clean). `MaterialPalette.tsx` retired. |
| `3fb81b8` | **Contrast-AA cleared + cad.ts refactor.** AI RUN's hardcoded unavailable state was grey-on-gold (1.2:1) → now a hollow key (gold text/border on panel, ~7:1); SRV cell used raw `--ws-dwg-redline` as text (4.47:1) → new `--ws-dwg-redline-ink` tint in tokens.css (6.8:1, mirrors the `truth`/`truth-ink` pattern). `webgl-contrast-aa` shard flipped red→green in CI. `cad.ts`: new `requireOwnedProject(store, request, reply)` chokepoint in `project-guard.ts`; all 12 handlers carry `project.id` (store-validated) past the gate — the raw `:projectId` param is only ever the lookup key. |
| `970e671` | **e2e signal greened** (see §3). 10 files, +142/−904. |

Deploy is live and verified (web + API 200) through `3fb81b8`; `970e671`
deploys are doc/test-only.

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

1. **CI-verify `970e671`** (see header) — if shards 2/4/6 are green, the e2e
   signal is trustworthy for the first time in a week. If anything is red,
   triage per §3's method.
2. **Stress-test economics** (carried from the prior handover, still the top
   structural item): 600s budgets are a splint; the right fix is a dedicated
   slow-stress CI job + excluding stress files from the pre-commit
   `vitest related` path. The sketch-assist CI-budget fix in `970e671` is the
   same disease, treated locally.
3. **cad.ts Mimosa findings** — user decision (see §2).
4. **Tier-1 leftover (small):** session persistence of last nib/colour/width
   per project (recents/swap/per-nib smoothing defaults shipped; the
   persistence layer didn't).
5. **Cosmetic, repro known:** first-move hint can resurrect after a second
   stroke's HUD cycle (`guideFirstSketch` retires correctly on first ink;
   resurrection path unwired); chip-bar middle pill truncates ~1280px
   (`WfsChips.module.css` needs an overflow strategy); transient "Untitled
   site" during slow refetches (hold last-good address).
6. **Orphaned dev servers** recur on this Windows box (ports 3001/3002,
   `netstat -ano | findstr LISTEN`). Playwright reuses a half-dead one and
   produces a Next.js "Runtime Error" dev-overlay page that looks like a
   product crash — kill orphans before e2e batches.

## 5. Key files map (fresh-session shortcuts)

- Tier-1 widgets: `apps/web/src/components/canvas/webgl/{BrushWidget,PaletteWidget,useFlyoutAnchor,materialContrast}.tsx`
  (+ tests: `PaletteWidget.test.tsx`, `studioStoreTier1.test.ts`,
  `materialContrast.test.ts`)
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
