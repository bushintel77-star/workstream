# Handover — pen/pan fix shipped, three-item build in flight

Date: 2026-07-23. Branch: `main`. All work below is **uncommitted** (user has
not said ship). Local dev servers were restarted this session (API with
`AUTH_REQUIRED=false NODE_ENV=test RATE_LIMIT_MAX=10000`, web dev on :3002).
Seeded local test project: `c14d704b-5dfc-451c-9f6d-e8fdc23b37a4`
(12 Wrights Terrace, Prahran).

## A. Done + gated this session (uncommitted)

### 1. "Default pointer is a pen — you can't grab with a pen" (DONE)

Ground state on the sketch board is now Pan/grab; the pen only inks while
armed. Follows `docs/INTERACTION-LOGIC.md` (tool owns the click).

- `apps/web/src/components/canvas/handoff/state/useStudioState.ts` — `setMode`
  sketch now enters on `tool: "pan"` (was `"sketch"`).
- `…/geometry/canvasPan.ts` — `isPanGesture` gained `panToolArmed` (plain
  left-drag grabs when Pan tool armed on a marquee-less surface).
- `…/HandoffDesignStudio.tsx` — `panToolGrabRef` (sketch + pan tool) feeds the
  capture-phase pan listener; skips chrome targets
  (`button, input, select, textarea, [data-camera-chrome]`); `SketchBoard`
  gets `active={ui.tool === "sketch"}` + `onActivate` → `setTool("sketch")`.
- `…/features/sketch/SketchBoard.tsx` — new `active`/`onActivate` props;
  `data-active` attr; pen/eraser/tip chips re-arm; armed styling gated on
  `active`.
- `…/features/pointer/resolveStudioCursor.ts` — pen cursor only when
  `tool === "sketch"` (removed the `mode === "sketch"` catch-all); Pan shows
  grab everywhere.
- Tests: `canvasPan.test.ts`, `resolveStudioCursor.test.ts` updated;
  **kept e2e** added in `apps/web/e2e/sketch-surfaces.spec.ts`
  ("sketch enters on Pan — drag grabs, Pen chip re-arms ink").
- Gates run green: web typecheck, 11/11 unit, 4/4 e2e (sketch-surfaces +
  canvas-chrome-detector).

### 2. Sketch→CAD formalize fix (DONE, part 1 of the three-item ask)

Root cause found: `POST /projects/:id/design/sketch-cad` filters suggestions
against catalog symbol ids, but the domain stroke classifier emits the
abstract studio vocabulary (`hedge`, `deck`, `lawn`, `canopy`, `frenchdrain`,
…) → heuristic formalize returned **empty** ("No convertible strokes") even
though the client maps those ids fine via `mapSymbolToStudioType`.

- `packages/domain/src/sketch-to-cad.ts` — exported `SKETCH_CAD_SYMBOL_IDS`
  (the classifier's full vocabulary).
- `apps/api/src/lib/claude.ts` — `sketchAllowedIds()` unions catalog ids with
  that vocabulary; applied to the heuristic filter, the vision allow-filter,
  and the vision prompt's allowed list.
- Tests green: `packages/domain/src/sketch-to-cad.test.ts` (vocabulary lock,
  5 tests) + new `apps/api/src/lib/claude-sketch.test.ts` (no-key heuristic
  returns non-empty with realistic catalog ids).
- **Local API server must be restarted** to pick this up before a live probe.
- Feasibility verdict for the user: full freehand→vector line tracing is the
  wrong goal; strokes→catalog-symbol **ghosts for review** (what's built) is
  right. Vision upgrade needs `ANTHROPIC_API_KEY`. Vision quality is a later
  tuning question; the vocabulary fix unblocks the offline path.

## B. Done — Vicmap easement auto-install (Workflow 1)

**Shipped:** DELWP WFS `open-data-platform:easement` → `fetchEasementPolylines`
→ `autoTraceSiteBoundary` returns `easements[]` in canvas metres → client
`easementRingsToPct` (shared boundary fit + 1.8 m corridor buffer) installs
into `snap.easements` when the operator has not traced any. Quiet hydrate +
title-boundary / spatial-correction call sites. Hatch + honesty footer on CAD.
Utilities (sewer/electrical) stay **manual + DBYD honesty** — not on public WFS.

**Still out of scope:** live DBYD APIs; Stage 2 survey-grade easement CAD.

## C. Done — sun-cast UI (Workflow 1)

**Shipped:** `ui.shadeOn` → `resolveBoardSunCast` → `CadPlanBoard.sunCast` →
`SunShadowProvider` / dwelling translate. Domain az **0° = north**
(`sunPositionAt` / `boardShadowCast`). `SunGrowthDock` portals via
`CameraChrome` (`sun-shade-controls`). Shade grid shares the same `when`.
E2e: `premium-sun-client.spec.ts`.

**Unused / do not mix:** `apps/web/src/lib/sun-shadow.ts` (SunCalc, az 0=south).

**Polish only (not greenfield):** richer sunrise→sunset arc chrome; keep
static `SUN_SHADOW` when shade off / Fit sheet.

## Gates / conventions reminders

- End-of-build gate is binding (`.cursor/rules/end-of-build.mdc`): typecheck,
  touched unit tests, kept e2e for canvas-risk changes **executed**, commit
  only when user asks ship.
- Chrome detector must stay zero:
  `apps/web/e2e/canvas-chrome-detector.spec.ts`.
- PowerShell shell: no `&&`, use `;`. Vitest: `pnpm exec vitest run <paths>`
  from repo root. Playwright: run from `apps/web`,
  `pnpm exec playwright test e2e/<spec> --reporter=list`. Local API needs
  `RATE_LIMIT_MAX=10000` for e2e project creation.
- Windows: `head`/`tail` unavailable; `curl.exe` not `curl`.

## Suggested commit split when user says ship

1. `fix(web): sketch enters on pan — pen only inks while armed` (section A1)
2. `fix(api): sketch→CAD heuristic vocabulary passes catalog filter` (A2)
3. Services layer + sun cast as their own feats when built.
