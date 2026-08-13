# 📜 MASTER ARCHITECTURAL BRIEF: WORKSTREAM GOLD STANDARD 2026

> **SUPREME BINDING DOCUMENT.**
> This document is the highest-authority specification for the Workstream
> operator canvas, chrome, rendering, and product surface. If any other doc,
> code comment, or prior convention contradicts this document, **this document
> wins** until product revises it.
>
> It supersedes (see `docs/archive/pre-gold-standard-2026/`):
> - `STUDIO-STYLING-AND-UX.md`
> - `CAD-AI-2026-UX.md`
> - `OPERATOR-STUDIO-GOLD-WALKTHROUGH.md`
> - `ENV-AND-SITE-META-STICKY.md`
> - `CANVAS-FIRST-*.md` SDS documents
>
> Companion specs (subordinate to this doc):
> - [`GOLD-STANDARD-2026-TOKENS.md`](./GOLD-STANDARD-2026-TOKENS.md) — color + typography token spec
> - [`GOLD-STANDARD-2026-ARCHITECTURE.md`](./GOLD-STANDARD-2026-ARCHITECTURE.md) — WebGL scene-graph + chrome layering

---

## 1. VISION & PHILOSOPHY: "THE DRAWING IS THE PRODUCT"

Workstream is an AI-native, professional workspace for landscape architects. The interface is a **Zero-Chrome** environment where structural UI frames are purged to ensure 100% focus on the spatial truth of the landscape design.

---

## 2. ARCHITECTURAL MANDATES (THE CODE LAW)

- **Viewport**: 100% full-bleed. `overflow: hidden` on root.
- **Canvas**: Absolute `inset-0`. The Three.js/WebGL context is the primary surface.
- **Instruments**: No sidebars or headers. All UI must be floating **Glass Cards** (`bg-[#1E2329]/70`, `backdrop-blur-md`, `rounded-2xl`).
- **Typography**:
  - `Space Grotesk`: Mandatory for technical, numeric, and coordinate data.
  - `Inter`: Mandatory for UI labels, buttons, and inputs.
- **Tokens (Studio Dark)**:
  - **Canvas Base**: `#101418`
  - **Primary (Gold Standard)**: `#fbbf24` (Used for active, compliant, and verified states).
  - **Truth Anchor (Signal Blue)**: `#0030CF` (Used for boundaries, (0,0,0) origin, and easements).
  - **Conflict (Strike Alert)**: `#ef4444` (Used for utility and root zone collisions).

---

## 3. THE WORKFLOW STAGES

### STEP 0: SITE TRUTH (Acquisition)
- **Objective**: Establish the high-precision digital twin.
- **Features**:
  - **Geo-Located Search**: Address input triggers a Mapbox "Fly-To" with 1:1 parcel extraction.
  - **Automated Pipeline**: Staggered extraction of VicMap Survey Data, Title Photos, and Legal Easements.
  - **Local Origin Lock**: Anchor a Signal Blue (0,0,0) crosshair to the primary survey peg.

### PHASE 1: SKETCH STUDIO (Creative)
- **Objective**: Immersive 2D/3D creative drafting.
- **Features**:
  - **Infinity Zoom**: A fractal dot-grid background that maintains rhythm across all zoom levels.
  - **Floating Tool Ribbon**: A minimalist vertical ribbon for professional drafting (Polyline, Curve, Area).
  - **Asset Discovery HUD**: An Apple-style "Fan-Out" carousel for botanical and hardscape libraries.
  - **AI Auto-Placement**: Double-click deployment that "ghosts" assets into positions optimized for solar exposure and root spacing.

### PHASE 2: CAD OPERATOR (Technical)
- **Objective**: Detailed construction documentation and subsurface visualization.
- **Features**:
  - **Vertical Truth**: 3D Tilt and Elevation Slices with high-precision technical annotations.
  - **Subsurface Engine**: 3D volumetric rendering of Gas, Water, and Electrical lines.
  - **Hydrological Pulse**: Live GPM (Gallons Per Minute) and pressure-drop calculations for irrigation and drainage lines.
  - **Strike Alert Engine**: Real-time collision alerts when design geometry intersects utility volumes.

### PHASE 3: CLIENT PROPOSAL (Intelligence)
- **Objective**: Business logic and presentation.
- **Features**:
  - **Presentation Lens**: High-fidelity storytelling mode that hides technical "Spatial Truth" but keeps "Live Intelligence" data.
  - **Itemized Fit-Sheet**: Live-synced quotation and material stock pulse linked to the canvas.
  - **Comparison Lens**: Side-by-side split-view for design iterations.

### PHASE 4: BUILD PACK (Handoff)
- **Objective**: Contractor-ready export.
- **Features**:
  - **Compliance Audit**: Automatic verification of design against local regulatory offsets.
  - **Contractor Bundle**: Generation of high-precision CAD layers and spec sheets.

---

## 4. MOBILE FIELD BRIDGE (On-Site Execution)

- **Environment**: 100% Camera feed with high-precision AR overlay.
- **Staking Logic**: Digital "Staking Chips" (#fbbf24) anchored to physical GPS/RTK ground coordinates.
- **Subsurface Ghosting**: Visualise underground utilities as translucent 3D volumes in the camera feed.
- **Strike Alerts**: High-contrast Red alerts for site workers when digging near verified utilities.

---

## 5. SPATIAL GOVERNANCE & INTEGRATION

- **Data Integrity**: All imported assets must map to the `SpatialObject` TypeScript schema.
- **Hydraulic Isolation**: The (0,0,0) Site Origin must be strictly excluded from active hydraulic run calculations.
- **Billboarding**: All Meta Chips and labels must always face the viewport camera regardless of the 3D tilt.

---

*Directive: The drawing is the product. Strip the chrome. Execute exactly as spec'd.*
