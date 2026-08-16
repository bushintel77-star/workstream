# MASTER DEPLOYMENT DIRECTIVE: WORKSTREAM GOLD STANDARD 2026

## 1. PROJECT MISSION
Finalize and ship the "Gold Standard 2026" release for Workstream.
**Philosophy**: "The Drawing is the Product."
**Architecture**: Absolute Zero-Chrome. The viewport must be a 100% full-bleed canvas. All UI must exist as floating "Glass Cards" or contextually anchored "Meta Chips."

## 2. FINAL TECHNICAL SPECIFICATIONS

### A. THEME: STUDIO DARK (GOLD STANDARD)
- **Base Canvas**: `#101418` (Surface)
- **Primary Highlight**: `#fbbf24` (Gold Standard) for active/compliant data.
- **Site Truth Anchor**: `#0030CF` (Signal Blue) for the (0,0,0) origin and boundaries.
- **Conflict/Strike Alert**: `#ef4444` (Error) for subsurface collisions.
- **HUD Profile**: `bg-surface-dim/70`, `backdrop-blur-md`, `rounded-2xl`, `border border-white/5`.
- **Typography**: `Space Grotesk` (Technical/Spatial Data), `Inter` (UI Labels/Metadata).

### B. SPATIAL GOVERNANCE & HYDRAULICS
- **Origin Lock**: The (0,0,0) Site Origin (Signal Blue) must be strictly excluded from all service-line hydraulic calculations in `packages/domain/src/spatial-facts.ts`.
- **Hydrological HUD**: Implement live GPM (Gallons Per Minute) and pressure-drop telemetry on the canvas when irrigation/drainage lines are selected or modified.
- **Subsurface Truth**: Utility lines (Gas, Water, Conduits) must render as 3D volumes. Trigger Strike Alerts (`#ef4444`) if any design geometry intersects these volumes.

### C. HUD & INTERACTION HIERARCHY
- **Floating Tool Ribbon**: Minimalist vertical ribbon on the left edge.
- **Lens Dial**: Floating radial/vertical toggle for: `Subsurface`, `Solar Impact`, `Staking`, `Planting`, `Revision History`.
- **Meta Chips**: Capsule-shaped, billboarded labels anchored to 3D coordinates. Surfacing `Depth`, `Material`, and `Compliance` status.
- **Infinity Zoom**: Fractal dot-grid background that maintains visual rhythm across all zoom levels.

## 3. IMPLEMENTATION WORKFLOW

### WEB PRODUCTION (apps/web)
- **Viewport**: Set `body { overflow: hidden; }`. Initialize Three.js/WebGL context to `100vw` / `100vh`.
- **Component Migration**: Replace any remaining legacy containers with the `FloatingHUD` and `GlassCard` patterns.
- **State Integration**: Ensure the `ProjectCanvas` API is the single source of truth for all spatial facts and hydration.

### MOBILE FIELD BRIDGE (apps/mobile)
- **AR Viewport**: 100% camera feed with high-precision spatial overlay.
- **Staking Logic**: Render Gold Standard chips at physical coordinates with `<12mm` RTK accuracy threshold.
- **Subsurface Ghosting**: Visualise underground utilities as translucent 3D volumes in the camera feed.

## 4. EXECUTION CHECKLIST
1. **Deduplicate**: Verify `packages/ui/src/tokens.ts` is the single source of truth for the Studio Dark palette.
2. **Harden Contracts**: Ensure `packages/contracts/src/schemas/orchestration.ts` correctly handles the GPM, PSI, and Maturity data fields.
3. **Lock Origin**: Confirm the Site Origin constant is protected from डिजाइन-side overwrites.
4. **Final Build**: Run `pnpm build` and `pnpm typecheck`.

*This is the final "Trigger" prompt. Execute all steps to reach 100% production readiness.*