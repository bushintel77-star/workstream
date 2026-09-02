# Handoff: Landscape Sketch Canvas — v3.2 (supersedes v2)

Prepared for an autonomous coding agent (Devin) or a developer picking this up cold.
This README is the spec; `Landscape Canvas.dc.html` beside it is the visual source of truth.

**What changed in v3:** turn 16 adds the **canonical screens** — three cards at true device size that are the
build target, plus a decision ledger. Turns 1–15 remain in the file as rationale, but they are candidates, not
instructions. Where an exploration card and a canonical card disagree, **the canonical card wins.**

**v3.1** adds turn 17, the **office template** — a fourth canonical target answering "what should be pre-drawn":
conventions are pre-made and bound, site truth auto-draws from sourced data, design content is never auto-drawn.
**v3.2** adds turn 18, the **presentation stage** — sheet composition (18a) and the AI run (18b). PRESENT is no
longer a switch with nothing behind it, and is no longer out of v1.

---

## 0. Start here — the canonical screens (turn 16)

Build exactly three screens. Everything else in this spec describes a *state* of one of them.

| Card | Screen | Device | Contains |
|---|---|---|---|
| **16a** | **Drafting**, at rest | iPad Pro 11" 1194×834 | ruler margin, WFS + strike chips, mode switch, sync chip, 88px ribbon at the full CAD trade pack, two-way depth rail, camera dock + time pill, cut/fill and snap readouts, indicative-only disclaimer |
| **16b** | **Sketch**, at rest | iPad Pro 11" 1194×834 | sketch trade pack, UNSCALED badge as the calibrate entry, canvases-as-cards rail, canvas gizmo, falloff preset, transfer hints, viewpoint filmstrip + walk/record |
| **16c** | **Site** | phone 426×876 portrait | heading-oriented plan with the rotation stated, offline queue count, you-are-here + nearest set-out, four ≥56px capture actions, four tabs |
| **16d** | **Decision ledger** | — | what won each contested decision, what it costs, what is deliberately out of v1, and what is still open |
| **17a** | **Office template editor** | sheet over canvas, 900×704 | versioned standard: planes, trade packs, materials, line weights + 8c signatures, sheet/title block, schedule codes, defaults |
| **17b** | **Bind · override · update** | — | the three states a project can have against its template |
| **18a** | **Sheet composition** | iPad Pro 11" 1194×834 | sheet set rail, A1 paper with live viewports in template slots, drag tray, auto legend, title block, crop-not-rescale |
| **18b** | **AI run** | iPad Pro 11" 1194×834 | inputs stated with counts, staged real progress, drawing↔render scrub, the two refusals, dock entry |

**States of 16a, not new screens:** flyout open (4a), pen-down quiet (4d), perspective (11b), section in use (6c),
layers panel (6a/10c), schedule (6b/10d), palette (12d), flora ring (12a), ghost review (12b), scan reveal (12c),
history scrub (8a), sync/conflict (8b), sheet composition (9c), first run (9a), setup (9b).
**States of 16b:** stroke transfer (14a), canvas placement (14b), falloff (14c), aerial trace (15a), calibrate (15c).
**States of 16c:** phone capture (15b).
**States of 18a:** issue as PDF, sheet set management. **States of 18b:** growth-year and sun scrubs re-running.

### 0.1 What is pre-drawn, and what is not (turn 17)

Three things get conflated under "a foundation drawing". They need opposite answers:

| Layer | Answer | Where |
|---|---|---|
| **Site truth** — boundary, contours, existing trees, dwelling footprint, services | **Auto-draws**, staged, each stage naming its source and count | 12c scan reveal, 9b setup |
| **Drawing conventions** — plane stack, trade packs, weights + dash signatures, sheet & title block, schedule codes, defaults | **Pre-made and bound** as an office template. Has no geometry, so it invents nothing | **17a / 17b** |
| **Design content** — beds, paths, lawn, "a typical layout" | **Never auto-drawn.** Fabricated geometry with no source cannot go on an issued drawing, and deleting someone else's guesses is slower than drawing your own | — |

Template rules, all three non-negotiable:

1. **Binding is a reference, not a copy** — a standard corrected once reaches every bound project.
2. **Deviation is legal but never silent** — the override count sits in the project chip; each override names what, who, when and why; revert is one action per item.
3. **A new version is an offer with a diff**, reviewed item by item in 12b's language. Nothing changes until accepted, and sheets already issued keep the version they were issued at — which is why the version is printed in the title block.

### 0.2 Presentation stage (turn 18)

Decisions taken without a form; reverse any of them and the rest still stand.

- **Light surfaces are a class, not an exception: outputs are light.** That is the schedule (6b) and the sheet (18a). Nothing else.
- **Slots come from the bound office template.** Dropping a viewport inside a slot follows the standard; dropping it outside marks the sheet with an override, using 17b's language exactly.
- **A drawing that doesn't fit its frame crops. It never rescales silently** — a viewport states `camera · scale-at-sheet-size · LIVE`, and a silent rescale would make that statement false. The dragged frame shows what the scale *would* become, and offers it as a decision.
- **Viewports are live until issued; the issued revision is frozen** — consistent with issued sheets keeping their template version (17b).
- **The legend auto-builds from materials actually used**, carrying the 8c dash signatures.

#### The AI run (18b)

- **There is no prompt box. The drawing is the prompt.** Inputs are geometry, materials, species from the schedule, sun time and growth year — all already in the file. The run **states each input and its count** instead of asking the designer to describe their own drawing.
- **It runs from the camera dock**, beside the time pill. It is a way of looking, not a tool — same reasoning that put sun there (§11a).
- **It lands as a derived view, scrubbable against the drawing underneath.** Scrub to zero and you are on the ink. It never becomes geometry and is never a source.
- **Staged like 12c**, with real per-stage progress and elapsed time. Never a spinner. Drawing continues during a run; a stroke committed mid-run joins the *next* run, stated plainly.
- **Two refusals, permanent:** it will not add planting that was not specified (an empty bed renders empty), and it will not change or become geometry.
- Anything placed on a sheet from a run carries `indicative render · not a construction document`.

