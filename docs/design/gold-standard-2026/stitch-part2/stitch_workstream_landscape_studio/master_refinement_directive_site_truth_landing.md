# MASTER REFINEMENT DIRECTIVE: SITE TRUTH LANDING (GOLD STANDARD 2026)

## 1. ARCHITECTURAL MANDATE: "THE DRAWING IS THE PRODUCT"
The current implementation has drifted into "boxed containment." You must strip away all fixed structural blocks and opaque containers. The viewport must be 100% full-bleed.

## 2. THE GLASS HUD SPECIFICATION
Replace all legacy sidebars and headers with floating **Glass Cards**. Apply this Tailwind profile to all HUD elements:
- **Surface**: `bg-[#1E2329]/70` (Surface Dim at 70%)
- **Blur**: `backdrop-blur-md`
- **Shape**: `rounded-2xl`
- **Stroke**: `border border-white/5`
- **Shadow**: `shadow-2xl`

## 3. SPATIAL DATA & TOKENS (STUDIO DARK)
Align all technical data and highlights to the **Gold Standard 2026** palette:
- **Primary Highlight**: `#fbbf24` (Gold Standard) — Use for active search focus and "Secured" states.
- **Site Truth Anchor**: `#0030CF` (Signal Blue) — Use for boundary lines and coordinate locks.
- **Base Surface**: `#101418` (The canvas background).
- **Typography**: 
  - **Technical Data**: `Space Grotesk` (Technical labels, Lat/Long, GPM).
  - **Interface Labels**: `Inter` (Buttons, Search input).

## 4. UI COMPONENT REFACTORING
- **Global Search**: Refactor the address input into a floating, centered Glass Card with a `#fbbf24` focus ring.
- **Acquisition Pipeline**: Transition the "Spatial Truth" and "Hydrology" blocks into a vertical stack of **Meta Chips** (capsule-shaped tokens) on the left side. Use a staggered reveal animation.
- **Zero-Chrome Navigation**: Replace the top/bottom bars with a minimalist, vertical floating tool ribbon on the far left and the **Lens Dial** (radial or vertical) on the right.

## 5. COORDINATE GOVERNANCE
- Ensure the (0,0,0) Site Origin is rendered as a **Signal Blue** crosshair with a billboarded "SITE ORIGIN (0,0,0)" label in `Space Grotesk`.
- The fractal dot-grid background must maintain visual rhythm across all zoom levels (`infinity-zoom`).

## 6. EXECUTION CHECKLIST
1. [ ] Strip `overflow-y` and `fixed` sidebar containers.
2. [ ] Apply `backdrop-blur-md` and `bg-surface-dim/70` to all floating elements.
3. [ ] Map `Space Grotesk` to technical metadata components.
4. [ ] Wire the `onAcquisitionComplete` callback to desaturate non-parcel geometry to `#2A3037`.

*Directive: Realign the current build to match the high-fidelity designs provided in the workspace. The drawing is the product—the UI is merely the instrument.*