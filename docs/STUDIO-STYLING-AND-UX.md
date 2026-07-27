# Studio styling and UI/UX logic (binding)

**Status:** Binding for `HandoffDesignStudio` and all operator canvas chrome.  
**Audience:** Agents and humans implementing or restyling the drawing surface.  
**Companions:** [CAD-AI-2026-UX.md](./CAD-AI-2026-UX.md) · [CANVAS-FIRST-UX.md](./CANVAS-FIRST-UX.md) · [DESIGN-KIT-INVENTORY.md](./DESIGN-KIT-INVENTORY.md) · [AI-CAD-DESIGN-LIBRARY.md](./AI-CAD-DESIGN-LIBRARY.md)

If a change contradicts this document, **this document wins** until product revises it.

---

## 0. One-sentence product law

The **drawing is the product**. Chrome is frost glass that **appears when needed**, never a fixed opaque slab parked on the plan.

---

## 1. Visual tokens (v2 neutrals + `--hc-*` chrome API)

**Plan / CAD geometry** and **studio chrome** both derive from [COLOR-TOKENS.md](./COLOR-TOKENS.md) (`color-tokens.css` v2). Light `--hc-*` on `.root` are **aliases** of v2 (`--canvas`, `--panel`, `--text-*`, `--border*`, `--warning` / `--danger` / `--success`). Blush pink DNA is retired for light chrome.

| Role | Token | Light source |
| --- | --- | --- |
| Field / page | `--canvas` / `--sds-canvas-bg` | `--gray-l-50` |
| Panel / dock plastic | `--hc-neu-surface` | `--panel` |
| Raised chip | `--hc-neu-raised` | `--gray-l-25` |
| Frost glass | `--hc-glass` / `--hc-glass-soft` | `color-mix` on `--gray-l-0` |
| Ink | `--hc-ink` | `--text-primary` |
| Muted / faint | `--hc-ink-muted` / `--hc-ink-faint` | `--text-secondary` / `--text-muted` |
| Lines | `--hc-line` / `--hc-line-soft` | mix of `--text-primary` |
| Status | `--hc-warning` / `--hc-danger` / `--hc-success` | `--warning` / `--existing-stroke` / `--planting-new-stroke` |
| Fit sheet plate | `--sheet-paper` / `--sheet-ink` / `--sheet-border` | sheet tokens on `.root` |
| Elevation | `--hc-elev-*` | soft ink shadow, not slate |

**Fonts:** Fraunces (display where used) · Sora (UI) · IBM Plex Mono (meta / CAD labels).

### Forbidden looks

- Blush pink page wash / umber ink palette as light chrome (`#f1e4e9`, `#ffd3de`, `#241318`)
- Hardcoded `#hex` / raw `rgba` in handoff modules (use `var(--hc-*)` / v2; CI gate `check-handoff-chrome-colors.mjs`)
- Dark slate glass as the light default; purple-on-white / glow / multi-layer neon shadows
- Sepia / stained board as the default canvas (print plate uses `--sheet-*` only)
- Opaque solid panels that read as a second app chrome bar on the canvas
- Game language: loadout, hotbar, equip, bag tabs as combat UI

### Dock control language (binding)

Micro controls share one **neumorphic soft-plastic** language with the left
swatch rail — not a second frost/glass dialect:

| Surface | Treatment |
| --- | --- |
| Left swatch rail, header icon/tool chips, instruments hub & draft tools, autosave chip | `--hc-neu-raised` + `--hc-neu-out-sm`; armed/pressed = `--hc-neu-in` |
| Large summoned panels (Layers, inventory popup, pointer sheet) | Soft frost `--hc-glass` + `--hc-elev-*` |
| Control size | ~40–46 px dock chips (match left rail width) |

Do not mix flat glass chips in the header with plastic chips on the left rail.

### Glass rule

Large floating panels must read as **frost**, not drywall.

- Prefer `--hc-glass-soft` + `backdrop-filter` for popups and docks.
- Large surfaces must not sit at near-solid opacity (avoid `0.94+` full-width bars).
- Idle / rest chrome fades toward transparent; engaged chrome may strengthen briefly.
- Micro dock buttons use neumorphic plastic (see above), not glass.

---

## 2. UI/UX architecture (disappearing interface)

| Layer | Owns | Default state |
| --- | --- | --- |
| Drawing plane | Boundary, building, symbols, TPZ, measures on-plan | Always on |
| Object orbit | Delete / Lock / Ask AI / deselect | Only when selected; **outside** the glyph |
| Summoned instruments | Draft tools, measure, zoom, undo | **Hidden** until margin summon / tool arm |
| Inventory popup | Fold-out library: search + Draft kit + catalog categories | **Hidden** until Add / Paint / explicit open |
| Structure rail (left) | Layers / constraints | Collapsed; gated by `structureRail` |
| AI sidecar (right) | Utility, live measures, dialogue | Collapsed; gated by `aiSidecar` |
| Fit / focus / client / foundation | Paper-first | Almost all floats off |

