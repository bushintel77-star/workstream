# CRITICAL AUDIT: ZERO-CHROME RECTIFICATION (ACTION REQUIRED)

## 1. THE "BOXED" DRIFT
The implementation in IMAGE_4 and IMAGE_6 has failed the core architectural mandate. It is using standard web-app structural blocks (sidebars, headers, and footer containers) that "box in" the canvas. In a **Canvas-First** app, these must be purged.

## 2. STRUCTURAL PURGE (CSS/HTML)
- **DELETE**: Any `fixed left-0`, `fixed top-0`, `w-64`, or `w-full` header/sidebar containers.
- **ENFORCE**: 
  ```css
  body, #root { 
    overflow: hidden !important; 
    width: 100vw; 
    height: 100vh; 
    background: #101418; 
  }
  .canvas-container {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
  ```

## 3. THE GLASS HUD PROFILE
Every UI element (Search, Stats, Metadata) must be a floating **Glass Card**. Do not use standard DIVs. Use this exact Tailwind profile:

```tsx
// Apply to ALL UI components
<div className="fixed z-50 backdrop-blur-md bg-[#1E2329]/70 rounded-2xl border border-white/5 shadow-2xl p-6">
  {/* Inner content only */}
</div>
```

## 4. COMPONENT-SPECIFIC RECTIFICATION
- **Global Search**: Must be a single floating card, centered horizontally (`left-1/2 -translate-x-1/2`), positioned at `top: 2rem`. Minimum width `600px`.
- **Acquisition Pipeline**: Must be a vertical stack of floating **Meta Chips** on the left. No background rail.
- **Site Origin (0,0,0)**: Must be rendered as a **Signal Blue (#0030CF)** 3D crosshair with a billboarded label in **Space Grotesk**.
- **Typography**: Force `Space Grotesk` for all numeric/technical metadata. Force `Inter` for UI labels.

## 5. REJECTION CRITERIA
Any UI that creates a "frame" around the canvas is a defect. The UI should feel like an instrument floating *over* the drawing, never a container *around* it.

*Directive: This is a 1:1 rectification order. Strip the chrome. The drawing is the product.*