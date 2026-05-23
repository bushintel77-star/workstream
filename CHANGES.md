# Aerial Design Studio — redesign changelog

Hand-off for phases 2–5 and 7 (web). See `AERIAL_DESIGN_STUDIO_AGENT_BRIEF.md` for the
full spec. **Phase 6 (AI assist)** and **brochure output** remain deferred.

Last updated: 2026-05-21.

## Shipped

| Phase | Summary | Key commits |
|-------|---------|-------------|
| 2 | Aegis tokens, glass chrome, unified asset tiles | `80e7c07`, PR #15 |
| 3 | Aerial-hero layout, 320px rail, toolbar Save + status | PR #15 |
| 4 | Asset codes on tiles, search by code/SKU, pinned Planning group | `9305158` |
| 5 | Modeless canvas, move/rotate/scale, indicative scale bar, context label | `33bce8b` |
| 7 | Honesty caption, save hand-off toast, clear confirms, keyboard legend, empty/error states | `9305158`, `33bce8b` |
| Review | Mapbox 256px projection fix, drag/place conflict, toast undo, a11y | `e20c749` |

## Components

| File | Role |
|------|------|
| `apps/web/src/components/DesignStudio.tsx` | Canvas interaction, toolbar, save |
| `apps/web/src/components/studio/DesignAssetPalette.tsx` | Search, categories, planning pin |
| `apps/web/src/components/studio/DesignCanvasPlacement.tsx` | Placed symbol + handles |
| `apps/web/src/components/studio/ScaleBar.tsx` | Indicative metre bar |
| `apps/web/src/lib/mapView.ts` | Static image bounds + scale math |

## Deviations from brief

- **Accent on mode bar:** Place and Draw fallback modes use accent when active; Auto/Select use neutral active state to stay within ≤3% signal surface.
- **Marquee multi-select:** Not implemented; tap-select + drag-move only.
- **Cmd+K command bar:** Deferred with Phase 6 AI.
- **Brochure output:** Deferred per spec (Phase 8 brochure).
- **Placement undo stack:** Clear symbols/strokes use toast Undo; toolbar Undo is stroke-only.

## Verification

```bash
pnpm ci
pnpm test:e2e   # design-studio.spec.ts
```

## Still open

- Phase 6 — AI detection ghosts + command bar (`PROPOSAL.md` only until scheduled).
- Phase 8 brochure — quote/PDF brochure layout (product spec TBD).
- Mobile studio parity — separate surface (`apps/mobile`).
