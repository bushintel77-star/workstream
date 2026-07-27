# Implementation brief — canvas-first asset menu + full quote builder

**To:** Cursor (implementation)
**From:** Design & Architecture
**Date:** 2026-07-27

## Objective

Implement the approved design return in full. The specification is the single
source of truth:

- **Spec (build from this):** [`docs/design-returns/2026-07-27-canvas-asset-menu-and-quote-builder.md`](./2026-07-27-canvas-asset-menu-and-quote-builder.md)
- **Context & priorities:** [`docs/design/operator-redesign/design_handoff_landscape_cad_studio/TIER1-GAP-ANALYSIS-2026-07-27.md`](../design/operator-redesign/design_handoff_landscape_cad_studio/TIER1-GAP-ANALYSIS-2026-07-27.md)

## Status

PR1 (command-first placement + auto-collapsing dock) has landed and passed
design QA — see §13 of the spec. Its work is present as uncommitted changes on
`main`; begin from that state.

## Scope of work

Deliver PR2 through PR7 in the sequence defined in §11 of the spec, one pull
request per concern:

1. **PR2 — mobile `AssetCommandSheet`** (peek/expand, tap-to-arm → tap-canvas).
   Also fold in the §13 carry-forward items: promote the palette to an input
   `role="combobox"` with results `role="listbox"` + `aria-activedescendant`;
   add a test asserting every `STUDIO_TYPE_SKUS` alias resolves to a real
   rate-card SKU; confirm collapsed-rail controls are ≥44px.
2. **PR3 — `QuoteDoc` contract** in `packages/contracts` (added first), then the
   `resolveQuote` domain function in `packages/domain` with unit tests. No UI.
3. **PR4 — editable `QuoteBuilder`** (desktop two-pane).
4. **PR5 — mobile quote sheet** with sticky totals.
5. **PR6 — margin, alternates, exclusions**, and share-freeze to
   `ShareRevision.quoteLines`.
6. **PR7 — remove** any dead oversized-card CSS.

## Requirements

- Meet the acceptance criteria in §12 for each PR.
- Observe repo conventions: `apps/web/src/components/canvas/handoff/ARCHITECTURE.md`
  and `CLAUDE.md` — lane-law chrome, design tokens (no raw hex), en-AU and GST,
  and full **375 / 720 / 960 responsive parity** (desktop and mobile are both
  first-class).
- Never mutate the estimate engine; the quote is an **override layer** that
  re-merges by SKU on re-estimate and surfaces orphaned overrides rather than
  dropping them (§10).
- Do not alter the Vicmap dwelling-hydrate logic, except optionally the G4/G5
  containment filter on `fetchBuildingPolygon`, which must be its own PR.

## Definition of done (per PR)

- `pnpm --filter @workstream/web typecheck` green.
- Web, API, and domain vitest suites green.
- Conventional Commit; one revertable concern; small enough to avoid colliding
  with in-flight WIP.
- Desktop (960) and mobile (375) screenshots attached.
