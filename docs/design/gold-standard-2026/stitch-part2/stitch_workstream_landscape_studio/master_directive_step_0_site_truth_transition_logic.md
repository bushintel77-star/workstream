# MASTER DIRECTIVE: STEP 0 SITE TRUTH TRANSITION & PIPELINE LOGIC

## 1. OBJECTIVE
Implement the end-to-end "Step 0: Site Truth" acquisition flow. This covers the transition from global coordinate entry to high-precision digital twin isolation.

## 2. THE TRANSITION PIPELINE (Logic States)

### STATE A: GLOBAL SEARCH (Entry)
- **Component**: `SiteTruthLanding.tsx`
- **Logic**: Initialize Mapbox GL context at `zoom: 2`.
- **UI**: Floating search bar (Glass Card) with Gold Standard (#fbbf24) focus ring.
- **Trigger**: On address selection, fly camera to coordinates and transition to STATE B.

### STATE B: ACQUISITION & EXTRACTION (Pipeline)
- **Component**: `AcquisitionHUD.tsx`
- **Visuals**: Render a circular 'Scanning' volume over the target parcel using a custom Three.js shader.
- **Telemetry**: Display a vertical progress stack of "Meta Chips":
  - `[CHECK] Parcel Boundary Extraction`
  - `[LOAD] VicMap Survey Data`
  - `[LOAD] Title Photo Capture`
  - `[SYNC] Legal Easements`
- **Timing**: Use a staggered reveal (300ms intervals) for the chips to simulate deep-data retrieval.

### STATE C: SITE ISOLATION (Refinement)
- **Component**: `SuburbanSiteTruth.tsx`
- **Logic**: Desaturate all non-parcel geometry to 'UX Grey' (#2A3037).
- **HUD**: Switch from Global Search to the "Site Truth HUD" surfacing:
  - **Lat/Long**: High-precision technical label.
  - **Aspect**: Solar orientation indicator.
  - **Status**: "Spatial Truth Secured" (Signal Blue #0030CF).

## 3. TECHNICAL SPECIFICATIONS

### VIEWPORT & CAMERAS
- **Zero-Chrome**: All transitions must happen within the 100vw/100vh WebGL context.
- **Camera Hydraulic**: Use `tween.js` or `react-spring` for the "Fly-to-Zoom" transition to ensure a professional, weighted feel.
- **Background**: Maintain the fractal dot-grid at all zoom levels, scaling its opacity relative to camera height.

### SEMANTIC TOKENS (Studio Dark)
- **Active Extraction**: `#fbbf24` (Gold Standard)
- **Verification Lock**: `#0030CF` (Signal Blue)
- **Isolation Background**: `#101418` (Surface)
- **Font**: `Space Grotesk` (Technical Metadata), `Inter` (UI Labels)

## 4. EXECUTION CHECKLIST
1. **Wire Pipeline**: Connect `useSiteAcquisition()` hook to the `AcquisitionHUD` chip states.
2. **Implement Shaders**: Ensure the 'Scanning' volume shader respects the parcel boundary polygon.
3. **Handle Transitions**: Map the `onAcquisitionComplete` callback to the `resolveCanvasMode` logic to switch the Lens Dial to 'Sketch' mode.
4. **Harden Origin**: Anchor the (0,0,0) Local Origin to the primary survey peg identified during extraction.

*Directive: Finalize this flow to ensure Step 0 transitions seamlessly into the professional Sketch environment.*