Progressive disclosure is owned by `resolveHandoffChrome` (`state/handoffChrome.ts`).

### Camera parenting (binding)

`.zoomWorld` / `[data-testid="zoom-world"]` is the **geometry camera only**
(`translate` → `rotate` → `scale`). It must not parent frosted UI.

| May live under `.zoomWorld` | Must NOT |
| --- | --- |
| Vectors, symbols, ink strokes, aerial imagery, mesh | Toolbars, banners, menus, badges, hints, checklists, HUD docks |
| World-space drafting feedback marked `data-plan-geometry` (marquee, snap guides) | Anything stamped `data-camera-chrome` |
| TPZ hit rings sized in `%` | TPZ pop/tag chrome, Accept/Reject, readouts |

**Mandatory API:** `CameraChrome` in `apps/web/src/components/canvas/handoff/CameraChrome.tsx`.

- Dock chrome: `place={{ kind: "dock" }}` — portals to
  `[data-testid="camera-chrome-root"]` (sibling of `.zoomWorld`).
- Selection-anchored chrome: `place={{ kind: "project", pct, cam }}` — portals +
  projects board `%` through `boardPctToClientOffset` (no `scale(1/--studio-zoom)`).
- Every `CameraChrome` stamps `data-camera-chrome="1"`.
- Do **not** portal into `studio-board` itself when the call site is a descendant
  of the board — React can reparent children and drop the stamped wrapper.

**Detector (gate C):** `e2e/canvas-chrome-detector.spec.ts` fails if any
`[data-camera-chrome]` node is found under `[data-testid="zoom-world"]`.

Do **not** “fix” chrome zoom by counter-scaling inside the camera — pan and
view-rotate still leak.

### Summon logic (instruments)

1. Empty click **off the lot** (canvas margin) → pin instrument anchor + summon ribbon.
2. Empty click **on the lot** → clear selection only (does **not** summon tools).
3. Selecting geometry does **not** summon instruments.
4. After linger with no hover → dismiss (`instrumentsSummoned = false`). No sticky hub when dismissed.

### Inventory logic (plants / swatches / library)

Inventory is **not** a fixed bottom bar and **not** a radial menu centred on the object.

| Must | Must not |
| --- | --- |
| Pop up when Add / Paint is armed, or when the operator opens Library | Stay fixed and always overlay the drawing |
| Use soft frost glass | Use opaque full-width slabs |
| Sit at the **instrument summon point** (gutter / margin), clear of the glyph | Sit on top of the selected object |
| Include Soft / Hard / Trees / Water drafting chips | Dump every swatch in one flat ring on the object |
| Expose open-source Library (Curtis gold, Osmic, PlanZV, Wikimedia) behind a Library peel | Hide the design library in Settings only |
| Linger, then disappear when disengaged | Remain after the operator returns to pan / idle |

Open-source packs: [AI-CAD-DESIGN-LIBRARY.md](./AI-CAD-DESIGN-LIBRARY.md), [OPEN-CROP-ICONS.md](./OPEN-CROP-ICONS.md).

### Selection logic

1. Selection → compact **orbit** actions outside the glyph (Delete, Lock, Ask AI, deselect chip).
2. No opaque hub covering the symbol centre — the object stays visible and draggable.
3. Materials / plants do **not** fan over the object; they open in the inventory popup at the summon point.
4. TPZ / council meaning is a **visual zone** under the tree (hover pop), not a loud Got it card.

### Pointer logic

Personal garden mark (settings) is the **idle craft** cursor only.

| Environment | Cursor function |
| --- | --- |
| Idle edit / drafting | Personal mark |
| Pan | Grab |
| Add / place | Copy |
| Paint | Cell |
| Measure / trace / zone / survey annotate | Crosshair |
| Sketch (pen) | Graded fine-tip → thick marker |
| Sketch (eraser) | Eraser rubber |
| Lock / locked edit | Not-allowed |
| Handle hover (move / insert) | Grab / copy |
| Fit sheet | Default |

Implementation: `features/pointer/resolveStudioCursor.ts`.

### AI logic

- AI is a spatial intern on the drawing — ghosts are proposals until Accept / Reject.
- Prefer sidecar / selection Ask over always-on coach cards.
- Constraint-first: title, setbacks, existing trees (TRP/TPZ) are hard; softscape is the sandbox.

---

## 2b. Infinite canvas zoom

