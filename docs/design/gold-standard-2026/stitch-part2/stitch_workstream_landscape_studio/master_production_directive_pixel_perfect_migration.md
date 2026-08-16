# MASTER PRODUCTION DIRECTIVE: THE PIXEL-PERFECT MIGRATION (GOLD STANDARD 2026)

## 1. ARCHITECTURAL MANDATE: THE ZERO-CHROME PROTOCOL
All development targets must adhere to the **Zero-Chrome** mandate. If a component creates a structural "frame," header, or sidebar that boxes in the canvas, it is a defect.

### Mandatory Global CSS (apps/web/src/app/globals.css)
```css
:root {
  --canvas-base: #101418;
  --gold-standard: #fbbf24;
  --signal-blue: #0030CF;
  --error-strike: #ef4444;
}

body, #root, main { 
  overflow: hidden !important; 
  width: 100vw !important; 
  height: 100vh !important; 
  background: var(--canvas-base) !important;
  margin: 0;
  padding: 0;
}

.canvas-container {
  position: absolute;
  inset: 0;
  z-index: 0;
}
```

## 2. HUD INSTRUMENTATION (The "Glass" Profile)
All UI must be floating HUD elements. Do not use standard cards. Every instrument must use this exact Tailwind profile:

```tsx
// HUD Base Spec
const FloatingInstrument = ({ children, className }) => (
  <div className={`fixed z-50 backdrop-blur-md bg-[#1E2329]/70 rounded-2xl border border-white/5 shadow-2xl p-6 ${className}`}>
    {children}
  </div>
);
```

### Component Placement (Reference: SCREEN_6)
- **Search HUD**: `top-8 left-1/2 -translate-x-1/2`, `min-w-[600px]`. Focus ring: `#fbbf24`.
- **Acquisition/Tool Ribbon**: `left-8 top-1/2 -translate-y-1/2`. Vertical stack of Meta Chips.
- **Site Truth HUD**: `right-8 top-1/2 -translate-y-1/2`. Technical metadata in `Space Grotesk`.

## 3. SPATIAL TRUTH & GOVERNANCE
- **Site Origin (0,0,0)**: Render as a **Signal Blue (#0030CF)** 3D crosshair. 
- **Hydraulic Lock**: Origin (0,0,0) MUST be excluded from service-line hydraulic calculations in `packages/domain`.
- **Billboarding**: All labels and Meta Chips must be billboarded to always face the camera.
- **Typography**: 
  - `Space Grotesk`: Mandatory for all coordinates, numeric data, and technical labels.
  - `Inter`: Mandatory for UI buttons, search input, and general labels.

## 4. MCP SYNC & DATA INTEGRITY
1. **Initialize**: Pull the `SpatialObject` schema from `packages/contracts`.
2. **Validation**: Ensure all design-side imports (Figma/Sketch) map correctly to the `SpatialObject` interface before rendering.
3. **Collision Engine**: Utility lines must render as 3D volumes. Enable `Strike Alerts (#ef4444)` if intersection logic is triggered.

*Directive: The drawing is the product. Strip the chrome. Execute exactly as spec'd for a pixel-perfect migration.*