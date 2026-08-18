# Docs-vs-code audit — state, selection, boundary reconciliation

Standalone task for a fresh agent context. You do not share any prior
conversation; everything you need is below.

## Mission

Audit the Workstream monorepo's binding docs for claims about (1) shared
state / state hooks, (2) selection behavior, and (3) title-boundary
reconciliation. Verify every such claim against the current code, and fix
stale or wrong claims with minimal factual edits. Docs must describe the
code as it is — future agents will trust them as source of truth. This is a
docs-only task: do not change code, do not add new architecture opinions,
do not run builds or tests.

Workspace: `C:\Users\Tim\Downloads\CURTIS-CO\workstream`. Use the read /
grep / glob tools; never PowerShell text round-trips (UTF-8 corruption
risk — see AGENTS.md). Fix with the edit tool only. Sentence case, no
emojis. If a claim cannot be verified, flag it in the report; do not guess.

## Context to verify (do not trust until checked against code)

The Gold Standard 2026 WebGL studio is the primary canvas. Two studios
exist and must never be described as sharing a state hook:

- Classic SVG studio (`HandoffDesignStudio`, `?svg=1` fallback): reducer
  hook at `apps/web/src/components/canvas/handoff/state/useStudioState.ts`.
- WebGL studio (default): zustand store at
  `apps/web/src/components/canvas/webgl/studioStore.ts`, with picking in
  `apps/web/src/components/canvas/webgl/selectionPick.ts`.

They share only the persisted `DesignCanvas` document
(`packages/contracts`). No runtime state bridge, no cross-studio selection
sync. Selection is WebGL-native: click selects, shift-click multi-selects,
Esc clears, and selection survives mode switches.

Expected boundary facts: `DesignSiteFrame.boundary` is the board-% title
ring; `constrainAssetCentre` lives in
`apps/web/src/components/canvas/handoff/geometry/outdoorClamp.ts`; the
WebGL sketch-to-CAD path (`apps/web/src/components/canvas/webgl/sketchCad.ts`)
runs it; photo-trace planes snap onto the title boundary at pin time
(`photoTraceMath.ts`, `snapPhotoPlaneToBoundary`, `boundary_snap` field);
converted features inherit already-sited ink geometry so they raise no new
reconciliation event; any future converter that invents positions (e.g.
facade-to-plan projection) must reconcile.

## Targets, in priority order

1. `docs/GOLD-STANDARD-2026-ARCHITECTURE.md` — a previous session flagged a
   stale "shared state hook" claim here. The doc now carries a "Corrected
   2026-08-18" note (summary at lines 8-14, §5 at lines ~209-234). Verify
   the correction itself is accurate against code, e.g.: does
   `seasonalStore.ts` really alias `studioStore`? Does `stateBridge.ts` map
   `StudioItem` to `RenderItem` as stated? Does `useStudioAutosave.ts`
   call `saveDesignCanvasClient`? Also sweep every other section of this
   doc for state, selection, and boundary claims.
2. `ONBOARDING.md` — the consolidated current-state doc; check its
   studio-split, selection, sketch-to-CAD, and reconciliation statements.
3. `docs/GOLD-STANDARD-2026.md` and `docs/GOLD-STANDARD-2026-TOKENS.md` —
   same sweep.
4. `docs/CAMERA-STATE-MACHINE.md`, `docs/UI-PARITY-AUDIT-2026.md`,
   `docs/STUDIO-PRODUCT-PHASES.md` — same sweep.
5. Grep all of `docs/` for: `shared state`, `single store`, `state hook`,
   `useStudioState`, `studioStore`, `selection`, `selectedIds`,
   `boundary`, `reconcile`, `constrainAssetCentre`, `strike_alert`. For
   each hit, decide whether the claim concerns the two-studio state split,
   selection, or boundary reconciliation; if so, verify it. Claims about
   the classic SVG studio's own internal use of `useStudioState` are
   accurate and must not be "fixed". The stale pattern to kill is any
   claim that the WebGL studio consumes `useStudioState` or shares runtime
   state/selection with the SVG studio. Skip `docs/agent-prompts/`
   (working artifacts) and `docs/archive/` (explicitly pre-Gold-Standard;
   flag only if actively cross-referenced wrongly). Treat `AGENTS.md` and
   the code as ground truth; if code contradicts `AGENTS.md`, flag it in
   the report — do not rewrite the rule.

## Report and commit

Return a final message containing:

- A table: doc | claim (line) | verdict (verified / fixed / flagged) | what
  changed.
- The exact list of edits (file + abbreviated old to new).
- A local git commit on the current branch with message
  `docs: fix stale state/selection/reconciliation claims` (Conventional
  Commits style; match the repo log). Commit only; do not push, do not run
  builds/tests. If git fails for environmental reasons (identity, hooks),
  report the failure instead of forcing it. If nothing needed fixing, say
  so and skip the commit.
- Any code-vs-AGENTS.md contradictions found (flag, do not fix).

Also save this report to `docs/agent-prompts/docs-audit-report.md`.
