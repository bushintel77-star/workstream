# MCP RECTIFICATION ORDER: 2026 GOLD STANDARD LANDING PAGE

## 1. CORE ARCHITECTURAL VIOLATION
The current implementation in IMAGE_4 and IMAGE_5 is using standard web containers (opaque headers, sidebars, and boxed containers). This violates the **Zero-Chrome** mandate. 

## 2. MANDATORY CSS RESET (apps/web)
Force the following global styles to ensure the canvas is the product:
```css
body, #root { 
  overflow: hidden !important; 
  width: 100vw; 
  height: 100vh; 
  background: #101418; 
  margin: 0;
}
.canvas-container {
  position: absolute;
  inset: 0;
  z-index: 0;
}
```

## 3. HUD REFACTORING (Floating Glass Cards)
Delete all `fixed left-0`, `fixed top-0`, and `w-full` containers. Replace all UI with floating HUD elements using this profile:
- **Surface**: `bg-[#1E2329]/70` (Surface Dim at 70%)
- **Blur**: `backdrop-blur-md`
- **Shape**: `rounded-2xl`
- **Stroke**: `border border-white/5`
- **Shadow**: `shadow-2xl`

### A. Global Search HUD
- **Position**: `fixed top-8 left-1/2 -translate-x-1/2`
- **Width**: `min-w-[600px]`
- **Focus Ring**: `#fbbf24` (Gold Standard)

### B. Acquisition Pipeline HUD
- **Position**: `fixed left-8 top-1/2 -translate-y-1/2`
- **Layout**: A vertical stack of **Meta Chips** (capsules). No background rail.
- **Active State**: Use Gold Standard (#fbbf24) text for verified items.

### C. Site Truth HUD
- **Position**: `fixed right-8 top-1/2 -translate-y-1/2`
- **Typography**: Force `Space Grotesk` for all numeric data (Lat/Long, GPM).

## 4. SPATIAL ANCHORS (Three.js)
- **Local Origin (0,0,0)**: Render as a Signal Blue (#0030CF) 3D crosshair.
- **Site Boundary**: Render as a Signal Blue (#0030CF) trace line.
- **Labeling**: All canvas labels must be billboarded (always face camera) in `Space Grotesk`.

## 5. REJECTION CRITERIA
Any UI that creates a "frame" or "container" around the canvas is a defect. The UI must feel like an instrument floating *over* the drawing.

*Directive: This is a 1:1 rectification order for VS Code/Cursor/Windsurf agents.*