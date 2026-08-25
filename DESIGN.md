# DESIGN.md — Limner Canvas Design System

**Status:** Binding. This is the single design reference for the Limner WebGL studio's visual language, chrome architecture, and interaction patterns. If code and this doc disagree, this doc wins until revised.
**Date:** 2026-08-26 (post 2-panel flush architecture pass)
**Companion docs:** `docs/GOLD-STANDARD-2026.md` (supreme brief) · `docs/GOLD-STANDARD-2026-TOKENS.md` (palette) · `docs/PROGRAM-2026-08-25-COMPLIANCE-RENDERING.md` (program waves)

## 1. The Canvas-First Law
The drawing is the product. The canvas shows only four elements, framing the workspace cleanly:

1. **The drawing** — boundary, terrain, trees, features, ink strokes
2. **The Left Dock** — flush, full-height vertical tool rail
3. **The Right Inspector** — flush, full-height data and selection panel
4. **The Top Nav Pill** — frosted-glass floating tabs (Sketch → CAD...)

That's it. Four elements. No floating meta chips, no dimension chips, no viewport HUD. All structural UI is anchored to the edges; all data lives strictly inside the Right Inspector.

## 2. Visual Language — Dark Studio (Tokens)

### Palette
The 2026-08-26 migration moves the chrome to a high-contrast dark grey chassis with opaque glass side panels, explicitly rejecting green accents:

| Token | Value | Role |
| :--- | :--- | :--- |
| `--la-surface` | `#121212` | Main panel chassis (dark grey opaque) |
| `--la-surface-dim` | `#1A1A1A` | Secondary surface / active tool background |
| `--la-surface-muted` | `#2D2D2D` | Hairline borders, dividers |
| `--la-ink` | `#FFFFFF` | Primary text (high-contrast white) |
| `--la-ink-secondary` | `#A3A3A3` | Secondary text |
| `--la-ink-muted` | `#737373` | Labels, hints, inactive tabs |
| `--la-accent` | `#E5E5E5` | Core interactive accent (stark contrast) |
| `--la-highlight` | `#3B82F6` | Selection highlights (clean blue, no green) |
| `--la-error` | `#EF4444` | Destructive actions / conflict alerts |

### Drawing-Data Tokens (Unchanged):
| Token | Value | Role |
| :--- | :--- | :--- |
| `--gs-canvas` | `#0A0A0A` | Canvas base (deep void for drawing pop) |
| `--gs-truth` | `#3B82F6` | Cobalt data stroke (boundaries, title) |
| `--gs-conflict`| `#C41E1E` | Strike alert crimson (conflicts only) |

### Typography & Surfaces
*   **Scale:** `--gs-font-micro` (9.5px) → `--gs-font-xs` (10.5px) → `--gs-font-sm` (11px) → `--gs-font-lg` (13px) → `--gs-font-h2` (18px).
*   **Fonts:** Space Grotesk (Tech/Numeric), Inter (UI Labels), Fraunces (Display), Architects Daughter (Hand).
*   **Depth:** Side panels are strictly opaque (`--la-surface`) with flush hairline borders (`border-right`, `border-left`). The floating Top Nav Pill utilizes frosted glass (`backdrop-filter: blur(12px)`). Shadows are minimized in favor of crisp borders.

## 3. The Right Inspector (Flush Panel)
The unified data panel. Selection-driven: click any entity on the canvas and its full data appears here.

### Position & Size
*   **Position:** Flush to the right window edge. `top: 0`, `bottom: 0`, `right: 0`.
*   **Size:** Fixed width: `320px`, Height: `100vh`.
*   **Scroll:** Independent scrolling body.

### Context Router (Strict Priority)
*Estimates and generic Survey readouts have been stripped from the default view.*
1.  **SELECTION wins** → click a tree/feature/boundary/building → its inspector loads.
2.  **TOOL-ARMED second** → sketch armed → tool settings load.
3.  **EMPTY STATE** → displays only "Inspector: Click a boundary line, building mass, or tree to inspect data."

