# Canvas zoom/pan + styling audit dump

**Repo:** Boringuy7799/workstream  
**Branch context:** `main` (handoff studio Workflow 1)  
**Date:** 2026-07-22  

This dump answers a review brief for the CAD canvas zoom/pan hierarchy and colour tokens. Paste sections as needed.

---

## 0. Verdict summary (read first)

| Question | Answer |
| --- | --- |
| CAD canvas root | `apps/web/src/components/canvas/handoff/HandoffDesignStudio.tsx` |
| Mounted from | `apps/web/src/app/projects/[id]/page.tsx` |
| ONE transform for the drawing? | **Yes** — `.zoomWorld` applies **only** `scale(planZoom)` with `transformOrigin: focusX% focusY%` |
| Separate `translate()` for pan? | **No.** There is **no** view pan offset. `ui.focusX` / `ui.focusY` are zoom **origin**, not a camera translate |
| What does tool `"pan"` do? | Same as `"edit"` on board pointer-down: starts a **marquee selection** in `CadPlanBoard` — does **not** pan the viewport |
| Ruler component? | **None named Ruler.** Metric mesh + edge metre labels live in `TactileGround` (scales with `zoom` + `sheetScaleDenom`) |
| Dark toggle | Functional **canvas ink mode** (`ui.darkOn`), not a system light/dark theme / `prefers-color-scheme` switcher |
| FILL swatches | Hardcoded in `studioCatalog.ts` → `PAINT_SWATCHES` (not the shared UI tokens file) |

---

## 1. Paths / tree

```
apps/web/src/app/projects/[id]/page.tsx          ← mounts HandoffDesignStudio
apps/web/src/components/canvas/handoff/
  HandoffDesignStudio.tsx                       ← shell + zoomWorld JSX + wheel/keys
  handoffStudio.module.css                      ← --hc-* chrome tokens + .zoomWorld
  studioCatalog.ts                              ← BY_TYPE + PAINT_SWATCHES fills
  geometry/
    canvasZoom.ts                               ← zoomFromWheel / ribbon / key
    sheetContentView.ts                         ← fit-sheet scale inside fixed clip
    outdoorClamp.ts                             ← outdoorFocusView (fit)
  features/
    cadPlan/CadPlanBoard.tsx                    ← vectors + pan/edit marquee
    ground/TactileGround.tsx                    ← “ruler” mesh + edge ticks
    ground/groundMetrics.ts                     ← stepM from zoom × denom
    ambient/AmbientRibbon.tsx                   ← In/Out/Fit buttons
    swatchTray/SwatchTray.tsx                   ← Fill strip UI
    sketch/SketchBoard.tsx                      ← Sketch mode (sibling under zoomWorld)
docs/STUDIO-STYLING-AND-UX.md                   ← binding studio chrome guide
docs/CAD-AI-2026-UX.md                          ← CAD–AI UX
packages/ui/src/tokens.ts                       ← product DS tokens (NOT canvas fills)
```

No Figma link in-repo for studio chrome. Design-return template tokens: `docs/templates/design-return/tokens/`. Handoff reference: `docs/design/operator-redesign/design_handoff_landscape_cad_studio/`.

---

## 2. Transform hierarchy (confirm)

```
.root (HandoffDesignStudio)
├── .header                          ← UI chrome — NOT under scale()
├── .board (boardRef)                ← wheel listener target
│   ├── [.sheetPlotClip]?            ← fit sheet ONLY: fixed clipPath, NO transform
│   │   └── .zoomWorld               ← ★ ONE drawing transform: scale(planZoom)
│   │         transformOrigin: planFocusX% planFocusY%
│   │         ├── AerialSlot / TactileGround
│   │         ├── CadPlanBoard
│   │         ├── SketchBoard (mode=sketch)
│   │         ├── Trace / Measure / Zones / …
│   │         └── (no translate for camera)
│   ├── FitSheetOverlay              ← paper frame chrome — sibling, NOT scaled
│   ├── AmbientRibbon / KitAssetDock ← UI floats — sibling, NOT scaled
│   └── SelectionRing / sidecars …
```

