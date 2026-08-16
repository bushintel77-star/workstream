---
name: Zero-Chrome Architectural Canvas
colors:
  surface: '#101418'
  surface-dim: '#131314'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353435'
  on-surface: '#e5e2e2'
  on-surface-variant: '#c6c6cb'
  inverse-surface: '#e5e2e2'
  inverse-on-surface: '#313030'
  outline: '#8f9095'
  outline-variant: '#45474a'
  surface-tint: '#c5c6cc'
  primary: '#ffffff'
  on-primary: '#2e3135'
  primary-container: '#e1e2e8'
  on-primary-container: '#626469'
  inverse-primary: '#5c5e63'
  secondary: '#b7c8e1'
  on-secondary: '#213145'
  secondary-container: '#3a4a5f'
  on-secondary-container: '#a9bad3'
  tertiary: '#ffffff'
  on-tertiary: '#323128'
  tertiary-container: '#e7e2d6'
  on-tertiary-container: '#67645a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e2e8'
  primary-fixed-dim: '#c5c6cc'
  on-primary-fixed: '#191c20'
  on-primary-fixed-variant: '#44474c'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#e7e2d6'
  tertiary-fixed-dim: '#cac6ba'
  on-tertiary-fixed: '#1d1c14'
  on-tertiary-fixed-variant: '#49473e'
  background: '#131314'
  on-background: '#e5e2e2'
  surface-variant: '#353435'
  strike-red: '#ef4444'
  selection-white: '#ffffff'
  glass-border: rgba(255, 255, 255, 0.05)
typography:
  data-display-lg:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  data-display-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  ui-label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  ui-label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.08em
  technical-metadata:
    fontFamily: Space Grotesk
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.02em
  data-display-mobile:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  viewport-margin: 2rem
  hud-padding: 1.25rem
  chip-gap: 0.5rem
  stack-gap: 1rem
---

## Brand & Style
The design system embodies a "Canvas-First" philosophy, specifically engineered for the high-precision world of 2026 architectural drafting. The brand personality is clinical, technical, and hyper-focused, treating the UI as a secondary utility to the physical geometry being designed.

The style is **Minimalist-Glassmorphism** with a heavy emphasis on **Zero-Chrome** principles. UI elements do not occupy dedicated "sidebar" or "header" regions; instead, they exist as floating, ephemeral HUDs that maintain a spatial relationship with the viewport. This evokes a feeling of surgical precision and infinite digital space, where the "drawing is the product" and the interface only appears when contextual relevance is high.

## Colors
The palette is strictly functional, removing all decorative hues (no gold or blue) to prioritize technical clarity.

- **Surface:** The `Deep Charcoal (#101418)` base acts as a void, minimizing eye strain during long drafting sessions and allowing geometry to pop.
- **Primary (Proposed Geometry):** `Bone White (#f8f9ff)` is used for all active drawing lines and newly proposed architectural elements.
- **Secondary (UX Grey):** A professional `UX Grey (#64748b)` is used for non-critical UI labels and inactive technical metadata.
- **Semantic Highlights:** `High-contrast White (#ffffff)` is reserved for active selections and focused states. `Semantic Red (#ef4444)` is strictly gated for **Strike Alerts** and physical conflicts.

## Typography
The system employs a dual-font strategy to distinguish between architectural data and interface navigation.

- **Space Grotesk:** Reserved for technical and spatial data. Its geometric construction mirrors the precision of CAD software. Use it for measurements, coordinates, and large numerical displays.
- **Inter:** Used for UI labels and interactive instructions. It provides a neutral, highly legible contrast to the stylized nature of the spatial data.

All labels should lean towards uppercase or small-caps when used in HUDs to maintain a professional, blueprint-inspired aesthetic.

## Layout & Spacing
This system utilizes a **Full-Bleed Viewport** layout. There are no fixed gutters or traditional grids; instead, the layout is driven by the canvas.

- **HUD Placement:** Interface elements float 32px (`viewport-margin`) from the edge of the screen or are anchored directly to specific geometric points on the canvas.
- **Visual Rhythm:** Spacing between data points within a HUD follows a strict 4px/8px baseline to ensure the technical data looks organized and modular.
- **Responsive Logic:** On mobile, floating HUDs transition from corner-pinned positions to a centralized bottom-docked state to maximize horizontal drawing visibility.

## Elevation & Depth
Depth is created through transparency and optical blurs rather than shadows, simulating a digital head-up display.

- **Floating HUDs:** These utilize `70% opacity` surfaces with `backdrop-blur-md`. This ensures that even when a menu is open, the architectural context beneath it remains partially visible, maintaining the "Drawing as Product" focus.
- **Borders:** Surfaces are defined by ultra-thin `1px` borders (`rgba(255, 255, 255, 0.05)`). This creates a "glass edge" effect that catches light without adding visual bulk.
- **Strike Layer:** Semantic Red alerts bypass the glass effect—they are solid, high-opacity elements that pierce through the HUD layers to command immediate attention.

## Shapes
The shape language is sophisticated and modern, using "Rounded" (`0.5rem`) as the base for most containers to distinguish UI elements from the sharp, often angular architectural geometry.

- **HUD Containers:** Use `rounded-2xl` (`1.5rem`) to create a soft, lens-like appearance for the floating interfaces.
- **Contextual Chips:** Use pill-shaped `rounded-full` geometry to distinguish metadata tags from interactive buttons.

## Components
- **Floating HUDs:** The primary container for tools and data. Must include `backdrop-blur` and a thin white border at low opacity. They should feel weightless.
- **Contextual Meta Chips:** Small, semi-transparent tags that follow the cursor or anchor to lines. Used for real-time measurements (e.g., "1200 SQ FT").
- **Strike Alerts:** High-contrast red banners with a distinct warning icon. These are the only elements allowed to use `#ef4444`.
- **Ghost Inputs:** Text fields for coordinate entry that have no background until focused. Upon focus, they expand into a high-contrast white selection state.
- **Crosshair Cursor:** A custom technical cursor that spans the full height/width of the viewport when in "Draw Mode," reinforcing the CAD-centric nature of the design system.