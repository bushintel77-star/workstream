/**
 * Gold Standard 2026 — seasonalStore backward-compat shim.
 *
 * The store has been unified into studioStore.ts (the Fused Rendering Context
 * backbone). This file re-exports the new store under the old name so existing
 * importers (StudioControls, sceneItems, SubsurfaceEngine, WebGLStudioPreview,
 * StudioScene) keep working without changes. New code should import from
 * studioStore.ts directly.
 *
 * The seasonal fields (growthYear, seasonProgress, sunMin, subsurfaceView,
 * sketchMode) live in the SAME zustand store as the new fields (viewBlendTarget,
 * sketchStrokes, save status). `useSeasonalStore` is an alias for
 * `useStudioStore` — they are the same store instance.
 */

export {
  useStudioStore as useSeasonalStore,
  winterFactor,
  autumnFactor,
  seasonLabel,
  seasonMonth,
  leafStatus,
  type StudioStoreState as SeasonalState,
} from "./studioStore";
