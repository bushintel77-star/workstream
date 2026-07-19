# Legacy canvas tree (do not remount)

Live `/projects/[id]` mounts `handoff/HandoffDesignStudio` only.

These modules are **retired** for Workflow 1. Do not re-wire them as the default surface:

- `SiteCanvas.tsx` + `siteCanvas.module.css`
- `SketchInstrument.tsx`, `SketchRibbon.tsx`
- `LiveBomHud.tsx` (handoff uses `features/bom/LiveBomDock` + worker estimate)
- `FitSheetLayer.tsx`, `ClayWalkthrough.tsx`, `SiteIntelligenceOverlay.tsx`
- `canvas-chrome.ts` (superseded by `handoff/state/handoffChrome.ts`)

Prefer deleting unused files in a dedicated cleanup PR once e2e no longer references them.
Delete is preferred over shims — see CLAUDE.md.