**There is one transform container for the drawing (`.zoomWorld`).** UI chrome is outside it. Fit-sheet paper is outside it. There is **no** `translate(x,y)` camera pan on the world.

---

## 3. ZOOM handlers

### 3a. Pure zoom math — `geometry/canvasZoom.ts`

```ts
/**
 * Infinite-feel canvas zoom — multiplicative, pointer-anchored.
 * Practical IEEE floors/ceilings only; no CAD 0.6–2.2 hard stop.
 */

/** Soft floor — whole-site context. */
export const ZOOM_MIN = 0.05;

/** Soft ceiling — detail drafting (effectively unlimited for operators). */
export const ZOOM_MAX = 64;

/** Ribbon In/Out geometric step. */
export const ZOOM_BUTTON_FACTOR = 1.18;

export function clampZoom(z: number): number {
  if (!Number.isFinite(z) || z <= 0) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/** Ambient ribbon still passes ±0.1 — treat any non-zero as one geometric step. */
export function zoomByRibbonDelta(z: number, delta: number): number {
  if (delta === 0) return clampZoom(z);
  const factor = delta > 0 ? ZOOM_BUTTON_FACTOR : 1 / ZOOM_BUTTON_FACTOR;
  return clampZoom(Number((z * factor).toFixed(4)));
}

/** Trackpad / mouse wheel / pinch (ctrl+wheel) — exponential. */
export function zoomFromWheel(z: number, deltaY: number): number {
  const factor = Math.exp(-deltaY * 0.0018);
  return clampZoom(Number((z * factor).toFixed(4)));
}

/** Keyboard + / - geometric step. */
export function zoomByKeyStep(z: number, dir: 1 | -1): number {
  return zoomByRibbonDelta(z, dir);
}
```

### 3b. Wheel → setUi(zoom, focusX, focusY) — `HandoffDesignStudio.tsx`

```tsx
  /**
   * Infinite-feel canvas zoom — wheel / trackpad / pinch over the board.
   * Active on Survey / Sketch / CAD. On the A3/A4 fit sheet, plain wheel
   * owns architectural print scale (FitSheetOverlay) — not world zoom.
   */
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const planMode =
      ui.mode !== "elevation" && ui.mode !== "quote" && ui.mode !== "share";
    if (!planMode) return;
    const onWheel = (e: WheelEvent) => {
      // Fit sheet: plain wheel = 1:N print scale (see FitSheetOverlay).
      if (ui.frameOn) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [data-no-canvas-zoom]")) {
        return;
      }
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const focusX = Math.max(
        0,
        Math.min(100, ((e.clientX - r.left) / Math.max(1, r.width)) * 100),
      );
      const focusY = Math.max(
        0,
        Math.min(100, ((e.clientY - r.top) / Math.max(1, r.height)) * 100),
      );
      studio.setUi({
        focusX: Number(focusX.toFixed(2)),
        focusY: Number(focusY.toFixed(2)),
        zoom: zoomFromWheel(ui.zoom, e.deltaY),
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [studio, ui.frameOn, ui.mode, ui.zoom]);
```

### 3c. Keyboard +/- 

```tsx
      /* Fit sheet: +/- steps 1:N. Else infinite world zoom. */
      if (
        (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") &&
        ui.mode !== "elevation" &&
        ui.mode !== "quote" &&
        ui.mode !== "share"
      ) {
        e.preventDefault();
        if (ui.frameOn) {
          studio.snapSheetScale(
            e.key === "-" || e.key === "_" ? 1 : -1,
          );
        } else {
          studio.setUi({
            zoom: zoomByKeyStep(
              ui.zoom,
              e.key === "-" || e.key === "_" ? -1 : 1,
            ),
          });
        }
        return;
      }
```

Note: keyboard +/- does **not** update `focusX`/`focusY` (origin stays wherever wheel last set it, or fit).

### 3d. Ribbon In/Out/Fit

```tsx
            onZoom={(delta) => {
              if (ui.frameOn) {
                studio.snapSheetScale(delta > 0 ? -1 : 1);
                return;
              }
              studio.setUi({ zoom: zoomByRibbonDelta(ui.zoom, delta) });
            }}
            onFit={() => {
              if (ui.frameOn) {
                studio.setSheetScale(100);
                return;
              }
              if (ui.foundationCleanse) {
                studio.setUi({ sheetScaleDenom: 100 });
              }
              studio.fitOutdoorView();
            }}
```

