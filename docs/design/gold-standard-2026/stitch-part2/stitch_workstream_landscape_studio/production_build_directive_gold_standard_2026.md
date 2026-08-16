# PRODUCTION BUILD DIRECTIVE: WORKSTREAM GOLD STANDARD 2026

## 1. CONTEXT & STATUS
- **Architecture**: Zero-Chrome, Canvas-First.
- **Environment**: Windows PC (Cursor/Windsurf/Devin).
- **Frontend Stack**: Next.js (Web), Expo (Mobile), Three.js (WebGL Canvas).
- **Backend**: Verified TypeScript interfaces (packages/contracts).
- **Design Tokens**: Studio Dark (Surface: #101418, Primary: #fbbf24, Site Truth: #0030CF).

## 2. CORE IMPLEMENTATION REQUIREMENTS

### A. HUD & UI ARCHITECTURE
- **Global Rule**: No fixed structural frames.
- **Components**: Use floating 'Glass Cards' (`bg-surface-dim/70`, `backdrop-blur-md`, `rounded-2xl`).
- **Data Display**: Use billboarded 'Meta Chips' anchored to 3D coordinates.
- **Typography**: Space Grotesk (Technical/Data), Inter (UI Labels).

### B. SPATIAL LOGIC (THREE.JS)
- **Site Origin Anchor**: Hard-code the (0,0,0) coordinate lock using the Signal Blue (#0030CF) highlight. Ensure it is excluded from service-line hydraulic calculations.
- **Hydrological HUD**: Implement live GPM (Gallons Per Minute) and pressure-drop logic for irrigation/drainage lines.
- **Subsurface Engine**: Render gas, conduits, and root-protection zones as 3D volumes. Enable Strike Alerts (#ef4444) for coordinate conflicts.
- **Temporal Scrubber**: Implement the 10-Year Growth shader to transition plant geometry from 'Step 0' to 'Step 10' maturity.

### C. MOBILE FIELD BRIDGE (EXPO)
- **AR Staking**: Implement the coordinate-lock logic in the mobile viewport to render Gold Standard staking chips on physical coordinates.
- **Vendor Pulse**: Surface live availability metadata for planting specimens.

## 3. REPOSITORY HARDENING
- **Deduplication**: Ensure `packages/ui/tokens.ts` is the single source of truth for semantic colors.
- **Governance**: Protect the (0,0,0) Origin from design-side overwrites.

## 4. EXECUTION INSTRUCTIONS
1. **Initialize**: Pull the `SpatialObject` schema and verify against existing hydration logic.
2. **Apply HUD**: Replace all legacy fixed sidebars with the floating component library.
3. **Wire Logic**: Connect the Three.js scene to the temporal and hydrological state machines.
4. **Build**: Run `pnpm build` and `pnpm typecheck` to verify implementation.

*Note: Native mobile builds (EAS/Local) will be handled manually by the user.*
