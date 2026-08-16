# PRODUCTION RECTIFICATION: SITE TRUTH LANDING (FIX-01)

## 1. CRITICAL ERROR: "BOXED CONTAINMENT"
The current build (IMAGE_4) is failing the Zero-Chrome mandate. It uses standard opaque containers and fixed layout blocks. This must be purged immediately.

## 2. CSS RESET & VIEWPORT
- **Root**: `body, #root { overflow: hidden; background: #101418; width: 100vw; height: 100vh; }`
- **Canvas**: The Mapbox/Three.js container MUST be `position: absolute; inset: 0; z-index: 0;`.

## 3. GLASS HUD: STRUCTURAL RULES
Every UI element (Search, Acquisition, HUD) MUST follow this structural pattern. Do not use standard sidebars or headers.

```tsx
// Pattern for all floating elements
<div className="fixed z-50 backdrop-blur-md bg-[#1E2329]/70 rounded-2xl border border-white/5 shadow-2xl">
  {/* Content */}
</div>
```

## 4. COORDINATE & ORIGIN GOVERNANCE
- **Local Origin (0,0,0)**: Must be rendered as a Signal Blue (#0030CF) 3D crosshair.
- **Search HUD**: Centered horizontally at `top: 2rem`. Minimum width `600px`. Focus ring must be Gold Standard (#fbbf24).
- **Meta Chips**: Use `rounded-full px-3 py-1 bg-surface-bright/20 border border-white/10` for secondary data (Lat/Long, Status).

## 5. REFINEMENT CHECKLIST
1. [ ] **Delete** all `fixed left-0`, `fixed top-0`, and `w-full` header/sidebar containers.
2. [ ] **Implement** the Floating Search Card as a standalone component.
3. [ ] **Map** Space Grotesk to all numeric/technical strings.
4. [ ] **Layering**: Ensure the canvas is the absolute bottom layer, with UI instruments floating precisely in the Z-space.

*Directive: This is a rectification order. Remove all "App" UI frames. The drawing is the product.*