Plan modes support **infinite zoom in and out** on free board **and** A3/A4 Fit sheet (soft floor `0.05` / ceiling `64`):

| Input | Behaviour |
| --- | --- |
| Wheel / trackpad / pinch over board | Zoom toward pointer (free plan) or multiply paper-fit (Fit sheet) |
| Ribbon In / Out | Geometric steps (`×1.18`) — same on Fit sheet |
| `+` / `-` keys | Same geometric steps |
| `Alt` + wheel / `Alt` + `+` `-` | Fit sheet print scale denom only (`1:50`…`1:500`) |
| Fit | Frames outdoor remnant (free-plan) or resets Fit camera to paper-fit ×1 |
| Fit sheet (`frameOn`) | Title boundary fitted+centred in the plot; **plain wheel is infinite zoom** |

**Zoom-out / free-plan paper law:** parchment + metric mesh live on a **fixed**
`.parchmentBleed` underlay (outside `.zoomWorld`). The camera scales geometry /
aerial only — never the cream board plane — so Sketch/CAD zoom cannot make the
paper grow or shrink with the lot. Fit sheet still keeps paper inside the plot.

**Tilt exception:** while the tilt lens is on, parchment leaves the bleed and
rides an oversized `.tiltSkin` inside `.zoomWorld` (`tiltSkinScale` from
`features/tilt/tiltMath.ts`). That keeps the foreshortened shade and stops
zoom-out from hard-cutting the drafting plate into a postage stamp. Draft
grid uses `extendPadPct` under tilt for the same reason. Flat mode is
unchanged — bleed returns the moment tilt settles to 0°.

**Sun cast (premium):** when `shadeOn`, dwelling + canopy shadows follow
`boardShadowCast` from domain `sunPositionAt` (az 0° = north, board y-down).
Static `SUN_SHADOW` remains the shade-off default. `SunGrowthDock` portals
through `CameraChrome` (blush frost, `--ws-safe-*`). Client presentation
keeps the sun scrubber when shade is armed and shows a quiet honesty caption —
operator docks stay off.

Implementation: `geometry/canvasZoom.ts` + `.parchmentBleed` + `hidePaper` on
world `TactileGround` **and** `AerialSlot` (clears `#faf6f2` fill) whenever Fit is off;
tilt path adds `.tiltSkin` + `tiltSkinScale`; sun path
`features/sunGrowth/resolveBoardSunCast.ts` + `SunShadowProvider`.

### 2c. CAD view rotation (camera only)

CAD free plan only: increment steps **15° / 45° / 90°** via `ViewNorthControl`.
Resets to north whenever rotation ≠ 0°. Geometry `%` coords and per-asset
`item.rot` handles are unchanged — viewport `rotate()` only.

Keyboard: `[` / `]` rotate the **camera** when nothing is selected; with a
selection they still clock-rotate **assets**. `Shift+0` resets view to north.
`F` = Fit sheet; `Shift+F` = zoom camera to selection.

### 2d. Phase 1 snap / multi-select

- Place/move grid: **0.5 m** (`snapToGridMetres` / `snapToNearby`) with
  `SNAP_RADIUS_PX / planZoom` vertex preference.
- Shift-marquee unions selection; Delete removes the whole group.
- Asset `item.rot` stays independent of `ui.viewRotationDeg`.

---

## 3. Spatial clustering (Fitts + proximity)

File: `features/reach/fittsProximity.ts`.

- Object-local actions (orbit) stay near the selection but **clear of the glyph footprint**.
- Inventory and instruments share the **summon point** (margin), not the object centre.
- Telemetry (live measures, compliance) may sit in the sidecar — collapsed by default.
- Do not park related controls on opposite corners of the board for the same job.

---

## 4. Mode matrix (what may appear)

| Mode / state | Inventory popup | Instruments | Orbit ring | Sidecar / layers |
| --- | --- | --- | --- | --- |
| CAD idle | Off | Off | Off | Available, collapsed |
| CAD Add / Paint armed | **On** (frost popup) | Optional if summoned | Off unless selected | As chrome matrix |
| CAD selection | Orbit on; inventory on only if retype / Add path | Off unless summoned | On | As chrome matrix |
| Sketch | Prefer sketch board chrome; no CAD inventory slab | Summon rules | As chrome | BOM/utility off |
| Survey | Exist / trees focused | Summon rules | As chrome | As chrome |
| Fit / focus / client / foundation | Off | Off | Off | Off |

---

## 5. Implementation anchors