### Out of v1, on purpose

Panel customisation · a light canvas theme · a desktop layout · real underlay loading.

### Open before the sprint starts

1. **Numeric entry on every flyout parameter** — flagged in §5.3, never drawn. Blocking for the ribbon.
2. **Error and empty states** — only WFS failure is drawn. Failed import, empty schedule, corrupt underlay, rejected calibration are not.
3. **Real project content** — every number on the canonical screens is representative. Run one real job through all three before locking layout.

---

**What changed in v2:** the horizontal bottom tool dock is dead. Tools now live in a **categorical vertical
ribbon** (turn 4), the bottom centre is **exclusively the camera dock**, and four new subsystems are specified:
**media/brush engine + named palette** (5a), **asset library + drag-to-plane** (5b), **stroke→object promotion**
(5c), **planes & layers** (6a), **schedule** (6b), **section in use** (6c) and **sketch mode** (7a/7b).
Sections 1–3 and the tokens in §4 carry over; anything in v1 describing a bottom tool dock is void.

---

## 1. Overview

Tablet-first (iPad Pro 11", 1194×834pt, pen) sketching canvas for landscape architecture.
Core model: **strokes live on stacked canvas planes in world space** (survey −0.02, ground 0.00, planting +1.5,
massing +4.0), so a plan drawing tilts into a 22° axonometric with no "convert to 3D" step.

Resolved design position, unchanged: **an opinionated, locked layout of thin edge chrome; no user-arrangeable
panels; no docking; no toolbar customisation.** Flexibility is four curated toggles (3b), nothing more.

Two modes share one stroke model:

- **Drafting** — ruler, schedule, WFS overlays, snapping, numeric readouts (turns 4 / 6).
- **Sketch** — same strokes and planes, all measurement chrome off, viewpoints recorded as a walkthrough (turn 7).
  Switching modes never redraws or converts geometry.

## 2. About the design files

`Landscape Canvas.dc.html` (+ `support.js`) is a **design reference created in HTML** — a prototype of intended
look and behaviour, **not production code to copy**. Recreate it in the target codebase's framework and patterns.
Recommended stack if none exists: **React + TypeScript + React Three Fiber + zustand** — the ruler and section
geometry must be projected in the same space as the drawing (§8).

Open the file in a browser; it is a canvas document — pan and zoom. Cards are grouped in **turns**, newest at
top, each option carrying a stable id badge (`4a`, `5c`, `7b`…).

### Card inventory

| id | Card | Status |
|----|------|--------|
| **16a** | **CANONICAL · Drafting at rest** | **BUILD — target** |
| **16b** | **CANONICAL · Sketch at rest** | **BUILD — target** |
| **16c** | **CANONICAL · Site** | **BUILD — target** |
| **16d** | Decision ledger | contract (spec) |
| **15a** | iPad · sketch over an aerial underlay, unscaled | **BUILD** |
| **15b** | Phone · on-site capture, offline queue, send to studio file | **BUILD** |
| **15c** | Calibrate later — retroactive two-point scaling | **BUILD** |
| **14a** | Stroke transfer — lock view, sketch flat, project onto a distant canvas | **BUILD** (sketch mode) |
| **14b** | Placing canvases — lay flat / stand up, gizmo, presets, naming | **BUILD** (sketch mode) |
| **14c** | Angle-based opacity — falloff curve + the two usability rules | **BUILD** (sketch mode) |
| **13a** | Site mode — phone, verify-and-capture, outdoor palette | **BUILD** |
| **13b** | Motion spec — every transition, duration, curve and prohibition | reference (spec) |
| **12a** | Flora ring — radial ranked suggestions, live re-rank on sun scrub | **BUILD** |
| **12b** | Ghost review — one pattern for tidy / stitch / AI, accept-by-confidence | **BUILD** |
| **12c** | Scan reveal — staged site truth with source + count per stage | **BUILD** |
| **12d** | Command palette (⌘K) — context-first, all 38 commands | **BUILD — infrastructure** |
| **11a** | Full chrome · PLAN 2D | **BUILD** |
| **11b** | Full chrome · 3D perspective (converts / locks) | **BUILD** |
| **11c** | Chrome rule table per camera state | **build contract** |
| **10a** | Services · PLAN 2D — utility hairlines, trench flyout, conflict chip | **BUILD** |
| **10b** | Services · 3D — conduits at burial depth, strike pulse, two-way rail | **BUILD** |
| **10c** | Layers panel + ANALYSIS section + lens mode | **BUILD** |
| **10d** | Schedule · SERVICES tab (trench BOM, zone flow, 80% transformer rule) | **BUILD** |
| **9a** | First run — empty site, one instruction, three ways in | **BUILD** |
| **9b** | Project setup — source, scale by known distance, north, boundary | **BUILD** |
| **9c** | Sheet composition + issue PDF (live viewports, auto legend, title block) | **BUILD** |
| **8a** | History scrub — segmented session track, ghost-ahead compare, branch | **BUILD** |
| **8b** | Sync / offline / conflict states, presence, comments pinned to a plane | **BUILD** |
| **8c** | Markup dash signatures + greyscale proof | **BUILD** |
| **7a** | Sketch mode — planes in space, planes-as-cards rail, viewpoint filmstrip | **BUILD** |
| **7b** | One stroke, four cameras (proof frames; not UI) | reference |
| **6a** | Planes & layers — z-stack, existing/proposed, stages, WFS overlays | **BUILD** |
| **6b** | Schedule sheet (light surface, CSV/PDF) | **BUILD** |
| **6c** | SEC camera in use — grade profile, cut/fill hatch, RL datums | **BUILD** |
| **5a** | Media flyout — 4 nibs, telemetry, 21-material palette | **BUILD** |
| **5b** | Asset bento + drag-to-plane raycast | **BUILD** |
| **5c** | Stroke → object promotion (two states) | **BUILD** |
| **4a** | Ribbon in context + grading flyout + WFS context chips | **BUILD — hero** |
| **4b** | Ribbon widths (56 / 88 / 236) | **BUILD** |
| **4c** | View dock → FusedCamera mapping | **BUILD** |
| **4d** | Pen-down quiet state | **BUILD** |
| 3a / 3b | Four curated toggles, live + settings sheet | **BUILD** (toggles now also drive the ribbon, §7.1) |
| 2d | Thin chrome reference composition (vignette + track + plane-locked ruler) | **BUILD** |
| 2a–2c, 1a–1d | Earlier explorations | reference only; 1d's section drawer is superseded by 6c |

## 3. Fidelity

**High fidelity.** Colours, type, spacing, radii and copy are final. Deliberate placeholders: survey/topographic
underlay and site reference photography (striped fills with mono captions) need real file loading. All drawn
contours, canopies, massing prisms, section profiles and sketch strokes in the mocks are **schematic stand-ins for
user strokes — never hard-code them.**

Two conventions that are non-negotiable because they were fixed defects, not preferences:

1. **No chrome label below 9.5px mono** (group headers 8.5px). This is an outdoor-legibility floor for a tool used
   on site, and it sets the ribbon's 88px width. Do not shrink labels to make the rail narrower.
2. **RL/datum labels form one column** with a single left margin for the level lines (6c).

## 4. Design tokens

### Colour — dark canvas (primary)

| Token | Value | Use |
|---|---|---|
| `canvas.bg` | `#1a1c1e` | drafting viewport |
| `canvas.bg.sketch` | `#131517` | sketch mode viewport (deeper void) |
| `panel.bg` | `#1c1e21` | settings/layers sheets |
| `glass.bg` | `rgba(26,28,30,.86)` + `blur(18px)` | floating chrome |
| `glass.grad` | `linear-gradient(180deg,rgba(30,33,35,.93),rgba(22,24,26,.90))` | ribbon, camera dock, flyouts |
| `glass.border` | `rgba(232,230,224,.13–.14)` | 1px border on all glass |
| `glass.inset` | `0 1px 0 rgba(255,255,255,.07) inset` | top edge light on ribbon/dock |
| `flyout.shadow` | `14px 18px 38px rgba(0,0,0,.42)` | **offset right/down** so it never washes the ribbon |
| `track.border` | `rgba(232,230,224,.10)` | perimeter track, inset 22px, radius 16px |
| `ink` | `#e8e6e0` | primary text on dark |
| `ink.60 / .40 / .30` | `rgba(232,230,224,.55 / .40 / .30)` | secondary / tertiary / hint |
| `surface.tint` | `rgba(232,230,224,.05–.07)` | inactive tile |
| `accent.terrain` | `oklch(0.68 0.12 145)` | active tool, active camera, primary switch |
| `accent.terrain.hi` | `oklch(0.86–0.88 0.09–0.14 145)` | active pip, sketch-mode active stroke |
| `accent.terrain.on` | `#10120f` | text on accent |
| `accent.mass` | `oklch(0.72 0.11 55)` | massing fill (20%) + labels |
| `accent.redline` | `oklch(0.62 0.16 25)` | crosshair, section cut, cut hatch |
| `accent.hazard` | `oklch(0.78 0.12 60)` | BAL / bushfire overlay chip |
| `vignette` | `radial-gradient(118% 100% at 50% 50%, rgba(0,0,0,0) 44%, rgba(0,0,0,.44) 80%, rgba(0,0,0,.7) 100%)` | perimeter darkening |
| `paper.bg` / `paper.ink` | `#f4f2ec` / `#1a1a1a` | **schedule only** — the one light surface (§6.2) |

### Material palette (5a) — 21 named materials, no colour wheel

| Group | Materials (in order) |
|---|---|
| Softscape | moss `oklch(0.48 0.11 145)`, sage `oklch(0.74 0.055 145)`, olive `oklch(0.55 0.09 110)`, chartreuse `oklch(0.86 0.17 122)`, fern `oklch(0.38 0.09 155)`, silver foliage `oklch(0.80 0.02 150)` |
| Hardscape | corten `oklch(0.50 0.14 45)`, bluestone `oklch(0.48 0.03 250)`, sandstone `oklch(0.79 0.06 82)`, terracotta `oklch(0.60 0.13 35)`, asphalt `oklch(0.33 0.012 260)`, concrete `oklch(0.68 0.012 250)` |
| Soil · water | water `oklch(0.72 0.13 215)`, gravel `oklch(0.66 0.02 90)`, mulch `oklch(0.42 0.06 60)`, decomposed granite `oklch(0.60 0.05 60)` |
| Markup | setback `oklch(0.62 0.23 25)`, gas `oklch(0.88 0.19 100)`, services `oklch(0.60 0.20 320)`, survey `oklch(0.78 0.12 200)`, drafting `#f2f0ea` |

Swatches are 22px, radius 6, with `0 1px 0 rgba(255,255,255,.14) inset` so they read as material, not UI.
Active swatch: `0 0 0 2px <panel bg>, 0 0 0 3.6px #e8e6e0`. A **build-up ramp** shows the selected material at
0.22 / 0.42 / 0.62 / 0.82 / 1.0 alpha — the five layers the multiply nib produces.

**Markup signatures (8c) are mandatory, not decorative.** Every semantic markup material carries a dash pattern and
an inline/end glyph so it survives colour-blindness and greyscale printing: setback = 26/10 dash + bar ends;
gas = 18/7/3/7 dash-dot + G ticks; services = 3/8 dotted + node rings; survey = 7/5 fine dash + crosses;
protected canopy = 11/8 dash + arc ticks; drafting = solid, no signature. Signature scales with stroke weight, not
zoom. Softscape fills stay hue-only. The plan legend auto-builds from the materials actually used.

### Active state — one rule, two classes

Mixing a solid fill and a thin outline for "engaged" dilutes the mechanical read. There are two legitimate
classes; the **accent pip is the constant** that makes them one language.

| Class | Elements | Engaged treatment |
|---|---|---|
| **A · Engaged control** | tool tiles, camera dock, mode switch, falloff preset, depth-rail band, schedule tab | Solid `accent.terrain` fill, `accent.terrain.on` glyph and label, `0 4px 14px accent/.35`, **18×2px `accent.hi` pip** |
| **B · Selected content** | canvas cards, viewpoint thumbs, sheet-set thumbs — anything whose own content must stay readable | Matte lift (tint +0.05 over the inactive fill) + `0 1px 0 rgba(255,255,255,.10) inset` + 1.5px accent border + `0 0 0 3px accent/.18` ring + the **same 18×2px pip** |

Class B never takes a solid fill — it would erase the thumbnail the card exists to show. But it must not read as a
mere outline either: the lift and the inset light are what make it sit *depressed and engaged* rather than
highlighted. **If a new element is a mutually-exclusive selection, it takes a pip. No exceptions.**

### Typography

- UI: **Archivo** 400/500/600/700 — titles 15/600, panel headers 11.5–13/600, body 10.5/400 (line-height 1.55).
- Numeric/labels/codes: **IBM Plex Mono** 500/600/700 — **9.5px floor**, group headers 8.5px, readouts 10px.
- Tool tiles: mono 9.5px/600, letter-spacing .03em, uppercase (`PEN LINE SPLINE CONTOUR SLOPE CUT/FILL TREE BED MASS PATH DIM SECTION`).

### Geometry

| Element | Spec |
|---|---|
| Chrome inset / perimeter track | 22px inset, radius 16px, 1px `track.border` |
| Tool ribbon | width **88px**, padding 8px, radius 19px; tiles full-width, padding `5px 0 4px`, radius 11px, gap 4px; group divider 1px with `7px 2px 6px` margin |
| Ribbon rail (pen down) | width **56px**, glyph-only tiles 38px tall, radius 10px, panel opacity ~0.72 |
| Ribbon named (⌘K / 400ms dwell) | width **236px**, rows `7px 8px`, glyph 16px + name 10.5px Archivo + hotkey 8.5px mono |
| Flyout | width 238px (media/assets 296px), radius 16px, padding `14px 15px 13px`, 9px arrow rotated 45° on the left edge, **vertically centred on the active tile** |
| Camera dock | padding `8px 9px`, radius 19px, gap 6px; buttons 80px (active 86px), radius 14–15px, glyph 26–28px, name 9.5px mono, rig caption 8.5px mono; 18×2px active pip at top |
| Depth rail | padding 7–8px, radius 13–14px, cells 36×34 (6c bands 48×34), radius 8–9px |
| Schedule sheet | width 622px, radius 10px, 1.5px rules top and totals, 26px side padding |
| Sketch planes rail | cards 74×46, radius 9px, gap 7px |
| Viewpoint filmstrip | thumbs 82×52, radius 9px; active 1.5px accent border + `0 0 0 3px accent/.18` |
| Slider | 3px track, radius 2, 10px `#e8e6e0` thumb |

The `#0d0d0e` card frame around every mock is presentation only — do not build.

## 5. The tool ribbon (turn 4)

### 5.1 Structure

Vertical glass panel, hand-opposite edge, top-aligned at inset 30px (**not** vertically centred — at 13 tools it is
taller than a centred panel fits on an 11" screen). Header `TOOLS` + 3 group pips. Groups, in order:

| Group | Tools |
|---|---|
| DRAW | Pen `P`, Line `L`, Spline `S` |
| GRADE | Contour `C`, Slope to point `G`, Cut/Fill |
| PLANT | Tree, Bed |
| BUILD | Mass, Path |
| MEASURE | Dim, Section |
| (utility row) | Layers, History — two 28px tiles side by side |

Active tool: accent fill, dark glyph/label, `0 4px 14px accent/.35`, and a 4px corner triangle when it has a flyout.
The active tool's **group header turns accent** — that is the only wayfinding in rail width.

### 5.2 Three widths, chosen for the user

`RAIL 56px` while the pen is down · `STANDARD 88px` at rest · `NAMED 236px` on 400ms pointer dwell or `⌘K`
(adds full names, hotkeys and a `RECENT IN <GROUP>` strip). **No manual collapse control.**

### 5.3 Flyouts ("blooming")

Only the active tool may have one. It is positioned to the right of the ribbon, vertically centred on its own tile,
with the arrow tip on the tile's centre line. Contour flyout content: variants `SPOT | RIDGE | SWALE`, `INTERVAL`
0.25m, `MAX SLOPE` 1:12, `TARGET PLANE` `Z 4.0 / Z 1.5 / GRD`, footer hotkeys `⌥ drag · resample`, `⇧ · lock axis`.

**Open item (recommended, not yet drawn):** every numeric parameter needs tap-to-type entry. Sliders alone are
insufficient for a profession that works to `1:14`.

### 5.4 WFS context chips (top bar)

`PrimaryChip` (project name + `AXO 22° · N↑ · 1:200`) then a 1px divider, then translucent pills for active
overlays: `GRZ10`, `BAL-12.5` (hazard colour + triangle glyph), `Water Corp easement`, `Canopy A2–6`, then a dashed
`+N WFS` overflow chip. **Single row, never wraps** — overflow into the count. Use glyph marks, not emoji.

### 5.5 Pen-down quiet state (4d)

On pen contact: ribbon → rail, WFS chips → 20% opacity, camera dock and corner readouts → hidden, perimeter track
→ 5% opacity. The only live element is the nib readout (`CONTOUR · 1.75 → 2.00 · 0.62p · 41°` plus
`len 38.4m · slope 1:14`). Everything returns **240ms after pen-up**, in place. Animate **opacity only** — never
position — so nothing appears to move under the hand.

## 6. Camera, planes, output

### 6.1 View dock → FusedCamera (4c)

| Button | Rig state | Behaviour |
|---|---|---|
| `PLAN` | ortho, tilt 0° | pure top-down; orbit disabled, pan/zoom only; true measurement |
| `AXO` | ortho, tilt 22° | volume without perspective distortion; orbit snaps in 45° steps |
| `SEC` | ortho, tilt 90° | elevation, or cross-section when a cut line is set |
| `3D` | perspective blend | free drone orbit; true-scale drafting tools grey out; ruler becomes a horizon band |

Hotkeys `⌘1–⌘4`, blend **320ms** on the projection matrix (never a cut), long-press reverts to the last state.
Strokes stay on their planes through every transition. `CAM / ORTHO` status cap sits at the dock's left end; a
`Time/Sun` pill (`14:20`) sits at the right, divided off, wired to sun azimuth.

### 6.2 Planes & layers (6a) and the schedule (6b)

Layers panel (`L`), four ordered planes with real z-heights: Massing `Z 4.00`, Planting `Z 1.50`,
**Ground `Z 0.00` (active, `DRAWING` badge)**, Survey base `−0.02` (`IMPORTED`, read-only, lock in hazard colour).
Row anatomy: drag handle · z · name + `n strokes · n objects` · opacity · eye · lock. Below: `STATE`
(EXISTING / PROPOSED / BOTH), `STAGE` (01 / 02 / FUT), and `WFS OVERLAYS · READ-ONLY` rows with source + pull time
and a toggle — show failures honestly (`retry 04:12` with the toggle off). Footer: `⌥ eye · isolate plane`,
`drag · reorder z`. Drawing always lands on the active plane and the ruler retargets with it.

Schedule (6b) is the **only light surface in the product** — output should look like output. Grouped
`CANOPY TREES / BEDS · BY AREA / HARDSCAPE`; columns `CODE · BOTANICAL NAME · POT · SPREAD · QTY`; totals band
`SOFTSCAPE / HARDSCAPE / CANOPY COVER` + `LIVE FROM CANVAS · n objects · time`; `CSV` and `PDF` actions.
**Every number is derived from geometry — the schedule is read-only in that direction.** Edit the bed on canvas.

### 6.3 Section in use (6c)

Existing grade dashed `rgba(232,230,224,.4)`, proposed solid 3.4px accent, cut hatched with `accent.redline` at 45°,
fill hatched accent at −45°, soil stipple below. RL datums `0.0 / 1.5 / 3.0 / 4.5 / 6.0` in one column with a single
line margin; chainage ruler along the bottom. Left rail becomes the **section selector** (`A–A`, `B–B`, `×2` vertical
exaggeration); right rail becomes the **band selector** (`MAS / PLT / GRD / SUB`). Readouts:
`cut 42m³ / fill 39m³ · bal −3m³` and `V exag ×1.0 · true scale`. Strokes drawn here land on the section plane.

## 7. Media, assets, promotion (turn 5)

### 7.1 Nibs

| Nib | Key | Engine requirement |
|---|---|---|
| Drafting pen 0.3mm | `1` | scale-invariant, crisp, zero opacity bleed; ignores pressure |
| 6B charcoal | `2` | pressure → **width and opacity**; tilt → spread; soft edges |
| Alcohol marker | `3` | multiply / `THREE.CustomBlending`; overlaps build up organically |
| Procedural stipple | `4` | scatter along path, varying dot radius; gravel/mulch/soft edge |

Each row in the flyout shows a **live sample drawn by its own engine** — the choice is made by eye. Telemetry block
exposes `PRESS`, `TILT`, `VEL` as meters with per-channel bindings shown beneath (`→ w · α`, `→ spread`, `off`), and
`WEIGHT` in mm-at-scale, not pixels.

### 7.2 Assets (5b)

Bento grid, not a list: categories `CANOPY / SHRUB / HARD / FURN / SYM`; one hero tile spanning two columns; each
asset shows a plan(+elevation) symbol and **real dimensions** (`spread 9.0m · ht 14m`). Drag onto the canvas →
raycast to the active plane, ghost carries its own readout (`GRD · spread 9.0m · E 74.2 N 51.8`), a dashed
mature-spread ring shows on the ground, snap options `canopy grid 3m`, `⌥ drop · scatter ×5`.

### 7.3 Stroke → object promotion (5c)

When a stroke closes a loop on a plane, show a quiet chip beside the nib with what the geometry already knows:
`Planting bed? · 42.6 m² · 26.1 m perim · closed on GRD`, `⏎ PROMOTE` / `ESC`. Non-modal — keep drawing and it stays
ink. On promotion: named object, editable vertices, material applied, counted in the schedule, `⌘Z` reverts to ink.

## 8. Engineering note: the ruler and section must live in the scene

The scale margin is **not** a 2D screen overlay. It is projected with the active canvas plane: at 22° axo the
chainage runs along the site edge and tilts with it, so scale stays mathematically true under orbit. The HTML
prototype fakes it with CSS gradients — look-and-feel only.

Build the margin as **line geometry (or a shader-drawn ruled band) parented to the active `SketchCanvasGroup`** in
R3F, with `troika-three-text` labels billboarded upright. Stationing 10m per 100px at 1:200; major tick every
100px, minor every 20px at 26% of band; tick 0 at site origin. Crosshair, coordinate chip and snap markers derive
from the same stationing — one source of truth.

- **Screen space (DOM):** ribbon, flyouts, chips, camera dock, rails, layers panel, schedule, filmstrip.
- **Scene space (R3F):** strokes, planes, contours, massing, assets, ruler margin, crosshair, ground shadow,
  horizon, section geometry, cut/fill hatch, drag ghost + snap ring.

## 9. State

```
camera:    mode 'plan'|'axo'|'sec'|'3d', projection 'ortho'|'persp', tilt, azimuth, zoom,
           orbitLock, blendMs 320, lastMode
planes:    [{ id, name, z, state 'existing'|'proposed', stage, opacity, visible, locked,
             imported, strokeCount, objectCount }], activePlaneId
tool:      group, id, flyoutOpen, ribbonWidth 'rail'|'standard'|'named', recentByGroup
media:     nib 'pen'|'charcoal'|'marker'|'stipple', materialId, weightMm,
           telemetry { pressure, tilt, velocity }, bindings per nib
draw:      isDrawing, currentStroke, snapTarget, liveReadout { z, length, slope },
           promotionCandidate { area, perimeter, planeId }
objects:   [{ id, type 'bed'|'tree'|'paving'|'edge'|'mass', name, code, geometry,
             materialId, planeId, qty, area, spread }]
schedule:  derived from objects  // never stored twice
grading:   cutVolume, fillVolume, balance   // recomputed on stroke commit
section:   cutLineId, cutLines[], verticalExaggeration, activeBand
overlays:  [{ id, source, label, colour, enabled, fetchedAt, error }]   // read-only WFS
sketch:    active, viewpoints [{ id, camera, thumb }], playing, recording
workspace: handedness, anchorVisibility, rulerMode, chromeScale   // persisted per user
ui:        layersOpen, scheduleOpen, paletteOpen, quiet (pen down)
```

`workspace.*` persists and is the only user-configurable surface. Volumes, schedule rows and canopy cover are
derived. `quiet` is driven by pen contact, never by a user control.

## 10. Assets

- Fonts: **Archivo**, **IBM Plex Mono** (swap for the codebase's type system if one exists).
- No icon set is used: glyphs in the mocks are inline 17–28px 1.3–1.5px-stroke line SVGs, and 3-letter mono codes
  stand in elsewhere. If the codebase has an icon set, replace them and keep the tile geometry.
- Real assets still needed: survey PDF/image underlay, site reference photography, plant symbol library.

## 11. Files in this bundle

- `Landscape Canvas.dc.html` — every card, turns 1–16 (16 is canonical; 1–15 are rationale). Open in a browser; pan/zoom.
- `Landscape Canvas (standalone).html` — **self-contained offline copy.** Open it anywhere, no server, no assets. Use this for review and archive; edit the `.dc.html`, not this file.
- `support.js` — runtime for the HTML file. Not production code.
- `README.md` — this spec.

## 11a. Services and subsurface (turn 10)

**Integration principle: twelve store subsystems, zero new panels.** Sorted by user intent, not by module:

| Subsystem | Home | Notes |
|---|---|---|
| Trenches (4 kinds), irrigation zones (3), lighting runs | **ribbon**, groups `SERVICE` + `WATER` | params in the standard flyout; groups shown per the mode's **trade pack** (`surveyTradePacks`/`cadTradePacks`/`sketchTradePacks`) — that scoping is what keeps the ribbon inside its height budget |
| Subsurface utilities, drainage flow, earthworks, suncast | **6a layers panel**, new `ANALYSIS · DERIVED` section | same row anatomy as WFS overlays: label, provenance, toggle. Per-type chips (water/sewer/gas/electric/comms/reclaimed) nest under Subsurface — fixes the all-or-nothing toggle |
| Strike alerts | **top bar chip**, beside the WFS chips | same class as constraint data. Count + severity, tap cycles + flies the camera; in-scene pulse sphere with an `INDICATIVE CONFLICT · TYPE` card carrying utility, trench depth, clearance, tolerance, severity, and REROUTE / DEEPEN / FLAG |
| Trench BOM, zone flow, fixture load | **6b schedule**, tabs `PLANTING · HARDSCAPE · SERVICES` | derived from geometry; the 80% transformer rule is the one number allowed to turn red |
| Sun, date preset, growth year | **camera dock time pill** | time is camera-adjacent, not a tool |
| Presentation lens | **mode switch** `DRAFTING / SKETCH / PRESENT` | Present hides subsurface, strikes, TPZ, easements, service corridors; keeps design + cost. One switch, no per-layer client view |

**Depth rail becomes two-way.** Bands now run `+4.00 / +1.50 / GRD 0.00 / −0.30 (trench) / −0.35 comms / −0.45 gas / −0.60 water / −1.20 sewer`, coloured by utility type with a divider at ground. This is what makes a strike legible: two runs at one plan position on different z.

**Utility rendering:** hairlines with the 8c dash signatures per type — water 3/8 dotted + node rings, sewer 26/10 long dash + bar ends, gas 18/7/3/7 dash-dot, comms 2/7 fine dotted, electric 7/5. Every run labelled `type ⌀size · depth · measured|assumed · source`. **Provenance is stated, never implied**, and the canvas carries `indicative only · not a substitute for locating`.

## 11b. 2D / 3D chrome contract (turn 11)

Nothing in the chrome changes position between camera states. Every element gets exactly one of four behaviours — **same**, **convert**, **lock with a stated reason**, **hide** — per 11c:

- **Ruler margin:** chainage in PLAN/AXO → **converts** to a horizon band with bearings only in 3D (chainage would be false) → rotates vertical with RL datums in SEC.
- **Crosshair + coords:** `E · N · Z` → **converts** to eye height / bearing / fov in 3D.
- **Dimensions:** true and issuable in ortho → **billboarded, prefixed `≈`, marked indicative** in 3D.
- **Depth rail:** flat two-way list in ortho → **skewed stack** in 3D → band selector in SEC.
- **Ribbon:** all tools live in ortho → `GRADE` + `MEASURE` **lock** in 3D with a lock glyph and one reason line ("locked in perspective — switch to PLAN or AXO to measure") → draw-on-section only in SEC.
- **Weight control:** mm-at-scale → **converts** to screen px, stated.
- **Comment pins:** plan position → scale with depth and occlude behind mass in 3D → only pins on the cut in SEC.
- **Suncast / drainage:** flat overlay → volumetric in 3D → **hidden** in SEC (meaningless on a cut).
- **WFS chips, panels, schedule:** unchanged in all four.

Rule for anything added later: if an element cannot state true units in a view, it converts or locks — it never quietly keeps showing a number that isn't true.

## 11c. Dimensional sketching (turn 14) — sketch mode only

None of the drafting chrome appears here. Three mechanics:

1. **Canvas placement (14b).** Two gestures: **lay flat** at a height (topographic levels) or **stand up** on a bearing (walls, hedges, canopy backs). Gizmo shows the canvas as a real rectangle with live `vertical · 6.2 × 4.4 m · bearing 018°`; `⌥` lay flat, `⇧` snap 15°, double-tap fit to site. Presets: ground 0.00, upper terrace +1.20, canopy +4.50, boundary wall, hedge line. **Naming is required on create.**
2. **Stroke transfer (14a).** `⇧V` locks the view; sketch flat; `⌥`-drag pushes the strokes onto a target canvas by perspective projection. The commit card must state **target canvas, distance, and implied scale factor** before `⏎` (`18.4 m · ×2.4 · canopy 9.0 m`), with a `KEEP SIZE` alternative. From the authoring camera the drawing is pixel-identical after projection; orbiting reveals the depth.
3. **Angle-based opacity (14c).** Stroke opacity falls off with the camera-to-canvas angle (`100%` face-on → `0%` edge-on; balanced preset half at 46°), with `NARROW / BALANCED / WIDE` presets — narrow for working, wide for presenting a fly-through. Two hard rules: **a faded canvas keeps a 1px edge and its list row** (invisible is a view state, not a disappearance), and **opacity never blocks input** — drawing toward a faded canvas snaps the camera to face it first, so no stroke lands out of sight.

Sketch mode and drafting share the stroke and canvas model: switching modes brings the ruler, schedule and WFS chips back with nothing converted or redrawn.

## 11d. Sketch-first entry (turn 15)

**Drawing must never wait on setup.** The supported first action is: open → drop an aerial or take a photo → draw. Unscaled is a first-class state, badged (not nagged) and always convertible.

- **iPad over an aerial (15a).** Underlay gets exactly ONE control — a fade slider (46% shown) — plus a replace action. Sketch-mode rail only; the `UNSCALED` badge doubles as the calibrate entry. Strokes still bind to GROUND so the trace is dimensional before it is measured.
- **Phone on site (15b).** Capture tool, not a design tool: photo + draw, one tool arc, one send action, everything ≥44px and thumb-reachable, no planes/cameras/measurement. Assumes no signal — `OFFLINE` + `n strokes queued · syncs on signal`. The result opens on the iPad as a sketch canvas with the photo as its underlay.
- **Calibrate later (15c).** Runs 9b's two-point mechanism retroactively: tap two known points, type the real distance, derive the ratio, scale strokes, canvases, spreads and areas together. The commit panel must state **FROM → TO** and **what changes** (areas, canopy diameters, path lengths) and must surface the one real hazard: **canvases placed by eye move too** (`canopy +4.50 → +3.80`), offering `SCALE THEM` / `KEEP HEIGHTS`. One undoable action; no stroke is redrawn.

## 12. Suggested workstreams

1. Scene shell: R3F canvas, plane stack, **FusedCamera** with the four presets + 320ms matrix blend, ground shadow,
   horizon, vignette.
2. Stroke engine + the four nibs with real telemetry bindings and multiply blending.
3. Plane-locked ruler, crosshair, coordinate chip, snapping (§8).
4. Tool ribbon: groups, three widths, active-group wayfinding, flyout geometry, `⌘K`.
5. Quiet state: pen-down opacity choreography and 240ms restore.
6. Media flyout + 21-material palette + build-up ramp (+ numeric entry, §5.3).
7. Asset library: bento, drag, raycast to active plane, snap ring, scatter drop.
8. Promotion pipeline: loop detection → candidate chip → named object → schedule row → `⌘Z` back to ink.
9. Planes & layers panel: reorder, isolate, state/stage filters, WFS overlay fetch + failure states.
10. Schedule: derivation from objects, grouping, totals, CSV/PDF export.
11. Section: cut lines, existing/proposed profiles, cut/fill hatch + volumes, band selector, draw-on-section.
12. Sketch mode: planes-as-cards, viewpoint capture, walkthrough playback, mode switch with no geometry conversion.
13. History: session log segmented by activity (survey / grading / paving / planting / markup), scrub head with
    ghost-ahead rendering, volume delta readout (`then` vs `Δ now`), `COMPARE`, `RESTORE HERE`, and branch-on-edit
    (releasing the head with work ahead offers a branch — never a silent overwrite). Card 8a.
14. Sync + collaboration: four explicit states — Synced / Syncing (`3 of 8 planes · keep drawing`) / Offline
    (`n strokes queued · will sync`, hazard colour) / Conflict (`PLANTING also edited · review`) — never a silent
    spinner, never a blocked canvas. Presence as initials chips with the plane each collaborator is drawing on.
    Comments are pinned to a point on a plane (`pinned to GRD · E 42.6 N 30.1`), so they hold through camera moves;
    REPLY / RESOLVE inline. Card 8b.
15. First run (9a): empty site with the ground plane drawn faintly at true extent, ribbon present with only the pen
    lit, one line of copy ("Draw. Your strokes land on the ground plane."), three entries — Import a survey /
    **Trace an address** (default) / Blank site. No tour, no modal, no sample project. The rest of the chrome
    appears when there is something to measure.
16. Setup (9b): four steps, all revisable, skippable. Source (PDF/DXF/image → SURVEY plane), **scale by known
    distance** (pick two points, type the real distance → derived ratio; also how a photo of a hand sketch becomes
    measurable), north (degrees from sheet up, read from the title block when present), boundary (from cadastre or
    traced). Never a gate: "skip · draw unscaled and set this later".
17. Issue (9c): sheets are **live viewports onto the same canvas** — never copies. Viewport chrome states camera,
    scale-at-sheet-size and LIVE. Legend auto-builds from the materials actually used, carrying the 8c dash
    signatures. Title block reads project/sheet/scale/date/rev/north. Sheet set rail + paper size + orientation,
    one action issues the whole set as PDF.

18. Services + subsurface (turn 10) — **no new panels.** Twelve systems integrate as: two trade-scoped ribbon
    groups (SERVICE: trench, light · WATER: drip, spray, agg), one `ANALYSIS` section in the layers panel
    (subsurface with per-type sub-toggles, strike alerts, overland flow, earthworks, suncast — same row anatomy as
    the WFS overlays), a **two-way depth rail** (bands below 0.00 at real burial depths: −0.35 comms, −0.45 gas,
    −0.60 water, −1.20 sewer), a conflict chip in the top bar beside the WFS chips (tap cycles the camera through
    conflicts), a `SERVICES` tab in the schedule, and `PRESENT` as a third mode alongside Drafting/Sketch.
    Ribbon height is managed by **trade packs** — only groups the active pack enables are shown; 21 tools do not
    fit an 88px ribbon at the 9.5px label floor.
    Non-negotiables: utility provenance is always stated (`measured` vs `assumed`), type is carried by the 8c dash
    signature not hue, every conflict is labelled `indicative` with a tolerance, and the canvas carries
    "indicative only · not a substitute for locating". The 80% transformer rule is the one number allowed to go red.

19. **The chrome rule per camera (11c) is a build contract.** Nothing in the chrome changes position between camera
    states; every element does exactly one of four things — **same**, **convert** (same element, honest units),
    **lock** (greyed + lock glyph + one stated reason), or **hide**. Specifically in PERSP: ruler margin converts to
    a horizon band with bearings only (never chainage); the coordinate chip converts to eye height + bearing + fov;
    dimensions stay but are billboarded, prefixed `≈` and marked indicative; GRADE and MEASURE lock; weight
    converts from mm-at-scale to screen px and says so; the depth rail converts to a skewed stack that reads as
    space. In SEC, suncast and drainage hide — they are meaningless on a cut.
    Rule for anything added later: if an element cannot state true units in a view, it converts or locks — it never
    quietly keeps showing a number that is not true.

20. **The 38-feature store maps to five classes, not 24 panels** (turn 12). Tools → ribbon groups (trade-scoped);
    derived views → the `ANALYSIS` section in layers; quantities → schedule tabs; camera/render/split/bookmarks/
    photo-trace → the camera dock and its time pill; inspector → selection, not a panel. Only three needed new
    design because they are new interaction models:
    - **Flora ring (12a)** — radial ranked candidates around a tapped point, each with its ranking reason and a fit
      bar; the sun scrubber lives in the same composition because moving it **re-ranks the ring live**. Form filter
      on the inner arc; dismiss by drawing (nothing to close).
    - **Ghost review (12b)** — sketch→CAD tidy, stitch welds and AI ghosts share ONE language: dashed ghost +
      confidence badge in canvas, a single count chip in the top bar, and **accept-by-confidence as the primary
      action** (threshold slider states "18 will accept / 5 stay for review" before committing). Ink is never
      destroyed — accepted strokes remain the object's source and unstitch back. One ⌘Z reverts the batch.
    - **Scan reveal (12c)** — staged import (cadastre → parcels → services → terrain → flora), each stage naming its
      source and count as it lands, drawable before it finishes, skippable. Never a spinner.
21. **Command palette (12d) is infrastructure, not a feature.** It is what allows 38 features to exist without
    permanent chrome. Context-first ordering: actions on the current selection (with computed consequences —
    "38.4 m · 2.30 m³ spoil", "16 fixtures · 64 W"), then recents, then everything. Every row carries its group
    badge and hotkey so the palette teaches the shortcut and becomes unnecessary. `⇥` scopes to selection.

22. **Site mode (13a) is a different product, not a responsive breakpoint.** Portrait phone, one hand, in sun; the
    job is verify-and-capture, so there is no pen, no ribbon and no schedule editing. Plan rotates to **device
    heading** with the bearing stated (north-up is wrong when standing in the site). Outdoor palette: ink to
    `#f2f0ea`, glass to 90% opacity, chrome labels 9.5→11px, accent lightness +0.04. All targets ≥56px and inside
    the bottom third. Four capture actions only: photo pin, voice note, spot level, mark strike — each recording its
    own GPS accuracy (`±1.4 m`). Four tabs: PLAN (heading-oriented issued drawing) · UNDER (subsurface only,
    strikes first — the pre-dig check) · LIST (schedule as a tickable set-out list, read-only) · NOTES (today's
    captures). Sync state is permanently visible with the queue count as the message. Everything captured lands as
    a **comment pinned to a plane** (8b) — no separate site inbox.

23. **Motion spec (13b).** The rule underneath every transition: **things the hand is on never move.** Chrome
    animates opacity; geometry interpolates; position animation belongs to the camera alone.
    Camera: PLAN⇄AXO⇄SEC 320ms `cubic-bezier(.32,.72,0,1)`; →3D 420ms with the ruler cross-fading to the horizon
    band at 60%; fly-to 600ms catmull-rom, **no roll ever**.
    Chrome: pen-down→quiet 120ms opacity-only (no transform under the hand); restore 180ms after a fixed 240ms
    delay; rail⇄standard 160ms with labels cross-fading at 70% of the width change; flyout bloom 140ms scale
    .96→1 from its own tile's arrow (never a slide-in); palette 120ms opacity + y−6, no row stagger; chrome recede
    on orbit → 0.35 opacity, 150ms rest decay, never fully hidden.
    Geometry: promotion chip 110ms at the nib, ghost→solid 200ms on accept; flora ring spring 0.7 damp, re-rank
    260ms along the arc (the movement IS the feedback); strike pulse 1400ms halo-opacity only — no scale, no colour
    flash; scan sweep tracks **real** completion (a stalled fetch shows a stalled sweep); history scrub 1:1 with the
    finger, zero easing.
    `prefers-reduced-motion`: all durations 0 except camera transitions at 120ms.

The full round trip is now specified: empty site → setup → sketch or draft → planes, schedule, section → issue,
with every chrome element defined in both the 2D and 3D reading.
