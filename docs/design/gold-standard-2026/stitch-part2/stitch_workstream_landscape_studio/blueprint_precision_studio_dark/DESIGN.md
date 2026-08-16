---
name: 'Blueprint Precision: Studio Dark'
colors:
  surface: '#101418'
  surface-dim: '#1E2329'
  surface-bright: '#2A3037'
  surface-container-lowest: '#0b0f12'
  surface-container-low: '#181c20'
  surface-container: '#1c2024'
  surface-container-high: '#262a2f'
  surface-container-highest: '#31353a'
  on-surface: '#e0e3e8'
  on-surface-variant: '#d3c5ac'
  inverse-surface: '#e0e3e8'
  inverse-on-surface: '#2d3135'
  outline: '#9c8f79'
  outline-variant: '#4f4633'
  surface-tint: '#f9bd22'
  primary: '#ffe1a7'
  on-primary: '#402d00'
  primary-container: '#fbbf24'
  on-primary-container: '#6c4f00'
  inverse-primary: '#795900'
  secondary: '#bac3ff'
  on-secondary: '#001f90'
  secondary-container: '#0130cf'
  on-secondary-container: '#a8b4ff'
  tertiary: '#b6edff'
  on-tertiary: '#003641'
  tertiary-container: '#34daff'
  on-tertiary-container: '#005c6e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdf9f'
  primary-fixed-dim: '#f9bd22'
  on-primary-fixed: '#261a00'
  on-primary-fixed-variant: '#5c4300'
  secondary-fixed: '#dee0ff'
  secondary-fixed-dim: '#bac3ff'
  on-secondary-fixed: '#00105b'
  on-secondary-fixed-variant: '#002eca'
  tertiary-fixed: '#afecff'
  tertiary-fixed-dim: '#30d8fd'
  on-tertiary-fixed: '#001f27'
  on-tertiary-fixed-variant: '#004e5d'
  background: '#101418'
  on-background: '#e0e3e8'
  surface-variant: '#31353a'
  cloud-mist: '#D7E1EC'
  signal-blue: '#0030CF'
  gold-highlight: '#FBBF24'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.01em
  technical-data:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  sidebar-width: 280px
  toolbar-width: 56px
  gutter: 16px
  margin-safe: 32px
---

## Brand & Style
The design system evolves into a "Gold Standard 2026" aesthetic—a high-precision, CAD-inspired interface tailored for LA’s architectural and design elite. The personality is **authoritative, technical, and hyper-functional**, prioritizing clarity over decorative flair.

The style is **Minimalist-Glassmorphism**. It utilizes a sophisticated "Studio Dark" environment where depth is created through high-precision gradients and semi-transparent HUD (Heads-Up Display) layers rather than physical shadows. This creates a virtual drafting environment that feels like a professional light table, evoking an emotional response of total control and surgical accuracy. Technical metadata is visually sequestered from design geometry through distinct weights and monochromatic treatment, ensuring a clear cognitive boundary between "the work" and "the data."

## Colors
The "Studio Dark" palette is anchored by **Deep Charcoal (#13171B)**, providing a low-strain, high-contrast base for technical drawing. 

- **Primary (Gold Standard):** #FBBF24 is reserved exclusively for primary technical data, critical metrics, and active drafting states.
- **Secondary (Signal Blue):** #0030CF acts as the "site truth" color, representing water elements, fixed boundaries, and immutable site conditions.
- **Neutral System:** A tiered charcoal system ensures UI depth. `surface-dim` creates a recessed effect for background utilities, while `surface-bright` is used for active panel surfaces.
- **Gradients:** Flat containers are replaced by subtle linear gradients (e.g., `surface-bright` to `surface-dim` at 15%) to define boundaries without visual clutter.

## Typography
This system adopts an **architectural type scale** for CAD-like clarity. 

**Space Grotesk** is used for all display and headline roles, providing a geometric, technical rhythm that mirrors structural engineering. **Inter** handles body text for maximum legibility in dense documentation. **JetBrains Mono** is utilized for "Technical Metadata"—measurements, coordinates, and AI-suggested values—to provide a distinct visual weight from design geometry. All labels use uppercase monospaced styling to emphasize their role as "fixed" parameters within the workspace.

## Layout & Spacing
The layout operates on a **Strict Precision Grid** (4px base unit). 

- **HUD Overlays:** Floating data panels utilize a `backdrop-blur-md` and `bg-surface-dim/70` glass system, allowing the design geometry to remain visible beneath technical controls.
- **Canvas-Fluidity:** The main workspace is an infinite fluid canvas with a subtle 32px/4px nested grid pattern.
- **Fixed Infrastructure:** Toolbars and Data Lanes are pinned to the viewport edges. On mobile, sidebars collapse into bottom-sheet HUDs to maintain the 2026 LA UX standards for responsive utility.
- **Metadata Weight:** Metadata is separated by a 16px gutter from the primary drafting tools, ensuring no overlap between interactive controls and purely informational readouts.

## Elevation & Depth
Elevation is expressed through **Optic Translucency** rather than shadows. 

1.  **Base Layer:** Solid `#13171B` workspace canvas.
2.  **Surface Tier:** Subtly tiered containers using 1px `on-surface/10` borders.
3.  **HUD Layer:** Glass containers with 70% opacity and 12px backdrop blur. These layers "float" above the geometry.
4.  **Signal Layer:** The highest hierarchy (active tools/alerts) uses solid `gold-highlight` or `signal-blue` with no transparency, ensuring they pierce through the glass layers.
5.  **Gradients:** Use a `transparent` to `surface-dim/40` linear gradient on large panels to anchor them to the screen edges.

## Shapes
The shape language is **Technical & Rigid**. 

A `rounded-sm` (2px) base is applied to interactive elements to maintain a professional, machined feel. Larger containers and HUD panels use `rounded-lg` (8px) to soften the perimeter of the workspace while maintaining the CAD aesthetic. Circles are reserved strictly for status indicators (Signal Blue for active site points, Gold for data anchors).

## Components
- **Buttons:** Primary technical actions use a solid `Gold Highlight` with black text. Secondary actions use `Glass` backgrounds with white `Space Grotesk` labels.
- **HUD Panels:** Constructed from `bg-surface-dim/70` with a 1px border. They contain nested `technical-data` typography.
- **Inputs:** High-precision input fields use `JetBrains Mono` for value entry, with a 1px `Signal Blue` underline active state.
- **Data Chips:** Small, monospaced chips used for tagging site attributes (e.g., "Permeable", "Existing").
- **Gradients:** Components use non-intrusive base gradients for depth (e.g., a 5% lighten on the top-left of a button) to prevent the UI from looking "flat" while avoiding the bulk of skeuomorphism.
- **Status Rail:** A persistent bottom-edge indicator for project coordinates and financial sums, using a high-precision monospaced font.