`fitOutdoorView` → `outdoorFocusView` sets `{ focusX, focusY, zoom }` to frame outdoor remnant.

### 3e. Fit-sheet visual scale (when `frameOn`)

`planZoom` / `planFocus*` come from `sheetContentView`, not `ui.zoom`:

```tsx
  const planZoom = sheetPlotLayout?.view.zoom ?? ui.zoom;
  const planFocusX = sheetPlotLayout?.view.focusX ?? ui.focusX;
  const planFocusY = sheetPlotLayout?.view.focusY ?? ui.focusY;
```

---

## 4. PAN handler — important

### There is no viewport pan translate

Search for camera pan / `translate(${pan` on the world: **absent**.

### Tool `"pan"` on CadPlanBoard = marquee (same as edit)

```tsx
  const onPointerDownBoard = (e: React.PointerEvent) => {
    if (tool === "add" || tool === "paint") {
      // … place …
      return;
    }
    if (tool === "edit" || tool === "pan") {
      const p = toPct(e.clientX, e.clientY);
      dragRef.current = {
        kind: "marquee",
        startX: p.x,
        startY: p.y,
        ox: p.x,
        oy: p.y,
      };
      setMarquee({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
  };
```

Cursor for pan is `grab` via `resolveStudioCursor`, but drag does not move the camera.

**Implication for the “whole canvas moves with the object” bug:** zoom is origin-anchored `scale()` only. Changing zoom without a true pan model makes the drawing appear to slide relative to fixed UI / paper because origin jumps (wheel) or stays pinned to a focus point while scale changes.

---

## 5. Transform CSS + JSX (full)

### 5a. CSS classes — `handoffStudio.module.css`

```css
.zoomWorld {
  position: absolute;
  inset: 0;
  transform-origin: center center;
}

/**
 * Fit sheet — fixed plot window. Clip lives here so world scale cannot drag
 * the printable frame with the drawing.
 */
.sheetPlotClip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.sheetPlotClip > .zoomWorld {
  pointer-events: auto;
}

/** @deprecated — clip must not share a node with transform; use .sheetPlotClip */
.zoomWorldClipped {
  overflow: hidden;
}
```

Inline style supplies the actual transform (CSS class does not set `scale`):

```tsx
        {planOn ? (
          <div
            className={
              sheetPlotLayout
                ? `${css.sheetPlotClip}`
                : undefined
            }
            style={
              sheetPlotLayout
                ? { clipPath: sheetPlotLayout.clipPath }
                : undefined
            }
          >
            <div
              className={css.zoomWorld}
              data-print-keep="plan"
              style={{
                transformOrigin: `${planFocusX}% ${planFocusY}%`,
                transform: `scale(${planZoom})`,
                cursor: studioCursor,
              }}
            >
            <AerialSlot … />
            <ShadeGridOverlay … />
            <CadPlanBoard … />
            {/* SketchBoard when mode === sketch */}
            {/* Trace / Measure / Survey / Zones / … */}
            </div>
          </div>
        ) : null}

        {ui.frameOn && planOn ? (
          <FitSheetOverlay … />   {/* OUTSIDE zoomWorld */}
        ) : null}

        {chrome.ambientRibbon ? (
          <AmbientRibbon … />     {/* OUTSIDE zoomWorld */}
        ) : null}
```

Also CSS var on root for children that counter-scale handles:

```tsx
["--studio-zoom" as string]: String(ui.zoom),
```

(`SelectionHandles` / `ProtractorArc` use `scale(calc(1 / var(--studio-zoom, 1)))`.)

---

## 6. “Ruler” = TactileGround metric mesh

No `Ruler.tsx`. Tick spacing:

```ts
// groundMetrics.ts
export function boardScaleM(sheetScaleDenom: SheetScaleDenom): number {
  return (BOARD_WIDTH_M_AT_100 * sheetScaleDenom) / 100; // 110m @ 1:100
}

export function visibleMetres(
  sheetScaleDenom: SheetScaleDenom,
  zoom: number,
): number {
  return boardScaleM(sheetScaleDenom) / Math.max(ZOOM_MIN, zoom);
}

export function pickMetricStepM(visibleM: number): number {
  if (visibleM < 35) return 1;
  if (visibleM < 70) return 5;
  if (visibleM < 160) return 10;
  if (visibleM < 320) return 25;
  if (visibleM < 700) return 50;
  return 100;
}
```

```tsx
// TactileGround.tsx
  const scaleM = boardScaleM(sheetScaleDenom);
  const visibleM = visibleMetres(sheetScaleDenom, zoom);
  const stepM = pickMetricStepM(visibleM);
  const stepPct = (stepM / scaleM) * 100;
  // major lines every stepPct across 0–100 viewBox
  // edge labels: `${metres} m` at each major tick
```

Ground SVG uses `%` board coords inside `.zoomWorld`, so the mesh **scales with CSS zoom**. Labels are HTML overlays positioned with `%` — also inside the scaled world (via AerialSlot → TactileGround). Edge ticks therefore grow/shrink with the drawing; they are not a fixed viewport ruler.

---

## 7. STYLING / COLOUR TOKENS

### 7a. Live studio chrome tokens — `.root` in `handoffStudio.module.css`

(Authoritative for handoff canvas UI — recently sharpened: matte, no blur halo.)

```css
.root {
  --hc-ink: #241318;
  --hc-ink-muted: #7a5560;
  --hc-ink-faint: #b08a95;
  --hc-paper: #fffbfc;
  --hc-invert: #fff6f8;
  --hc-glass: rgba(255, 251, 252, 0.97);
  --hc-glass-soft: rgba(255, 251, 252, 0.94);
  --hc-line: rgba(36, 19, 24, 0.14);
  --hc-line-soft: rgba(36, 19, 24, 0.1);
  --hc-r-control: 10px;
  --hc-r-panel: 14px;
  --hc-r-dock: var(--hc-r-panel);
  --hc-r-pill: 999px;
  --hc-elev-1: 0 1px 2px rgba(42, 23, 29, 0.1), 0 0 0 1px rgba(36, 19, 24, 0.08);
  --hc-elev-2: 0 2px 6px rgba(42, 23, 29, 0.12), 0 0 0 1px rgba(36, 19, 24, 0.1);
  --hc-elev-3: 0 6px 16px rgba(42, 23, 29, 0.16), 0 0 0 1px rgba(36, 19, 24, 0.12);
  --hc-elev: var(--hc-elev-2);
  --hc-blur: 0px;
  --hc-neu-surface: #f1e4e9;
  --hc-neu-raised: #f6ebef;
  --hc-neu-light: rgba(255, 255, 255, 0.45);
  --hc-neu-shadow: rgba(42, 23, 29, 0.14);
  --hc-neu-out: -1px -1px 2px var(--hc-neu-light),
    1px 1px 3px var(--hc-neu-shadow), 0 0 0 1px rgba(36, 19, 24, 0.08);
  --hc-neu-out-sm: -1px -1px 1.5px var(--hc-neu-light),
    1px 1px 2.5px var(--hc-neu-shadow), 0 0 0 1px rgba(36, 19, 24, 0.08);
  --hc-neu-in: inset 1px 1px 2px var(--hc-neu-shadow),
    inset -1px -1px 1.5px var(--hc-neu-light);

  /* SDS — plan vectors only */
  --sds-canvas-bg: #f6eaed;
  --sds-vector-primary: #241318;
  --sds-vector-muted: #7a5560;
  --sds-compliance-amber: #c99757;
  --sds-compliance-red: #d66b6b;

  background:
    radial-gradient(120% 80% at 8% 0%, rgba(255, 211, 222, 0.22), transparent 55%),
    radial-gradient(90% 70% at 100% 0%, rgba(241, 215, 221, 0.18), transparent 50%),
    var(--sds-canvas-bg);
}

.rootDark {
  background:
    radial-gradient(100% 70% at 10% 0%, rgba(90, 50, 60, 0.35), transparent 50%),
    #161116;
  color: #fff6f8;
}
```

