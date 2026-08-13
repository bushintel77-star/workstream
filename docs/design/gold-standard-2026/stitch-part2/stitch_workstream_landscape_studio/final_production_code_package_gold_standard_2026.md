# 📦 FINAL PRODUCTION HANDOFF: WORKSTREAM GOLD STANDARD 2026 (REACT/TAILWIND)

This is the definitive, consolidated code and spec package for the **Workstream Gold Standard 2026** release. 

## 1. ARCHITECTURAL MANDATE: ZERO-CHROME PROTOCOL
All modules must follow the **Zero-Chrome** mandate. No structural headers, sidebars, or frames. The canvas is 100vw/100vh.

### Global Viewport Enforcement (Tailwind/CSS)
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

## 2. THE PRODUCTION MODULES (FINAL SOURCE)

### 0. STEP 0: SITE TRUTH (Acquisition)
- **Reference**: {{DATA:SCREEN:SCREEN_105}}
- **Logic**: Automated Mapbox acquisition and VicMap data sync.
- **UI**: Floating centered Search HUD and vertical Acquisition Meta-Chips.

### 1. PHASE 1: SKETCH STUDIO (Creative)
- **Reference**: {{DATA:SCREEN:SCREEN_99}}
- **Logic**: Infinite fractal grid with 10-year maturity simulation.
- **UI**: Floating tool ribbon (left) and Lens Dial (right).

### 2. PHASE 2: CAD OPERATOR STUDIO (Technical)
- **Reference**: {{DATA:SCREEN:SCREEN_101}}
- **Logic**: Subsurface utility volumes and strike alert engine.
- **UI**: Contextual technical metadata chips anchored to 3D coordinates.

### 3. PHASE 3: CLIENT PROPOSAL (Intelligence)
- **Reference**: {{DATA:SCREEN:SCREEN_125}}
- **Logic**: Live-synced itemized quotation and hydrological truth.
- **UI**: Interactive presentation lens with floating project health chips.

### 4. PHASE 4: BUILD PACK EXPORT (Handoff)
- **Reference**: {{DATA:SCREEN:SCREEN_126}}
- **Logic**: Compliance-audited contractor package generation.
- **UI**: Lens-filtered export previews and scheduling HUD.

### 5. MOBILE FIELD BRIDGE (AR Bridge)
- **Reference**: {{DATA:SCREEN:SCREEN_97}}
- **Logic**: RTK-precision staking chips (<20mm threshold) and utility ghosting.
- **UI**: 100% camera feed with billboarded spatial telemetry.

## 3. DESIGN TOKENS (STUDIO DARK)
- **Base Surface**: `#101418`
- **Primary Highlight**: `#fbbf24` (Gold Standard)
- **Truth Anchor**: `#0030CF` (Signal Blue)
- **Conflict**: `#ef4444`
- **Fonts**: `Space Grotesk` (Technical), `Inter` (Labels)

## 4. MCP SYNC & BUILD
1. **API Keys**: Populate `STITCH_API_KEY` and `FIGMA_ACCESS_TOKEN`.
2. **Config**: Set `"disabled": false` in `.devin/mcp_config.json`.
3. **Pull**: Run component sync via VS Code/Cursor to ingest these signed-off states.

*Directive: The drawing is the product. Execute exactly as spec'd.*