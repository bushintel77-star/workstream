---
name: Studio Workstream
colors:
  surface: '#faf9f5'
  surface-dim: '#dbdad6'
  surface-bright: '#faf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4f0'
  surface-container: '#efeeea'
  surface-container-high: '#e9e8e4'
  surface-container-highest: '#e3e2df'
  on-surface: '#1b1c1a'
  on-surface-variant: '#454842'
  inverse-surface: '#2f312e'
  inverse-on-surface: '#f2f1ed'
  outline: '#767872'
  outline-variant: '#c6c7c0'
  surface-tint: '#5d5f5a'
  primary: '#171916'
  on-primary: '#ffffff'
  primary-container: '#2c2e2a'
  on-primary-container: '#949590'
  inverse-primary: '#c6c7c1'
  secondary: '#59614f'
  on-secondary: '#ffffff'
  secondary-container: '#dde6cf'
  on-secondary-container: '#5f6755'
  tertiary: '#2a1209'
  on-tertiary: '#ffffff'
  tertiary-container: '#42261c'
  on-tertiary-container: '#b48b7d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e3e3dd'
  primary-fixed-dim: '#c6c7c1'
  on-primary-fixed: '#1a1c19'
  on-primary-fixed-variant: '#454743'
  secondary-fixed: '#dde6cf'
  secondary-fixed-dim: '#c1c9b4'
  on-secondary-fixed: '#171e10'
  on-secondary-fixed-variant: '#424939'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#eabcad'
  on-tertiary-fixed: '#2d150c'
  on-tertiary-fixed-variant: '#5f3f34'
  background: '#faf9f5'
  on-background: '#1b1c1a'
  surface-variant: '#e3e2df'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 56px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 32px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  technical-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-edge: 40px
  stack-xs: 8px
  stack-md: 24px
  stack-xl: 64px
---

## Brand & Style
The design system moves away from industrial utility toward the refined, tactile world of a high-end landscape architecture studio. The brand personality is scholarly yet creative, prioritizing the "craft-first" ethos of a boutique practice over the cold efficiency of government infrastructure.

The visual style is **Modern Minimalism** with **Tactile/Skeuomorphic** nuances—specifically mimicking the physical materials of the architect's desk: heavy vellum, translucent tracing paper, and graphite. The "Zero-Chrome" mandate is executed through a UI that feels like an overlay on a bespoke plan, where every element exists as a precise instrument rather than a standard software component.

## Colors
The palette is rooted in organic, architectural materials rather than digital light. 

- **Primary (Charcoal):** Used for precision linework and primary text, mimicking 0.5mm graphite.
- **Secondary (Sage):** A muted, earthy green used for landscape elements, biological markers, and subtle success states.
- **Tertiary (Clay):** A warm, terracotta-adjacent tone used for highlights, manual annotations, and points of interest.
- **Neutral (Bone/Vellum):** The foundation of the UI. Instead of pure white, we use a warm Bone-white (`#F9F8F4`) to simulate heavy paper stock.
- **Surface (Tracing Paper):** Layers are created using high-transparency whites with backdrop blurs to simulate the stacking of translucent sheets.

## Typography
The typographic hierarchy creates a tension between editorial elegance and technical precision.

- **Headlines:** Use **Libre Caslon Text**. This high-contrast serif provides the authoritative, "Studio" feel of a professional practice. It should be used sparingly for page titles and significant section headers.
- **Body:** **Hanken Grotesk** offers a contemporary, clean sans-serif experience that remains legible and professional for long-form descriptions or notes.
- **Technical Data:** **JetBrains Mono** is reserved for coordinates, measurements, and metadata. It reinforces the "precision instrument" aesthetic of the tool.

## Layout & Spacing
The layout follows a **Fluid Grid** model with generous margins to evoke the feeling of a wide-format architectural plot. 

- **The Drawing Board:** The main content area should feel unconfined. Use a 12-column grid for desktop, but allow elements to "break" the grid slightly to mimic hand-placed sketches.
- **Rhythm:** Use a 4px baseline shift. Spacing between major elements should be expansive (`stack-xl`) to prevent the interface from feeling cluttered or "utilitarian."
- **Mobile:** Transition to a 4-column grid with 16px margins. Complex technical data should be hidden behind "Detail" drawers to maintain a clean aesthetic.

## Elevation & Depth
In alignment with the "Zero-Chrome" mandate, elevation is not achieved through shadows, but through **material stacking**.

- **Level 0 (The Site):** The base vellum (`#F9F8F4`).
- **Level 1 (The Trace):** Semi-transparent white layers (`rgba(255, 255, 255, 0.6)`) with a 12px backdrop blur. This simulates physical tracing paper laid over the site.
- **Level 2 (The Annotation):** Elements that sit atop the trace use thin, 0.5px Charcoal borders.
- **Depth:** Instead of shadows, use "Micro-offsets." An element might have a 1px Clay-colored border on the bottom and right edges only to suggest a slight physical thickness.

## Shapes
Shapes are "Architecturally Soft." We avoid the clinical sharpness of 0px corners but also the bubble-like roundness of consumer apps. 

A standard **0.25rem (4px)** radius is applied to buttons and inputs. This mimics the slightly worn edge of a physical drawing board or the corner of a cut sheet of paper. Organic forms, such as site foliage or water bodies, should use hand-drawn, imperfect vector paths rather than perfect geometric circles.

## Components
Consistent styling across components reinforces the "Studio" aesthetic.

- **Buttons:** Low-profile. Text-only or with a 0.5px border. The "Primary" button uses a Charcoal fill with Bone text. The "Secondary" button is transparent with a thin Sage outline.
- **Inputs:** A single bottom border in Charcoal, mimicking a line drawn for a caption. On focus, the label shifts to the `label-caps` style in Clay.
- **Cards:** No shadows. Use the "Tracing Paper" style (translucency + blur) with a 1px Bone-white border to separate them from the background.
- **Chips/Labels:** Use the `technical-sm` Monospace font. They should look like stamped annotations from a drafting kit.
- **Plant Icons:** Represented as monochrome, elegant outlines (Sage or Charcoal). They should look like hand-sketched botanical symbols rather than flat digital icons.
- **Precision Sliders:** Use thin lines and a simple crosshair (`+`) as a thumb, evoking a sighting tool or a scale ruler.