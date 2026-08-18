# Docs audit report

Binding-docs audit against current code. Scope: (1) shared state / state hooks, (2) selection behavior, (3) title-boundary reconciliation. Docs-only; no code changes.

## Findings table

| Doc | Claim / line | Verdict | Change |
|-----|--------------|---------|--------|
| GOLD-STANDARD-2026-ARCHITECTURE.md | §5: `seasonalStore.ts` is a backward-compat alias for the same store instance | verified | none |
| GOLD-STANDARD-2026-ARCHITECTURE.md | §5: `stateBridge.ts` maps `StudioItem → RenderItem` (structural pick, no value math, `pctToWorld` does %→metre) | verified | none |
| GOLD-STANDARD-2026-ARCHITECTURE.md | §5: `useStudioAutosave.ts` → `saveDesignCanvasClient` | verified | none |
| GOLD-STANDARD-2026-ARCHITECTURE.md | §5: WebGL store holds fused camera rig, `sketchStrokes`, placements, photo-trace session, save-status machine | verified | none |
| GOLD-STANDARD-2026-ARCHITECTURE.md | §5: classic autosave path `handoff/state/canvasBridge.ts` ↔ API autosave | verified (canvasBridge.ts bridges StudioItem/SketchStroke ↔ contract, feeds the classic autosave) | none |
| ONBOARDING.md | §1: `seasonalStore.ts` is a compat alias; two stores separate, meet only at persisted DesignCanvas | verified | none |
| ONBOARDING.md / AGENTS.md | selection: click selects, shift-click multi-selects, Esc clears, survives mode switches | verified (WebGLStudioPreview.tsx `handleGroundClick` + Esc `clearSelection`; refs live in zustand store) | none |
| selectionPick.ts | ONE selection state across placements / features / photo-trace strokes | verified (`SelectionRef.kind` = placement\|feature\|photoStroke; `studioStore.selection: SelectionRef[]`) | none |
| ARCHITECTURE.md §5 / ONBOARDING.md §4 | `DesignSiteFrame.boundary` is a board-% ring | verified (contracts `catalog.ts` `DesignSiteFrameSchema.boundary` = `DesignSiteFramePointSchema[]`, `{x_pct,y_pct}`) | none |
| ARCHITECTURE.md / context | `constrainAssetCentre` lives in `handoff/geometry/outdoorClamp.ts` | verified (export at outdoorClamp.ts:249) | none |
| ARCHITECTURE.md / context | WebGL sketch-to-CAD path (`webgl/sketchCad.ts`) runs `constrainAssetCentre` | verified (sketchCad.ts:95 in `proposeSketchCad`) | none |
| ONBOARDING.md §3/§4 / context | photo-trace plane snaps onto title boundary at pin time (`photoTraceMath.ts` `snapPhotoPlaneToBoundary`, `boundary_snap` field) | verified (photoTraceMath.ts:79; contracts `PhotoElevationSchema.boundary_snap` `{edge_index, snapped_at}` nullable) | none |
| ARCHITECTURE.md §5 / ONBOARDING.md §5 | converted features inherit already-sited ink geometry → no new reconciliation event (future converters that invent positions must reconcile) | verified (sketchCad `convertStrokesToFeatures`/proposals re-use ink positions; no invented coords) | none |

## Stage 1 conclusion

`docs/GOLD-STANDARD-2026-ARCHITECTURE.md` §5 correction and `ONBOARDING.md` — all in-scope state / selection / boundary-reconciliation claims verified accurate against code. No stale claims found; no edits and no stage-1 commit required.

## Stage 2 sweep

| Doc | In-category claims | Verdict | Change |
|-----|--------------------|---------|--------|
| `docs/GOLD-STANDARD-2026.md` | none — no hits for any state/selection/boundary term | verified clean (grep) | none |
| `docs/GOLD-STANDARD-2026-TOKENS.md` | none — only "boundary" hit (line 197) is a token contrast-ratio line, not title boundary | verified clean (grep) | none |
| `docs/CAMERA-STATE-MACHINE.md` | boundary reconciliation (lines 98–103) matches `snapPhotoPlaneToBoundary` + `boundary_snap`; `studioStore.ts` → `setPitchDeg`/`elevationActive` (line 128) match code | verified clean | none |
| `docs/UI-PARITY-AUDIT-2026.md` | line 28 `RenderItem.leafRetention` via `stateBridge.ts` matches code; lines 70–77 are terrain-drape "shared elevation sampler" (rendering, not cross-studio state); line 173 is React Suspense | verified clean | none |
| `docs/STUDIO-PRODUCT-PHASES.md` | no in-category claims — "boundary" = Workflow 1 vs Stage 2 phase boundary (line 9) and retired `CadDocument` site-boundary stamp (line 52) | verified clean | none |

Docs-wide grep classification:

- `shared state` / `single store` / `state hook` / `zustand` / `reducer` — in-scope hits only in `GOLD-STANDARD-2026-ARCHITECTURE.md` (verified). `CAD-TILT-2026-UX.md:97` "one shared state, two views" is the classic SVG studio's internal tilt-lens state, not a cross-studio hook claim (left unchanged per instructions).
- `selectedIds` — only in `docs/agent-prompts/` working artifacts; no binding doc uses it. No fix.
- `strike_alert` — `GOLD-STANDARD-2026-ARCHITECTURE.md` §2.1 schema listing matches `packages/contracts/src/schemas/orchestration.ts` (`site_origin_locked`, `maturity_index`, `strike_alert`). Verified.
- `seasonalStore` / `stateBridge` / `useStudioState` / `studioStore` — all in-scope hits already covered in the table above.
- Archive hits (`docs/archive/pre-gold-standard-2026/`) and `docs/agent-prompts/` were skipped per instructions (not cross-referenced wrongly by the five stage-2 docs).

## Final report

**Overall verdict:** no stale or wrong in-category claims found. Every state / selection / title-boundary-reconciliation claim in the priority docs and the stage-2 sweep verified accurate against code, or is out of scope (classic-SVG internal state, React Suspense, token contrast, phase boundary). No edits made, so **no commits** — nothing to commit.

**Commits:** none (no doc files edited). Working tree left untouched.

**Stray-path confirmation:** no files staged; `git add`/`git commit` were never run. The pre-existing modifications (`.devin/mcp_config.json`, `apps/web/next-env.d.ts`) and untracked `docs/agent-prompts/` remain exactly as found.

**Code-vs-AGENTS.md contradictions:** none found. `AGENTS.md` statements about the two-store split, `seasonalStore` alias, `stateBridge` mapping, `useStudioAutosave → saveDesignCanvasClient`, WebGL-native selection, boundary reconciliation (`DesignSiteFrame.boundary`, `constrainAssetCentre`, `sketchCad.ts`, `snapPhotoPlaneToBoundary`, `boundary_snap`), and converted-feature inheritance of sited ink geometry all match code. The only stale "state layer unchanged" reference is a code comment (`stateBridge.ts:11`), already flagged in `ONBOARDING.md` §7 — out of scope for a docs-only pass.

## Notes

- Ground truth: `AGENTS.md` + code. If code contradicts `AGENTS.md`, flagged here (not rewritten).
- Working tree: pre-existing changes to `.devin/mcp_config.json` and `apps/web/next-env.d.ts` are not mine; `docs/agent-prompts/` is untracked working artifacts and must not be committed.
