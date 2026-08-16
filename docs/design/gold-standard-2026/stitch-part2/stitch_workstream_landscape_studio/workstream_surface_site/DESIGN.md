---
name: Blueprint Precision
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf2'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef4ff'
  surface-container: '#e5efff'
  surface-container-high: '#dbe9ff'
  surface-container-highest: '#d4e4fa'
  on-surface: '#0d1c2d'
  on-surface-variant: '#444653'
  inverse-surface: '#233143'
  inverse-on-surface: '#e9f1ff'
  outline: '#757684'
  outline-variant: '#c4c5d5'
  surface-tint: '#3d57ba'
  primary: '#00288e'
  on-primary: '#ffffff'
  primary-container: '#2642a5'
  on-primary-container: '#a9b8ff'
  inverse-primary: '#b8c4ff'
  secondary: '#515f74'
  on-secondary: '#ffffff'
  secondary-container: '#d2e1fa'
  on-secondary-container: '#556379'
  tertiary: '#003d1a'
  on-tertiary: '#ffffff'
  tertiary-container: '#1f552f'
  on-tertiary-container: '#8fc898'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c4ff'
  on-primary-fixed: '#001453'
  on-primary-fixed-variant: '#213da0'
  secondary-fixed: '#d5e3fc'
  secondary-fixed-dim: '#b9c7e0'
  on-secondary-fixed: '#0d1c2e'
  on-secondary-fixed-variant: '#3a485c'
  tertiary-fixed: '#b6f1be'
  tertiary-fixed-dim: '#9ad4a3'
  on-tertiary-fixed: '#00210b'
  on-tertiary-fixed-variant: '#1a512b'
  background: '#f8f9ff'
  on-background: '#0d1c2d'
  surface-variant: '#d4e4fa'
  success-zone: '#a6f4b5'
  existing-condition: '#ba1a1a'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-xs:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
  sidebar-tool-width: 64px
  sidebar-data-width: 320px
  header-height: 48px
  footer-height: 56px
---

## Brand & Style
The brand personality is **precise, technical, and professional**, designed for architectural and landscape CAD workflows. It balances a high-utility "tool-first" mentality with a modern, clean aesthetic.

The visual style is **Corporate / Modern** with a strong emphasis on **Tonal Layering**. It mimics a digital drafting board, using a sophisticated cool-neutral palette to reduce eye strain during long working sessions. The design avoids heavy shadows in favor of crisp, low-contrast borders and structured grid alignment, evoking a sense of engineering accuracy and "fidelity."

## Colors
The palette is rooted in **Cadet Blue and Slate Gray**, creating a methodical environment. 
- **Primary:** A deep cobalt (#00288e) used for active states, brand presence, and primary "Promote" actions.
- **Surface System:** Uses a multi-tiered blue-tinted neutral system (`surface-container` to `surface-bright`) to distinguish between the drafting canvas, sidebars, and navigation.
- **Functional Accents:** Tertiary greens are reserved for ecological/permeable data, while a distinct "existing-condition" red is used for site constraints and errors.
- **Canvas:** The main workspace uses a very high-brightness neutral (#f8f9ff) to ensure SVG paths and drafting lines remain legible.

## Typography
The system employs a tri-font hierarchy to separate intent:
- **Hanken Grotesk (Headlines):** Used for structural markers and section titles. It provides a sharp, contemporary feel.
- **Work Sans (Interface/Body):** Used for labels, descriptions, and user input. Its neutral character ensures high readability in dense data panels.
- **JetBrains Mono (Technical/Data):** Crucial for the "Blueprint" aesthetic. Used for measurements, CAD labels, and "Ghost" AI suggestions. It signals "raw data" or "precision" to the user.

## Layout & Spacing
The layout uses a **Composite Fixed-Fluid Model**. 
- **Application Shell:** A fixed top bar and a fixed bottom "Cost Rail" anchor the experience.
- **Workspace:** A three-column split consisting of a fixed Tool Dock (Left, 64px), a Fluid Canvas (Center), and a fixed Data Lane (Right, 320px).
- **Spacing Rhythm:** Based on a 4px grid. Standard vertical separation between sections uses `stack-lg` (32px), while internal component spacing uses `stack-sm` (8px). 
- **Canvas:** The canvas uses a 24px grid pattern background, providing a visual reference for the drafting tools.

## Elevation & Depth
Depth is achieved through **Tonal Layering and Hardscape Shadows** rather than standard soft elevation.
- **Level 0 (Canvas):** `surface-bright`.
- **Level 1 (Panels):** Sidebars and footers use `surface-container` and `surface-container-highest` to appear slightly recessed or structurally distinct from the canvas.
- **Level 2 (Floating Controls):** View controls and menus use `surface` with a 1px `outline-variant` border and a very subtle `shadow-sm` (2px 2px 4px rgba(0,0,0,0.1)).
- **Interactive Layers:** Active tools use high-contrast primary containers to "pop" from the dock.

## Shapes
The system utilizes **Precision Softness**. 
- **Base Components:** Standard buttons and input fields use a tight 0.125rem (2px) radius, maintaining a technical, rectangular feel.
- **Containers:** Side panels and tool buttons use `rounded-lg` (4px) or `rounded-xl` (8px) for a more approachable interactive feel.
- **AI/Special Elements:** AI "Ghost" suggestions and profile avatars use higher roundedness (12px to full) to differentiate "human" or "intelligent" elements from "structural" drafting elements.

## Components
- **Buttons:** Primary buttons are large and high-contrast (Cobalt with White text). Secondary buttons in the tool dock use `surface-container-high` backgrounds with active states indicated by `primary-container`.
- **Tool Dock Buttons:** Square-format 40x40px buttons with `material-symbols` icons.
- **Layer Items:** Interactive list items with visibility toggles. Active layers are indicated by a colored status dot (Primary, Tertiary, or Error) and a subtle border on hover.
- **Bento Metadata Cards:** Used in the data lane to group site stats. These feature a small `label-xs` header and a large `headline-lg-mobile` value.
- **AI Ghost Cards:** Inverse-colored containers (`inverse-surface`) with subtle internal glassmorphism to signify an "overlay" or "suggestion" state.
- **Status Rail:** A high-visibility footer displaying real-time financial data, using bold typography to ensure the "bottom line" is always present.