### 7b. Product DS tokens — `packages/ui/src/tokens.ts` (not wired as canvas fills)

```ts
export const tokens = {
  color: {
    surface: {
      base: "#F3ECEF",
      elevated: "#FFF9FB",
      sunken: "#E8DFE4",
      inverted: "#1A1218",
    },
    ink: {
      primary: "#1A1218",
      secondary: "#5C4A52",
      tertiary: "#8A7580",
      inverted: "#FAF4F6",
    },
    // …
    accent: {
      default: "#D4849A",
      soft: "#F7DCE4",
      ink: "#7A3348",
      bright: "#F0B4C4",
    },
  },
  // …
};
```

### 7c. FILL panel swatches — hardcoded in `studioCatalog.ts`

```ts
/** Fillable hardscape / softscape for the Paint swatch strip. */
export const PAINT_SWATCHES: Array<{
  t: StudioItemType;
  label: string;
  wash: string;
}> = [
  { t: "lawn", label: "Turf", wash: "rgba(74, 112, 58, 0.55)" },
  { t: "bed", label: "Planting", wash: "rgba(90, 122, 72, 0.5)" },
  { t: "paving", label: "Bluestone", wash: "rgba(70, 78, 88, 0.55)" },
  { t: "deck", label: "Deck", wash: "rgba(140, 98, 58, 0.5)" },
  { t: "hedge", label: "Hedge", wash: "rgba(52, 92, 48, 0.55)" },
];
```

Catalog geometry sizes / rates for those types live in `BY_TYPE` in the same file (no hex fills there — paint wash is separate).

Rendered by `features/swatchTray/SwatchTray.tsx` consuming `PAINT_SWATCHES`.

### 7d. Dark mode / sun-moon

- Top bar control: `data-testid="dark-canvas-top"`, moon path SVG, toggles `ui.darkOn`.
- Applies `css.rootDark` on the studio root + propagates `darkOn` into CadPlan / Sketch / ground.
- **Not** a document-level theme and **not** tied to `prefers-color-scheme` class switcher (workspace rule: dark mode is prefers-color-scheme for app shell; studio uses this local `darkOn` flag).
- Separate **SunGrowthDock** is sun-study time-of-day (shade), not the theme toggle.

```tsx
onClick={() => studio.setUi({ darkOn: !ui.darkOn })}
```

---

## 8. Style / product docs (existing)

| Doc | Role |
| --- | --- |
| `docs/STUDIO-STYLING-AND-UX.md` | **Binding** handoff chrome (neumorphic docks, matte panels, zoom table) |
| `docs/CAD-AI-2026-UX.md` | CAD–AI disappearing interface |
| `docs/CANVAS-FIRST-UX.md` | Canvas-first product |
| `docs/design/operator-redesign/design_handoff_landscape_cad_studio/README.md` | Handoff fidelity / colours from prototype |
| `packages/ui/src/tokens.ts` | App DS 3.0 |
| `docs/templates/design-return/tokens/` | Template token pack |
| Figma | **No** studio Figma URL checked into this dump |

---

## 9. State fields (zoom-related)

From `studioTypes` / `useStudioState` UI:

- `zoom: number` — world CSS scale (non–fit-sheet)
- `focusX`, `focusY` — `%` transform-origin for that scale
- `sheetScaleDenom: 50 | 100 | 200 | 250 | 500` — print ladder + ground metrics
- `boardWidthM?: number` — calibration override for metres
- `frameOn` — fit sheet; swaps to `sheetContentView` for display scale
- `darkOn` — canvas dark ink mode

---

## 10. Likely review hooks (for the next agent)

1. Add real camera pan: `translate(panX, panY) scale(zoom)` on `.zoomWorld` (or separate pan layer), wire tool `"pan"` + middle-mouse / space-drag.
2. Or keep origin-zoom but stop calling it pan; rename tool and implement view-pan separately.
3. Unify fill washes into `--hc-*` / `--sds-*` tokens instead of `PAINT_SWATCHES` literals.
4. Viewport-fixed ruler (outside `.zoomWorld`) if edge metres must stay screen-stable.

---

*End of dump.*