| Concern | Anchor |
| --- | --- |
| Chrome matrix | `state/handoffChrome.ts` |
| Tokens | `handoffStudio.module.css` `--hc-*` |
| Instruments | `features/ambient/AmbientRibbon.tsx` — render only when summoned |
| Inventory | `features/assetPanel/AssetPanel.tsx` — left dock, three states (collapsed / expanded / placing) |
| Selection orbit | `features/selectionRing/SelectionRing.tsx` |
| Cursor | `features/pointer/resolveStudioCursor.ts` |
| Library data | `@workstream/domain` sketch gold + PlanZV / Osmic / Wikimedia |
| Presence timing | `features/kitInventory/atelierPresence.ts` |

---

## 6. Agent checklist (before shipping canvas chrome)

Answer **yes** to every item or do not merge:

1. Does the idle CAD view show mostly drawing, with no fixed inventory bar?
2. Does inventory **pop up** on Add/Paint (frost), then dismiss?
3. Is chrome frost / blush / **dock plastic** (`--hc-neu-*`) — not slate, not
   sepia, not opaque dark pills or drywall slabs?
4. Is the selected object free of hubs and material fans on its centre?
5. Does the idle CAD left edge show **one** tool dock — no zoom column,
   glyph stack, or duplicate Undo/Redo floating beside it?
6. Does the pointer change function by tool / handle context?
7. Are Layers left + AI/measures right, both collapsed by default?
8. Is TPZ meaning on-plan (zone), not a modal card?

### Seamless integration (no bolt-on toggles) — binding for every new feature

9. Does the feature live inside an **existing surface, lens, or gesture**
   (view menu, client view, Cmd+K, drag/wheel gesture, contextual popup)
   rather than adding a new persistent button to the top ribbon?
   The ribbon is a fixed budget, not a landing strip — a new top-level
   toggle needs the same justification as a new page.
10. Is the feature **discoverable in context** (hint pill on first relevant
    action, Cmd+K entry, cursor affordance) instead of relying on the user
    noticing a new icon?
11. Does it **degrade invisibly** — off state indistinguishable from the app
    before the feature existed (no reserved blank space, no dead chrome,
    no extra empty state)?
12. Does entering/leaving the feature **animate from the current camera and
    return to it** (no jump cuts, `prefers-reduced-motion` respected)?
13. Is every >1×/minute action reachable **without crossing the canvas**
    (selection dial on the object, single tool dock, Cmd+K)?
14. **Nonintrusive** — dormant identical to pre-feature: selection focus veil
    mounts only while a single orbit is open; idle canvas unchanged?
15. (Surfaces doc) Dynamic placement / empty-side scoring for transients?
16. **Flexible** — gesture, pointer, AND keyboard (veil click + Esc dismiss;
    dial ARIA menu / arrows)?

### Instrument ergonomics (steering-wheel)

**The hand stays; the controls come to it.** Object adjustments live on the
selection (dial). Mode changes live in one left frost dock. Everything visual
first — symbol swatches, never Latin-name dropdowns. This is the game-inventory
quick-slot pattern rendered in Curtis & Co frost DNA — zero gamified styling
(no rarity frames, glows, or chrome borders on swatches: frost pill, symbol,
9px caption). Zoom is wheel/pinch; Fit presets live in Cmd+K. One Undo/Redo
pair (bottom-left filmstrip). Fill palette summons on Add/Paint only.

### Annotation voice (presentation DNA)

Hand-lettered plan notes use **Architects Daughter** (Google Fonts) — all-caps
drafting hand — annotation-only. Do not apply it to chrome, HUD, or body copy.
Leaders follow the planting line-weight ladder (0.4). Night board: chalk text,
cobalt arrowheads.

---

## 7. Revision history

| Date | Note |
| --- | --- |
| 2026-07-20 | Written after canvas inventory was incorrectly shipped as a fixed opaque bottom overlay. Codifies frost popup + disappearing UI + blush tokens as binding. |
| 2026-07-20 | Compliance rebuild: `inventoryPopup` chrome flag (Add/Paint only); margin-clamped summon; instrument dismiss 3s; paint air-lock cursor + boundary snap. |
| 2026-07-23 | Checklist items 9–12: seamless integration bar — new features must land in existing lenses/gestures, be discoverable in context, degrade invisibly, and animate from the live camera. No bolt-on ribbon toggles. |
| 2026-07-23 | Annotation voice: Architects Daughter reserved for hand-lettered plan notes (presentation DNA). |
| 2026-07-23 | Instrument ergonomics: steering-wheel principle + checklist item 13; single tool dock; selection dial; Fill as summoned popup. |
| 2026-07-23 | Selection focus veil: one CameraChrome scrim spotlights the orbit; checklist 14/16; no remount on tree→tree hop. |
| 2026-07-23 | Sketch tools → plastic tray + MarginStrip (surfaces 2+3); checklist 3 plastic language. |
