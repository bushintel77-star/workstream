# Estimation dock — semi-persistent companion surface with untick line items

Design spec (2026-08-18). Status: **for review — no code changed**. Product
direction: the estimation should be a semi-persistent companion in the right
dock, and each line item should carry a tiny tick the operator can untick to
exclude it from the estimate without deleting the design.

## 1. Context — what estimation is today

- `FitSheetCard` renders a live itemized quotation from `StudioEstimateLine`s:
  sections, subtotal/GST/total, stock pulse, backend-quote drift honesty.
  Rows are keyed by stable line ids (`FitSheetCard.tsx:206`), and items map
  through `id: it.id` (`fitSheet.ts:84`) — a per-line exclusion is a pure
  filter, no schema fight.
- The surface is mode-gated in practice: `fitSheetOpen` is a store flag that
  survives mode switches, but the panel renders only when the mode-body chain
  reaches its branch (`WebGLStudioPreview.tsx:1679` — sketch/cad/survey
  branches match first), so the estimate is a mode you enter, not a
  companion.
- Three affordances drive the same `fitSheetOpen` flag: the Quote mode tab,
  `rail-quote` (`StudioToolRail.tsx:251-263`), and `meta-tab-fit`
  (`WebGLStudioPreview.tsx:841-847`) — the redundancy the UI survey flagged
  (`docs/agent-prompts/ui-root-cause-survey.md` §4.3).
- The Phase 2 right dock (`top: 152; right: 12; width: 360; zIndex: 10`,
  `WebGLStudioPreview.tsx:903-917`) is the natural home for a persistent
  companion.

## 2. Goals

1. The estimation becomes a **semi-persistent docked companion** — visible
   while the operator works in any mode, toggleable, not a mode you enter.
2. Each line item carries a **tiny tick**; unticking excludes the line from
   the estimate totals and sections while the placement/feature **stays on
   the canvas** (exclude from the quote, never delete the design).
3. The interaction stays honest: excluded lines are visible and stamped, the
   total reflects the exclusion, and the quote backend/portal behaviour is
   explicit (see §5).

## 3. Surface design — the docked companion

- **Placement:** the estimation mounts in the right dock as a companion
  section alongside the mode surfaces. Recommended stacking: the mode panel
  first, the estimation below it under a collapsible header
  (`data-testid="estimation-dock"`), so both read together in cad/sketch
  while the operator iterates.
