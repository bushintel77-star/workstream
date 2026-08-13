# MASTER EXECUTION PROMPT: WORKSTREAM GOLD STANDARD 2026

## 1. PROJECT VISION & CORE ARCHITECTURE
You are implementing the "Gold Standard 2026" release for Workstream, a canvas-first landscape architecture platform. 
**Philosophy**: "The Drawing is the Product." 
**Architecture**: Zero-Chrome HUD. No fixed structural frames, sidebars, or headers. All UI must be floating "Glass Cards" or "Meta Chips" anchored to spatial coordinates.

## 2. TECHNICAL SPECIFICATIONS

### A. THEME: STUDIO DARK (GOLD STANDARD)
- **Base Canvas**: #101418
- **Primary/Highlight**: #fbbf24 (Gold Standard)
- **Boundary/Truth**: #0030CF (Signal Blue)
- **Alert/Conflict**: #ef4444
- **HUD Surface**: `bg-surface-dim/70` with `backdrop-blur-md`, `rounded-2xl`, `border border-white/5`
- **Typography**: `Space Grotesk` (Technical/Coordinates), `Inter` (Labels/UI)

### B. SPATIAL ENGINE (Three.js / WebGL)
- **Coordinate Lock**: Anchor the (0,0,0) Origin Point using the Signal Blue highlight.
- **Hydraulic Isolation**: The Origin Point must be explicitly excluded from service-line hydraulic calculations.
- **Hydrological HUD**: Implement live GPM (Gallons Per Minute) and pressure-drop calculations for irrigation/drainage lines.
- **Subsurface Truth**: Render utility lines (Gas, Water, Electric) as 3D volumes. Enable "Strike Alerts" when design geometry conflicts with subsurface coordinates.

### C. HUD & INTERACTION LOGIC
- **Floating Tool Ribbon**: Implement a minimalist vertical tool ribbon on the left edge.
- **Lens Dial**: A floating radial or vertical instrument for toggling layers (Subsurface, Solar, Staking, Planting).
- **Meta Chips**: Use capsule-shaped billboarded labels that always face the camera for displaying object metadata (Depth, Material, Compliance).
- **Infinity Zoom**: Implement a fractal dot-grid background that scales with camera distance.

## 3. FILE-LEVEL IMPLEMENTATION DIRECTIVE

### WEB FRONTEND (apps/web)
- **Viewport**: Set `body { overflow: hidden; }`. Three.js context must occupy 100vw/100vh.
- **Components**: Replace all legacy fixed containers with `FloatingHUD` and `GlassCard` components.
- **Hydration**: Maintain `getProject` and `getDesignCanvas` for project state. Push all design changes into the `ProjectCanvas` API.

### MOBILE FIELD BRIDGE (apps/mobile)
- **AR Viewport**: Implement 100% camera feed with precision AR overlay.
- **Staking Logic**: Render Gold Standard staking chips at physical coordinates with <20mm RTK accuracy threshold.
- **Subsurface Ghosting**: Visualise underground utilities as translucent 3D volumes in the camera feed.

## 4. EXECUTION STEPS
1. **Deduplicate Tokens**: Verify `packages/ui/tokens.ts` is the single source of truth for semantic colors.
2. **Apply HUD Architecture**: Migrate `HandoffDesignStudio.tsx` to the zero-chrome layout.
3. **Wire Logic**: Connect the hydrological and temporal state machines to the Three.js scene.
4. **Harden Governance**: Ensure the (0,0,0) Site Origin is protected from design-side overwrites.
5. **Verify**: Run `pnpm build` and `pnpm typecheck`.

*Reference design assets provided on the Stitch canvas for visual alignment.*