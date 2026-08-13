# PRODUCTION DIRECTIVE: PIXEL-PERFECT HUD & CANVAS SYNC (MCP 2026)

## 1. THE "DRIFT" RECTIFICATION
Developer agents (Cursor/Windsurf) often fallback to standard web containers. This directive FORCES the zero-chrome architecture.

### Viewport Hardening (Global CSS)
```css
/* Inject into global.css / tailwind.css */
:root {
  --canvas-base: #101418;
  --gold-standard: #fbbf24;
  --signal-blue: #0030CF;
}

body, #root, main { 
  overflow: hidden !important; 
  width: 100vw !important; 
  height: 100vh !important; 
  background: var(--canvas-base) !important;
  margin: 0;
  padding: 0;
}

.canvas-surface {
  position: absolute;
  inset: 0;
  z-index: 0;
}
```

## 2. HUD INSTRUMENTATION (The "Glass" Profile)
Do NOT use standard cards. Use this exact profile for all floating UI (Search, Stats, Dials).

```tsx
// HUD Component Spec
const GlassHUD = ({ children, position }) => (
  <div className={`fixed ${position} z-50 backdrop-blur-md bg-[#1E2329]/70 rounded-2xl border border-white/5 shadow-2xl p-6`}>
    {children}
  </div>
);
```

### Component Placement:
- **Global Search**: `top-8 left-1/2 -translate-x-1/2`, `min-w-[600px]`.
- **Meta Chips (Left)**: `left-8 top-1/2 -translate-y-1/2` (Vertical Stack).
- **Telemetry (Right)**: `right-8 top-1/2 -translate-y-1/2`.

## 3. SPATIAL CONSTANTS (Three.js / WebGL)
- **Local Origin (0,0,0)**: Render as a Signal Blue (#0030CF) 3D crosshair.
- **Site Boundary**: 1px Signal Blue trace line.
- **Text Rendering**: Force `Space Grotesk` for all numeric coordinates. Force `Inter` for UI labels.

## 4. MCP SYNC PROTOCOL
To bypass implementation "guessing":
1. **Initialize**: Pull the `SpatialObject` interface from `packages/contracts`.
2. **Apply**: Map backend coordinates directly to the billboarded `MetaChip` components.
3. **Verify**: Run `pnpm build` and compare against SCREEN_5 for visual drift.

*Directive: The drawing is the product. Strip the chrome. Execute exactly as spec'd.*