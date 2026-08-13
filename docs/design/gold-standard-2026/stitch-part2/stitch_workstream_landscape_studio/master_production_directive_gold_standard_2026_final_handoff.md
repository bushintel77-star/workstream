# 📦 MASTER PRODUCTION DIRECTIVE: WORKSTREAM GOLD STANDARD 2026

This is the definitive, high-execution production directive for the **Workstream Gold Standard 2026** release. 

## 1. ARCHITECTURAL MANDATE: THE ZERO-CHROME PROTOCOL
"The Drawing is the Product." All UI must be non-intrusive instruments floating OVER the canvas.
- **Full-Bleed Viewport**: `overflow: hidden` on root. Three.js/Mapbox context must occupy 100vw/100vh.
- **Glass Card HUDs**: Use `bg-[#1E2329]/70`, `backdrop-blur-md`, `rounded-2xl`, and `border border-white/5` for ALL UI elements.
- **Typography**: `Space Grotesk` (Technical/Data), `Inter` (UI Labels).

## 2. PRODUCTION SIGNED-OFF SCREENS (Final Selection)
Reference these specific items for the E2E user journey:
1. **Step 0: Site Truth (Landing)**: {{DATA:SCREEN:SCREEN_105}}
2. **Phase 1: Sketch Studio (Creative)**: {{DATA:SCREEN:SCREEN_95}}
3. **Phase 2: CAD Operator Studio (Technical)**: {{DATA:SCREEN:SCREEN_98}}
4. **Phase 3: Client Proposal & Fit-Sheet**: {{DATA:SCREEN:SCREEN_121}}
5. **Phase 4: Build Pack Export (Handoff)**: {{DATA:SCREEN:SCREEN_84}}
6. **Mobile Field Bridge AR**: {{DATA:SCREEN:SCREEN_94}}

## 3. SPATIAL ENGINE & GOVERNANCE
- **Local Origin (0,0,0)**: Anchor as a Signal Blue (#0030CF) 3D crosshair. Exclude strictly from service-line hydraulic calculations.
- **Hydrological HUD**: Implement live GPM (Gallons Per Minute) and pressure-drop calculations on-canvas.
- **Subsurface Volumes**: Render utility lines as 3D volumes with Strike Alerts (#ef4444) on collision.
- **Infinity Zoom**: Implement a fractal dot-grid background that maintains rhythm across all zoom levels.

## 4. TOKEN AUTHORITY (Studio Dark)
- **Canvas Base**: `#101418`
- **Primary Highlight**: `#fbbf24` (Gold Standard)
- **Truth Anchor**: `#0030CF` (Signal Blue)
- **Conflict/Alert**: `#ef4444`

## 5. DEVELOPER SETUP (Windows PC)
- **Repo Sync**: Set `"disabled": false` for the Stitch block in `.devin/mcp_config.json`.
- **API Keys**: Populate `STITCH_API_KEY` and `FIGMA_ACCESS_TOKEN` in `.env` files.
- **Execution**: Initialize the pull via VS Code/Cursor/Windsurf to ingest these React/Tailwind components directly.

*Directive: The design is signed off. Strip the chrome. Execute exactly as spec'd.*