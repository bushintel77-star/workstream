# PRODUCTION DIRECTIVE: WORKSTREAM GOLD STANDARD 2026

## 1. ARCHITECTURAL MANDATE: "THE DRAWING IS THE PRODUCT"
You are implementing the Gold Standard 2026 release. The core requirement is an absolute **Zero-Chrome, Canvas-First** architecture. Any UI that boxes in the viewport or uses standard app headers/sidebars is a defect.

### Viewport Enforcements (apps/web)
Force these global styles to ensure the canvas is the product:
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

## 2. HUD & INSTRUMENTATION (Floating Glass Cards)
Delete all `fixed left-0`, `fixed top-0`, and `w-full` containers. All UI must be floating HUD elements using this profile:
- **Surface**: `bg-[#1E2329]/70` (Surface Dim at 70%)
- **Blur**: `backdrop-blur-md`
- **Shape**: `rounded-2xl`
- **Stroke**: `border border-white/5`
- **Shadow**: `shadow-2xl`
- **Typography**: `Space Grotesk` (Technical/Numeric), `Inter` (Labels/UI)

### Component Layout
- **Global Search**: Floating card at `top-8 left-1/2 -translate-x-1/2`, min-width `600px`, focus ring `#fbbf24`.
- **Acquisition Pipeline**: Vertical stack of **Meta Chips** (capsules) on the far-left. No background rail.
- **Site Truth HUD**: Floating glass card on the right for spatial metadata.

## 3. SPATIAL TRUTH & GOVERNANCE
- **Local Origin (0,0,0)**: Render as a **Signal Blue (#0030CF)** 3D crosshair.
- **Hydraulic Lock**: The (0,0,0) Origin must be strictly excluded from hydraulic run calculations.
- **Site Boundary**: Render as a Signal Blue (#0030CF) 1px trace line.
- **Billboarding**: All canvas labels/HUDs must always face the camera.

## 4. SEMANTIC TOKENS (Studio Dark)
- **Primary Highlight**: `#fbbf24` (Gold Standard)
- **Truth Anchor**: `#0030CF` (Signal Blue)
- **Canvas Base**: `#101418`
- **Conflict/Alert**: `#ef4444`

## 5. REJECTION CRITERIA
- No opaque headers or sidebars.
- No standard "App" frames.
- No generic font substitutions.

*Directive: This is a 1:1 implementation order for VS Code/Cursor/Windsurf. Strip the chrome. The drawing is the product.*