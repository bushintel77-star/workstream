# Studio styling and UI/UX logic (binding)

**Status:** Binding for `HandoffDesignStudio` and all operator canvas chrome.  
**Audience:** Agents and humans implementing or restyling the drawing surface.  
**Companions:** [CAD-AI-2026-UX.md](./CAD-AI-2026-UX.md) · [CANVAS-FIRST-UX.md](./CANVAS-FIRST-UX.md) · [DESIGN-KIT-INVENTORY.md](./DESIGN-KIT-INVENTORY.md) · [AI-CAD-DESIGN-LIBRARY.md](./AI-CAD-DESIGN-LIBRARY.md)

If a change contradicts this document, **this document wins** until product revises it.

---

## 0. One-sentence product law

The **drawing is the product**. Chrome is frost glass that **appears when needed**, never a fixed opaque slab parked on the plan.

---

## 1. Visual tokens (original blush DNA)

Source of truth also lives in handoff README color table and `--hc-*` in `handoffStudio.module.css`.

| Role | Token | Value |
| --- | --- | --- |
| Canvas blush | — | `#F6EAED` |
| Paper / board | `--paper` family | `#FAF6F2` / `#F7F4EF` |
| Frost glass | `--hc-glass` | `rgba(255, 251, 252, 0.92)` |
| Soft frost (preferred for large chrome) | `--hc-glass-soft` | `rgba(255, 251, 252, 0.72)` |
| Ink | `--hc-ink` | `#241318` |
| Muted | `--hc-ink-muted` | `#7A5560` |
| Faint | `--hc-ink-faint` | `#B08A95` |
| Accent | — | `#C2455F` |
| Selection wash | — | `#FFD3DE` |
| Success | — | `#1F8A5A` |
| Ghost gold | — | `#E8B84B` |
| Elevation | `--hc-elev` | soft umber shadow, not slate |

**Fonts:** Fraunces (display where used) · Sora (UI) · IBM Plex Mono (meta / CAD labels).

### Forbidden looks

- Dark slate glass (`rgba(26,36,48…)`, `#e8f0f8` ink on charcoal)
- Sepia / stained board (`#e8d5bc` plate)
- Purple-on-white / glow / multi-layer neon shadows
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
| Inventory popup | Soft / Hard / Trees / Water / Library | **Hidden** until Add / Paint / explicit open |
| Structure rail (left) | Layers / constraints | Collapsed; gated by `structureRail` |
| AI sidecar (right) | Utility, live measures, dialogue | Collapsed; gated by `aiSidecar` |
| Fit / focus / client / foundation | Paper-first | Almost all floats off |

Progressive disclosure is owned by `resolveHandoffChrome` (`state/handoffChrome.ts`).

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

Implementation: `geometry/canvasZoom.ts` + `.parchmentBleed` + `hidePaper` on
world `TactileGround` **and** `AerialSlot` (clears `#faf6f2` fill) whenever Fit is off.

### 2c. CAD view rotation (camera only)

CAD free plan only: increment steps **15° / 45° / 90°** via `ViewNorthControl`.
Resets to north whenever rotation ≠ 0°. Geometry `%` coords and per-asset
`item.rot` handles are unchanged — viewport `rotate()` only.

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
| Inventory | `features/kitInventory/KitAssetDock.tsx` — **popup**, not fixed overlay |
| Selection orbit | `features/selectionRing/SelectionRing.tsx` |
| Cursor | `features/pointer/resolveStudioCursor.ts` |
| Library data | `@workstream/domain` sketch gold + PlanZV / Osmic / Wikimedia |
| Presence timing | `features/kitInventory/atelierPresence.ts` |

---

## 6. Agent checklist (before shipping canvas chrome)

Answer **yes** to every item or do not merge:

1. Does the idle CAD view show mostly drawing, with no fixed inventory bar?
2. Does inventory **pop up** on Add/Paint (frost), then dismiss?
3. Is chrome frost / blush — not slate, not sepia, not opaque drywall?
4. Is the selected object free of hubs and material fans on its centre?
5. Do instruments stay hidden until summoned?
6. Does the pointer change function by tool / handle context?
7. Are Layers left + AI/measures right, both collapsed by default?
8. Is TPZ meaning on-plan (zone), not a modal card?

---

## 7. Revision history

| Date | Note |
| --- | --- |
| 2026-07-20 | Written after canvas inventory was incorrectly shipped as a fixed opaque bottom overlay. Codifies frost popup + disappearing UI + blush tokens as binding. |
| 2026-07-20 | Compliance rebuild: `inventoryPopup` chrome flag (Add/Paint only); margin-clamped summon; instrument dismiss 3s; paint air-lock cursor + boundary snap. |
