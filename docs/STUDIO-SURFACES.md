# The four surfaces (binding companion to STUDIO-STYLING-AND-UX.md)

**Status:** Binding for all studio control chrome.
**Relationship:** This document names the jurisdictions; STUDIO-STYLING-AND-UX.md
owns the visual language (tokens, dock plastic, camera parenting, gate C). If the
two disagree on *appearance*, the styling doc wins; if they disagree on *where a
control lives*, this document wins.

## The law

Every control in the studio lives on exactly one of four surfaces. A control
that fits none of them goes to Cmd+K until it proves it deserves better. This
is the rule that stops the chrome government growing back.

| # | Surface | Jurisdiction | Default state |
| --- | --- | --- | --- |
| 1 | **Header** | What you're looking at: modes, lenses, share, save state | Always on; icon budget ≤ 6 beyond modes |
| 2 | **The hand** | Everything transient at the pointer: summoned instrument tray, half-orbit on selection; Fill/library lives in left AssetPanel | Hidden; summoned; self-dismissing |
| 3 | **The margin** | One quiet bottom strip: undo/redo, state pill, mode hint, honesty caption, print/rev stamp | Always on, minimal |
| 4 | **Cmd+K** | Everything nameable; constitutional overflow | Hidden until invoked |

Right-side summoned panels (measures, layers, checklist) share ONE slot — one
open at a time.

## Ratification tests (checklist — answer yes or do not merge)

13. **Ergonomic** — is every action done more than once a minute reachable
    without crossing the canvas (orbit on selection, tray at pointer, Cmd+K)?
14. **Nonintrusive** — dormant means invisible: does the idle canvas show only
    drawing + header + margin strip (+ the summon coin, if present)?
15. **Dynamic** — do transients place themselves (empty-side scoring, viewport
    clamp) rather than owning fixed real estate? No draggable panels.
16. **Flexible** — does the control work by gesture, pointer, AND keyboard
    (ARIA menu, focus ring, arrow navigation)?
17. **Lane-disciplined** — does the control read the shared lane insets
    (`--ws-safe-*`) instead of choosing raw pixels, and does it refuse to
    share a lane with another occupant? No panel or card may hardcode a
    position that can land on top of another surface.

## The lane law (why this section exists)

We hit the overlap class four separate times — survey callouts, the A4
strip, the edit banner, then the Layers panel landing under the tool tray
with the schedule cards stacked on themselves. Each was patched locally and
it kept coming back, because **nothing owned layout** — every panel and card
chose its own `left`/`top` and hoped. This is the build that stops it
recurring: one authority, fixed lanes, one occupant each.

| Lane | Owner | Rule |
| --- | --- | --- |
| Left | ToolDock + **one** AssetPanel (collapsed Fill rail / expanded library / Path Grammar placing) | Opening Expanded or Placing clears the right data panel; opening a right panel collapses Expanded/Placing (rail may remain) |
| Right | ONE summoned data panel at a time (Layers, Measures, Demo Lots, Checklist, meta inspectors) | Opening one closes the others **and** collapses left Expanded/Placing; reserve `--ws-safe-right` |
| Margin (bottom) | The MarginStrip | Reserves the ruler gutter; see surface 3 |
| On-plan | Projected cards (schedule, callouts, tags) | Run through the screen-px declutter engine; never share a point |
| Centre | One modal at a time | Fit sheet, Quote card, confirm dialogs |

After this law, "where does this panel go?" has exactly one answer, and a new
feature cannot reintroduce the overlap because it inherits a lane instead of
choosing pixels. On-plan cards are not exempt: they route through the same
screen-px stacking as the area callouts (`annotationLayout` / callout offsets)
so they declutter at every zoom and rotation, and they consume `--hc-glass`
(dolphin in night) — never a hardcoded surface that goes dark-on-dark.

## Surface 2 mechanics (the hand)

Shared engines live in `features/surfaces/`:

- `orbitPlacement.ts` — 8-sector density scoring around a selection →
  emptiest contiguous 180° window ("moons face away from the drawing"),
  hysteresis (`shouldRelocate`: never flip mid-gesture; relocate only when
  ≥30% emptier AND >45° away), viewport clamp (screen-fit beats drawing-fit).
- `transientFade.ts` — the forgiving fade every summoned surface uses:
  visible → (idle 4s, hover/focus blocks the clock) → prefade 60% for 1s
  (a returning pointer revives it) → hidden. Escape/choose hide instantly.
  Reduced motion changes the animation, never the machine.

**Instrument tray shape:** chips stay at their current size (~44–46px dock
plastic). The tray is a grid, max 3 columns, never taller than 3 rows —
a 9-chip tray is ~160px square. A single-column tower of 6+ chips is a
regression and fails test 14.

**Orbit:** constant screen radius ≥ 96px, always outside the TPZ ring when
one exists. Max 7 moons; destructive/primary actions never hidden behind a
carousel overflow. Passive labels inside the orbit's bbox dim to 30% while
the orbit is open and restore on dismiss.

## Surface 3 mechanics (the margin)

`features/surfaces/MarginStrip.tsx` — slots: history, state, actions, hint,
spacer, stamp, legal. It reserves the ruler gutters (`--ws-safe-*`); nothing in
the margin may ever overlap a ruler label. The honesty caption lives here and
nowhere else. Fit sheet contexts pass the scale/revision stamp into `stamp`.
Sketch mode puts Undo/Redo + Tidy/Formalize here; pen/eraser chips stay on
surface 2 (the tool tray).

## Revision history

| Date | Note |
| --- | --- |
| 2026-07-23 | Written during instrument reform: four-surface constitution, ratification tests 13–16, shared engines (placement scoring, transient fade), margin strip. |
| 2026-07-23 | Selection focus veil (surface 2): one CameraChrome scrim; hole for subject; click-dim clears; no remount on selection hop. |
| 2026-07-23 | Sketch toolbar reconciled: pen/eraser plastic tray (surface 2); Undo/Tidy/Formalize + hint on MarginStrip (surface 3). |
| 2026-07-23 | Lane law + checklist 17: left=tools, right=one data panel, on-plan cards declutter + use --hc-glass. Ends the recurring overlap class (survey callouts / A4 strip / edit banner / Layers-under-tray). |
