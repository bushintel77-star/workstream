# MASTER REACT IMPLEMENTATION SPEC: GOLD STANDARD 2026 (WORKSTREAM)

## 1. ARCHITECTURAL MANDATE: THE ZERO-CHROME HOOK
All UI components must be implemented as floating HUD elements. Do NOT use standard page containers.

### Global Viewport Reset (Tailwind/CSS)
```css
/* apps/web/src/styles/globals.css */
@layer base {
  body, #root, main {
    @apply overflow-hidden w-screen h-screen bg-[#101418] m-0 p-0 select-none;
  }
}

.canvas-surface {
  @apply absolute inset-0 z-0;
}
```

## 2. COMPONENT ARCHITECTURE: THE GLASS PROFILE
Use this standard pattern for all floating instruments (Search, HUDs, Lenses).

### HUD Base Component
```tsx
// packages/ui/src/components/FloatingHUD.tsx
import React from 'react';

interface HUDProps {
  children: React.ReactNode;
  position: string; // Tailwind positioning classes
}

export const FloatingHUD: React.FC<HUDProps> = ({ children, position }) => (
  <div className={`fixed z-50 backdrop-blur-md bg-[#1E2329]/70 rounded-2xl border border-white/5 shadow-2xl p-6 ${position}`}>
    {children}
  </div>
);
```

### Meta Chip Component
```tsx
// packages/ui/src/components/MetaChip.tsx
export const MetaChip = ({ label, value, status }: { label: string, value: string, status?: 'SAFE' | 'CONFLICT' }) => (
  <div className="flex items-center gap-2 px-3 py-1 bg-surface-bright/20 border border-white/10 rounded-full">
    <span className="text-[10px] font-label-caps text-on-surface-variant">{label}</span>
    <span className={`text-xs font-technical ${status === 'CONFLICT' ? 'text-error' : 'text-primary'}`}>
      {value}
    </span>
  </div>
);
```

## 3. SPATIAL DATA INTEGRATION (Three.js Bridge)
Ensure all React state updates for spatial objects map to the `SpatialObject` schema in `packages/contracts`.

- **Site Origin**: Fixed at `[0,0,0]`. Render as a Signal Blue (#0030CF) helper.
- **Billboarding**: All Meta Chips rendered in the 3D scene must use the `Billboard` component from `@react-three/drei` to ensure they always face the camera.
- **Typography**: 
  - `Space Grotesk`: Use for all numeric, coordinate, and technical data.
  - `Inter`: Use for general UI labels and inputs.

## 4. MCP HANDSHAKE
Initialize the Stitch MCP server in your developer environment to sync these designs directly into your VS Code context.
- **Endpoint**: `http://localhost:31126/mcp`
- **Config**: Set `disabled: false` in `.devin/mcp_config.json`.

*Directive: The drawing is the product. Execute exactly as spec'd.*