# 📦 MASTER BUILD SPEC: WORKSTREAM GOLD STANDARD 2026 (FINAL)

This document is the definitive technical authority for the **Workstream Gold Standard 2026** release. It provides the logic, tokens, and component mappings required to build the 6 core modules in React/Tailwind.

## 1. ARCHITECTURAL MANDATE: THE ZERO-CHROME PROTOCOL
- **Viewport**: 100% full-bleed. `overflow: hidden` on root.
- **Canvas**: Absolute inset-0. Three.js/Mapbox context must occupy the entire viewport.
- **Instruments**: All UI must be floating "Glass Cards" (`bg-[#1E2329]/70`, `backdrop-blur-md`, `rounded-2xl`, `border border-white/5`).

## 2. MODULE DIRECTORY (PRODUCTION FINALS)
Reference these screens for 1:1 implementation:

1. **Step 0: Site Truth (Acquisition)**: {{DATA:SCREEN:SCREEN_105}}
2. **Phase 1: Sketch Studio (Creative)**: {{DATA:SCREEN:SCREEN_99}}
3. **Phase 2: CAD Studio (Technical)**: {{DATA:SCREEN:SCREEN_101}}
4. **Phase 3: Client Proposal (Financials)**: {{DATA:SCREEN:SCREEN_125}}
5. **Phase 4: Build Pack Export (Handoff)**: {{DATA:SCREEN:SCREEN_126}}
6. **Mobile Field Bridge (On-Site AR)**: {{DATA:SCREEN:SCREEN_97}}

## 3. DESIGN TOKENS (STUDIO DARK)
- **Canvas Base**: `#101418`
- **Primary/Gold Standard**: `#fbbf24` (Used for active, compliant, and secured data)
- **Truth Anchor/Signal Blue**: `#0030CF` (Used for boundaries, (0,0,0) origin, and offsets)
- **Strike Alert/Conflict**: `#ef4444` (Used for utility collisions)

## 4. SPATIAL GOVERNANCE
- **Local Origin (0,0,0)**: Anchor as a Signal Blue crosshair. Exclude from service-line hydraulic runs.
- **Billboarding**: All labels and Meta Chips must face the camera in the 3D scene.
- **Typography**: `Space Grotesk` (Technical/Data), `Inter` (UI Labels).

*Directive: The drawing is the product. Execute exactly as spec'd.*