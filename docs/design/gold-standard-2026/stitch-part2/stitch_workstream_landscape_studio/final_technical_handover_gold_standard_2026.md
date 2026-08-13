# Workstream "Gold Standard 2026" Final Technical Handover

## 1. Architectural Philosophy: "The Drawing is the Product"
The Workstream interface is a **Zero-Chrome, Canvas-First** environment. All UI elements must exist as non-intrusive instruments that support, rather than contain, the spatial truth of the design.

### Core Viewport Specs
- **Full-Bleed Canvas**: `overflow: hidden` on the root container. WebGL/Three.js context must occupy 100vw/100vh.
- **Infinity Zoom Logic**: A fractal dot-grid background that supports both fluid sketching and high-precision drafting.
- **Glass Card Foundation**: All HUD elements must use the following Tailwind profile:
  - `bg-surface-dim/70` (Deep Charcoal at 70% opacity)
  - `backdrop-blur-md` (Medium intensity)
  - `rounded-2xl` (Geometric precision)
  - `border border-white/5` (Subtle definition)

## 2. Token Authority: Studio Dark (Gold Standard)
| Semantic Role | Token / Variable | Hex Code |
|---|---|---|
| **Canvas Base** | `surface` | `#101418` |
| **Primary Highlight** | `gold-standard` | `#fbbf24` |
| **Site Truth Boundary** | `signal-blue` | `#0030CF` |
| **Subsurface Conflict** | `error` | `#ef4444` |
| **Technical Data Font** | `font-technical` | `Space Grotesk` |
| **Interface Font** | `font-ui` | `Inter` |

## 3. Component Specs: HUD & Meta Chips
### Contextual HUD (Spatial Anchoring)
- **Billboarding**: All HUD elements must always face the viewport camera regardless of 3D tilt.
- **Leader Lines**: Use a 1px bone-white (`#f8f9ff`) line to connect the HUD to its 3D coordinate.
- **Progressive Disclosure**: Use Meta Chips (small, capsule-shaped tokens) to surface data like 'Depth', 'Material', and 'Compliance' only when an object is selected.

### Lens Dial (Global Instrument)
- **Logic**: Toggles visibility of `SpatialObject` layers (Subsurface, Solar, Staking, Planting).
- **Interaction**: A floating vertical ribbon or radial dial with active state indicated by the `#fbbf24` highlight.

## 4. Implementation Checklist for Cursor/Windsurf
- [ ] **Viewport**: Set `body { overflow: hidden; }` and initialize Three.js to full window dimensions.
- [ ] **HUD Layer**: Implement a Z-index 50+ layer for all floating Glass Cards.
- [ ] **Spatial Schema**: Use the `SpatialObject` TypeScript interface for all canvas entities to ensure live-synced telemetry.
- [ ] **MCP Activation**: Ensure `STITCH_API_KEY` is in `.env` and `.devin/mcp_config.json` has `"disabled": false`.

## 5. Mobile AR Bridge
- **Viewport**: 100% Camera feed with precision AR overlay.
- **Staking Logic**: Coordinate locks must use the `#fbbf24` compliance highlight when the GPS/RTK accuracy meets the "Gold Standard" threshold (<20mm).