### Inspector Sections (per entity type)
*   **Placement (tree, asset):** Identity, Dimensions (mature height, canopy radius), Position (world metres).
*   **Feature (drawn shape):** Identity, Material (SKU, depth), Live area/volume.
*   **Boundary:** Geometry (area, perimeter), A2-6 Tree Canopy compliance (provided/required, shortfall).

## 4. The Left Dock (Tool Rail)
A full-height flush panel on the left edge. `left: 0`, `top: 0`, `bottom: 0`, `width: 56px`.
Buttons are arranged vertically, utilizing `--la-surface-dim` for active states.

*   **Core tools:** Sketch ✎ · Measure ⟋ · Assets ❖ · Polyline ⌒ · Area ▱ · Marquee ▭
*   **Site tools:** Tidy ◇ · Trench ≋ · Zones ◎ · Underground ▽ · Dims ↔ · Section ⌐ · Flow ≈ · Earth ◭
*   *Rail clicks write store state — they do NOT change the Right Inspector context unless a tool requires specific settings.*

## 5. Mode Tabs (Top Nav Pill)
`PerimeterTabStrip` — a single floating pill anchored top-center. Frosted glass styling.
*   **Sequence:** Sketch → CAD → Elevation → Garden → Quote → Present → Share.
*   **Behavior:** Progressive unlock logic. No meta tabs, no stats readouts, no save statuses cluttering the pill.

## 6. Interaction Laws
*   **Selection:** Click selects (feature > placement > boundary > building > clear). Shift-click multi-selects. Esc clears. Marquee drag box-selects.
*   **Camera:** 1 Plan (ortho) · 2 Orbit (persp) · 3 Garden (eye-level) · 4 Elevation. Wheel zoom, drag pan, mod-drag orbit.
*   **Keyboard:** `Shift+1..7` → mode switch. `Ctrl+K` → command palette. `Ctrl+Z` → undo.
*   **Chrome Recede:** While the camera moves, the top pill fades to 55% opacity. The flush side panels remain static and opaque.

## 7. Scan-Choreographed Hydration
When site truth lands (import → reload), the reveal runs in categories:
1.  **Cadastre** — title boundary draws on (line opacity 0→1)
2.  **Parcels** — buildings extrude up (scale-Y 0.04→1)
3.  **Services** — easement lines fade in with ant-path dashes
4.  **Terrain** — landform fades in (material opacity)
5.  **Flora** — tree canopies grow as organic masks (scale 0.04→1)

## 8. Accessibility
*   **ARIA Graphics Module:** Canvas root: `aria-roledescription="design drawing canvas"` on `role="application"`.
*   **Keyboard:** Tab reaches all docked panels (no traps).
*   **WCAG 2.2 AA:** All text ≥ 4.5:1 contrast. Non-text boundaries ≥ 3:1.

## 9. What's NOT on the Canvas (Zero-Data Law)
No fabricated visuals for data that doesn't exist:
*   Rock outcrops, overhead power lines, surface utilities — no data source, no render.
*   Building heights — never invented (footprint only unless measured).
*   BYDA underground lines — schema + renderers ready, awaiting hydration.

## 10. Architecture Summary

```text
┌──────┬──────────────────────────────────────────┬──────────┐
│      │                                          │          │
│ Left │           [Sketch][CAD][Elevation][...]  │  Right   │
│ Dock │                                          │  Inspect │
│ 100vh│             The Drawing                  │  100vh   │
│ flush│            (WebGL canvas)                │  flush   │
│      │                                          │          │
│      │                                          │          │
│      │                                          │          │
└──────┴──────────────────────────────────────────┴──────────┘
```

**Files to Update:**

* **Canvas engine:** `WebGLStudio.tsx`
* **Chrome orchestrator:** `WebGLStudioPreview.tsx` (Update layout grid for `100vh` sidebars)
* **Right Inspector:** `UnifiedPanel.tsx` (Remove floating logic, strip default Survey/Quote views)
* **Left Dock:** `StudioToolRail.tsx` (Update to `100vh` column)
* **Mode tabs:** `PerimeterTabStrip.tsx` (Update sequence, apply frosted glass CSS)