- **Toggle:** `meta-tab-fit` stays the single toggle (store `fitSheetOpen`).
  **Phase 5 consequence:** `rail-quote` becomes redundant — this spec
  recommends dropping it and letting the Fit tab own the companion (the
  survey's "one affordance per state" direction, now with a concrete answer).
- **Mode interplay:** the companion renders regardless of `activeMode` (the
  mode-body chain no longer gates it); it self-gates on `items.length > 0`
  exactly as today (`FitSheetCard.tsx:163`).
- **Chrome law:** the dock already exists and passes the pairwise
  chrome-collision gate; the companion is chrome inside it — the collision
  spec and the `webgl-fit-sheet` probe must stay green (the s6 coverage
  ratchet is `?svg=1`-scoped and untouched).

## 4. Untick line-item semantics

- **State:** `excludedEstimateLineIds: string[]` in the studio store
  (session-scoped, survives mode switches, resets on reload in v1 — §5).
- **Filtering point (pure, tested):** a new pure step in `fitSheet.ts` —
  `excludeEstimateLines(estimate, excludedIds)` applied between
  `buildEstimateArgsFromStudio` and `summarizeFitSheet`. Sections, subtotal,
  GST, and total recompute from the filtered set; the source canvas is
  untouched.
- **Tick UI:** a tiny checkbox per row (`data-testid="fit-line-tick-{line.id}"`,
  checked by default). Untick → excluded; the row stays visible struck-through
  with a "not in quote" chip so the operator sees what is off the estimate;
  a companion "N lines excluded" stamp sits by the total.
- **Undo:** unticking is a quote-view state, not a canvas mutation — it does
  NOT enter the canvas undo history (re-ticking is the revert). This is a
  deliberate scope line: the drawing and the estimate view are separate
  layers.
- **Pruning:** if the placement/feature behind an excluded line is deleted,
  the stale id is pruned from the exclusion set (no phantom exclusions).
- **Editing interplay:** changing the source item (scale/SKU) re-derives the
  line; the exclusion follows the stable line id (the id survives because
  lines derive from item ids — verify the id stability rule during build).

## 5. Persistence — the decision this spec recommends

- **v1 (recommended): session-persistent.** Exclusions live in the studio
  store. The docked companion is the whole slice; the quote **backend and
  portal are unaffected** — the untick is a drafting aid, and the backend
  quote keeps the honest "live canvas vs backend drift" line
  (`FitSheetCard.tsx:290-304`) as the reconciliation story.
- **v2 (sketched, not built): durable exclusions.** New
  `DesignCanvas.excluded_estimate_line_ids: z.array(z.string()).default([])`
  in `packages/contracts`, threaded through the design-VCS three-way merge,
  the autosave fingerprint, and the **portal/quote payload** so unticked
  lines also leave the client-facing quote. This is the larger slice —
  contracts + merge + API + portal tests.

## 6. Scope slices

| Slice | Contents | Size |
|---|---|---|
| v1 | Docked companion (dock stacking + Fit-tab toggle + drop `rail-quote`) + session exclusion store + pure `excludeEstimateLines` filter + tick/struck-through UI + honesty stamps | M |
| v2 | Durable `excluded_estimate_line_ids` (contracts + merge + API + portal) | L |

## 7. Verification

- Unit: `fitSheet.test.ts` — exclusion filtering (totals/sections recompute,
  empty set no-op, unknown ids pruned, id stability after item edits).
- e2e: extend `webgl-fit-sheet.spec.ts` — open the docked companion from the
  Fit tab, untick a line, assert the total drops and the struck-through row +
  "N excluded" stamp, re-tick restores; reload resets exclusions (v1).
  `webgl-chrome-collision.spec.ts` stays green with the companion mounted.
- Gates: web typecheck, vitest, eslint `--max-warnings 0`, kept probes.

## 8. Open questions for review

1. Dock stacking: estimation below the mode panel (recommended) vs above vs
   a separate right drawer.
2. Excluded lines: struck-through in-list (recommended) vs hidden behind a
   "Show excluded" filter.
3. Does unticking feed the **saved quote** at all in v1, or is the backend
   quote exclusively the source of truth until v2? (Recommendation: v1 is
   drafting-only; the drift line stays the reconciliation surface.)

## 9. Execution status — v1 shipped (2026-08-18)

Slice v1 implemented with the recommended defaults (operator delegated the
design calls): estimation below the mode panel, excluded lines struck-through
in-list, drafting-only (backend quote untouched until v2).

- **Surface:** `FitSheetCard` mounts in the right dock as a companion after
  the mode-body IIFE (`WebGLStudioPreview`), rendering in any mode,
  self-gating on `fitSheetOpen`/items/summary. `meta-tab-fit` owns the
  toggle; `rail-quote` and the `showQuote` rail prop are removed.
- **Untick:** store `excludedEstimateLineIds` + `toggleEstimateLineExcluded`
  (quote-view state — no canvas history); `fitSheet.ts` gains the pure
  `excludeEstimateLines` filter applied AFTER the engine (the report's money
  fields are exact sums of line totals, so subtotal/GST/total recompute with
  the engine's own formula — no worker re-settle on untick); every report
  line carries `fit-line-tick-{id}`; excluded lines render struck-through
  with a re-tick, their label + figure, and a "not in quote" chip under an
  "Excluded from quote (N)" block.
- **Tests:** `fitSheet.test.ts` (exclusion filter: subset, empty-set
  identity, stale-id no-op), `studioStore.test.ts` (toggle without history),
  `webgl-fit-sheet.spec.ts` rewritten for the Fit-tab toggle + untick →
  total-drop → strike-through → re-tick restore flow.
- **Gates:** web typecheck, vitest, eslint `--max-warnings 0`, e2e
  (fit-sheet + chrome-collision) green.
- **Known v1 limits (v2 candidates):** every report line shows a tick (the
  list is no longer capped at six); excluded items show their type label
  rather than the engine's friendly label; durable exclusions
  (`DesignCanvas.excluded_estimate_line_ids`) and portal/backend
  consumption remain the v2 slice.
