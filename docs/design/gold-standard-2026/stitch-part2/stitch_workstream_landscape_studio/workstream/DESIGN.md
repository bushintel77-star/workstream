---
name: Workstream
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#bb0112'
  on-secondary: '#ffffff'
  secondary-container: '#e02928'
  on-secondary-container: '#fffbff'
  tertiary: '#116231'
  on-tertiary: '#ffffff'
  tertiary-container: '#307b47'
  on-tertiary-container: '#c2ffca'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#ffdad6'
  secondary-fixed-dim: '#ffb4ab'
  on-secondary-fixed: '#410002'
  on-secondary-fixed-variant: '#93000b'
  tertiary-fixed: '#a6f4b5'
  tertiary-fixed-dim: '#8bd79b'
  on-tertiary-fixed: '#00210b'
  on-tertiary-fixed-variant: '#005226'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.02em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  panel-width: 280px
  toolbar-height: 48px
  gutter: 12px
  margin: 16px
---

## Brand & Style
The design system is engineered for landscape architecture professionals who require precision and clarity. It follows a **Modern Corporate/Tool-centric** aesthetic where the UI acts as a neutral frame for the creative work. The interface is high-density and utilitarian, minimizing visual noise to focus on spatial data. 

The emotional response should be one of competence, reliability, and technical rigor. Drawing inspiration from modern CAD and vector design tools, it utilizes a "low-chrome" philosophy: UI surfaces are muted and consistent, while the drawing canvas utilizes a rich, semantic color palette to differentiate between physical materials and project phases.

## Colors
The color architecture is split into two distinct logic systems: **Chrome** and **Canvas**.

### Chrome/Surface
The UI uses a grayscale foundation to stay unobtrusive. 
- **Surface Base:** The default background for panels and navigation.
- **Surface Elevated:** Used for floating toolbars and active modals.
- **Surface Sunken:** Used for input fields and the canvas gutter.
- **Ink:** Primary ink is for high-contrast labels; Secondary for metadata; Tertiary for disabled states or subtle grid lines.

### Plan/Drawing Semantics
Color on the canvas carries functional meaning:
- **Phase Logic:** `Existing` elements use the Crimson family, while `Proposed` designs use Cobalt.
- **Vegetation:** `Retained Planting` is a deep Forest green, while `New Planting` uses a brighter Sprout/Sage palette for visibility.
- **Materiality:** Real-world materials like `Soil`, `Bluestone`, and `Timber` use specific, muted tones to mimic physical samples without being literal textures.

## Typography
The system uses a dual-font approach to balance interface legibility with technical precision.

- **Inter:** The workhorse for all UI elements, navigation, and property panels. It is chosen for its neutral character and excellent legibility at small sizes.
- **JetBrains Mono:** Reserved exclusively for technical data, including coordinates, measurements, scale factors, and CAD-style input. The monospaced nature ensures that numerical values do not shift horizontally as they update during interactions.

Use `label-caps` for section headers within docked panels to create a clear hierarchy in high-density layouts.

## Layout & Spacing
This design system utilizes a **Fixed-Docked Layout** model. 

- **The Canvas:** Centrally located, fluid, and occupies all remaining space.
- **Docked Panels:** Fixed-width (280px) sidebars on the left (Layers/Structure) and right (Properties/Inspect). 
- **Floating Toolbars:** Centered at the top or bottom of the viewport with a fixed 48px height.
- **Grid:** A strict 4px/8px baseline grid is used for all UI components. Component density should be high, with minimal internal padding (typically 8px or 12px) to maximize the visible information in the sidebars.

## Elevation & Depth
Elevation is used sparingly to define functional layers rather than for decoration.

1.  **Canvas (Level 0):** The lowest layer, representing the ground truth of the drawing.
2.  **Docked Panels (Level 1):** Flat, separated by 1px `Ink Tertiary` borders. No shadows are used for docked elements to maintain a clean, integrated look.
3.  **Floating Toolbars & Modals (Level 2):** These use a `Surface Elevated` background and a medium, diffused shadow (15% opacity) to indicate they sit above the drawing workspace.
4.  **Popovers/Tooltips (Level 3):** High-contrast or `Surface Elevated` elements with a tight, crisp shadow to ensure they remain legible over complex drawing geometry.

## Shapes
The system uses a **Rounded** shape language to soften the technical edge of the CAD-like environment. 

- **Standard Radius:** 0.5rem (8px) for buttons, cards, and toolbars.
- **Input Fields:** 0.25rem (4px) for a slightly sharper, more disciplined look within dense property panels.
- **Selection Enclosures:** Canvas selection boxes and bounding boxes should remain at 0px radius to emphasize mathematical precision.

## Components
- **Buttons:** Use `Surface Sunken` for secondary actions and `Primary Color` for the main call-to-action. Buttons in toolbars should be icon-centric with a 32x32px hit area.
- **Input Fields:** High-density design. Labels should be placed inside the field or immediately to the left to conserve vertical space. Use `label-mono` for numerical inputs.
- **Chips:** Small, pill-shaped markers used for tags (e.g., Plant Species, Material Type). Use the semantic palette (e.g., a Sage chip for a "Shrub" tag).
- **Cards:** Used within sidebars to group property sets. They should be border-only (`Ink Tertiary`) with no shadow, unless they are "floating" over the canvas.
- **Property Lists:** Key-value pairs using `Ink Secondary` for keys and `Ink Primary` for values.
- **Toolbars:** Horizontal or vertical strips of icon buttons. Active states should be indicated by a subtle `Surface Sunken` background and a 2px `Primary Color` accent line.
- **Coordinate Bar:** A fixed footer component showing X, Y, Z and Scale using `JetBrains Mono`.