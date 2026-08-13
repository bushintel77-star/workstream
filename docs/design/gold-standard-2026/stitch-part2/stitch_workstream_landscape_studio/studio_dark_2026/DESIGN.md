---
name: Studio Dark 2026
colors:
  surface: '#101418'
  surface-dim: rgba(30, 35, 41, 0.7)
  surface-bright: '#363a3e'
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
  tertiary: '#ffdcd9'
  on-tertiary: '#68000a'
  tertiary-container: '#ffb6b0'
  on-tertiary-container: '#aa091b'
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
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#101418'
  on-background: '#e0e3e8'
  surface-variant: '#31353a'
  border-glass: rgba(255, 255, 255, 0.05)
  truth-anchor: '#0030cf'
  conflict-red: '#ef4444'
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
    fontFamily: Space Grotesk
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  gutter: 16px
  margin: 32px
  sidebar: 280px
  toolbar: 56px
---

## Brand & Style
The design system is a high-fidelity, "Studio Dark" architectural canvas designed for the 2026 Workstream release. It targets landscape architecture and CAD environments, where precision, technical authority, and visual focus are paramount. 

The aesthetic is a hybrid of **Minimalism** and **Glassmorphism**. It creates a "zero-chrome" environment where the UI recedes to prioritize the design geometry. Depth is achieved not through traditional shadows, but through backdrop blurs, translucent layers, and high-precision borders. This evokes a sense of "surgical accuracy" and professional control, transforming the screen into a digital light table for architectural drafting.

## Colors
The palette is built upon a **Deep Charcoal (#101418)** base to minimize eye strain during long drafting sessions. 

- **Primary (Gold Standard):** #FBBF24 is the high-visibility highlight for active states, compliant data, and primary technical anchors.
- **Secondary (Signal Blue):** #0030CF functions as the "Site Truth," used for water features, immutable boundaries, and structural constraints.
- **Tertiary (Semantic Red):** #EF4444 is reserved strictly for conflicts, errors, and out-of-bound structural tolerances.
- **Surface Strategy:** Layouts use `surface-dim` with transparency for HUD elements. This allows the architectural canvas to remain partially visible beneath the interface layers.

## Typography
The typographic system mirrors architectural notation. **Space Grotesk** is utilized for all technical coordinates, display headings, and UI labels, providing a geometric, structured rhythm. **Inter** is reserved for multi-line body text and documentation to ensure maximum legibility at smaller scales. 

A specific `technical-data` role is defined for measurements and AI-driven metrics. All functional UI labels should use the `label-caps` style (uppercase Space Grotesk) to distinguish them from user-generated content and project data.

## Layout & Spacing
The layout follows a **Strict Precision Grid** based on a 4px increment. 

- **The Canvas:** A fluid, infinite workspace featuring a subtle background grid (32px major lines, 4px minor lines).
- **HUD Panels:** Floating "Glass Cards" are used for tools and data readouts. These do not push content but hover over the canvas.
- **Responsive Behavior:** On desktop, technical sidebars are fixed at 280px. On mobile devices, these panels reflow into bottom-anchored "Drawers" to maintain maximum horizontal visibility for the landscape drawings.
- **Gutters:** A standard 16px gutter is maintained between all floating HUD elements to prevent visual crowding.

## Elevation & Depth
Hierarchy is expressed through **Optic Translucency** and layer stacking rather than traditional ambient shadows:

1. **Canvas (Base):** Solid Deep Charcoal.
2. **Sub-surface:** Slightly darker recessed areas for background utility trays.
3. **Floating HUD Layer:** Uses `backdrop-blur-md` with 70% opacity. This creates a frosted-glass effect that maintains context of the drawing beneath it.
4. **Interactive Layer:** 1px white borders at 5% opacity (`border-white/5`) define the edges of glass panels.
5. **Active Signal Layer:** The highest elevation level uses solid, opaque Gold or Blue to "pierce" through the glass layers, indicating the current focus.

## Shapes
The shape language is **Technical and Machined**. 

Standard interactive components (buttons, inputs) use a 0.5rem (8px) radius to feel modern yet precise. Large architectural HUD panels and floating cards use a `rounded-2xl` (1.5rem) radius to clearly distinguish the interface from the sharp-edged CAD geometry it controls. Status indicators for "Site Points" are kept as perfect circles to denote specific coordinate anchors.

## Components
- **Primary Buttons:** Solid `Gold Standard` (#FBBF24) with black text. These are reserved for destructive or final technical confirmations.
- **Glass Buttons:** Semi-transparent backgrounds with 1px borders, used for persistent drafting tools.
- **Input Fields:** Minimalist design using `technical-data` typography. Active fields are highlighted with a `Signal Blue` underline.
- **Floating HUDs:** The signature component; panels with `backdrop-blur-md` and `rounded-2xl` corners containing technical readouts.
- **Status Rail:** A high-precision bar at the bottom of the viewport using monospaced characters for real-time coordinate and financial tracking.
- **Data Chips:** Small, low-profile tags used for classifying site attributes like "Vegetation" or "Existing Structure," using `label-caps` typography.