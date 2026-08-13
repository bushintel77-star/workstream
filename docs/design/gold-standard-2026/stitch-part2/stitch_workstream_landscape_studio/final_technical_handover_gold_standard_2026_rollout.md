# Workstream "Gold Standard 2026" Final Technical Handover

## 1. Core Architectural Principles
- **Zero-Chrome Environment**: 100% full-bleed canvas. All UI elements must be floating 'Glass Cards' or 'Meta Chips'. No fixed structural frames or sidebars.
- **Infinity Zoom Logic**: A relaxed, fractal dot-grid background that supports both fluid sketching and high-precision drafting.
- **Spatial Truth Engine**: Data must be anchored to specific 3D coordinates on the canvas. Use billboarded labels (always facing the camera).

## 2. Visual Specification (Studio Dark)
- **Palette**: 
  - Canvas Base: `#101418` (Deep Charcoal)
  - Glass Card: `bg-surface-dim/70` with `backdrop-blur-md`
  - Highlight: `#fbbf24` (Gold Standard) for active/compliant states.
  - Signal Blue: `#0030CF` for site-truth boundaries and offsets.
- **Typography**:
  - Technical/Data: `Space Grotesk`
  - Interface/Labels: `Inter`

## 3. Implementation Checklist for Cursor/Windsurf
- [ ] **HUD Architecture**: Implement the `GlassCard` and `MetaChip` components using the semantic token system.
- [ ] **Lens Logic**: Enable the `LensDial` to toggle visibility of `SpatialObject` layers (Subsurface, Solar, Staking).
- [ ] **Temporal Logic**: Build the `TemporalScrubber` component to move through Step 0 (Survey) to Step 10 (Maturity).
- [ ] **Mobile AR Bridge**: Ensure the mobile companion uses the `SpatialObject` schema to render staking chips and utility ghosting in the camera viewport.

## 4. MCP Connectivity
- **Server**: `@stitch/mcp-server`
- **Config**: Ensure `.devin/mcp_config.json` has `"disabled": false`.
- **Auth**: `STITCH_API_KEY` must be populated in all environment files (`.env`).
