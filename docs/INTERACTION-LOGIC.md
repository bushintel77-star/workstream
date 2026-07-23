# Interaction logic (binding)

**Status:** Binding for `HandoffDesignStudio` pointer behaviour.
**Companion to:** `STUDIO-SURFACES.md` (governs *where controls live*). This
document governs *what a click means*. Surfaces + interaction together are the
studio's UX constitution.

If a change contradicts this document, this document wins until product revises it.

---

## 0. One-sentence law

**A modal tool owns the click; selection is the ground state.** The cursor
always predicts the outcome — if a click will draw, the draw cursor shows
everywhere, including over objects; if no tool is armed, the pointer is the
select/grab hand.

This exists because the code today violates it: an item's pointer handler calls
`onSelect` regardless of the active tool (only Paint/Lock/eyedropper branch
away), while the empty-board handler only marquee-selects in Edit or Pan — and
the cursor keeps showing the pen/crosshair the whole time. So "with a pen, how
do you grab things?" has an accidental answer (click directly on an object and
it silently selects) that the cursor never advertises. **The cursor lies.** The
rules below end that.

---

## 1. The click contract (tool × gesture × target)

Target of a pointer-down is either an **object** (item glyph / handle) or
**empty** (board, lot, or nothing). The rule per tool:

| Tool | Click empty | Click on object | Drag empty | Cursor |
| --- | --- | --- | --- | --- |
| **Select** (ground state) | clear selection | select | marquee-select | grab hand; grab-closed over a draggable object |
| **Add** | place item | **place item** (objects inert) | — | copy |
| **Paint** | fill lot | paint object | — | air-lock crosshair |
| **Trace / Measure / Zone** | tool acts | **tool acts** (objects inert) | tool acts | crosshair |
| **Calib / Level / Service** | tool acts | **tool acts** (objects inert) | — | crosshair |
| **Lock** | — | select-only (no move) | — | pointer + lock badge |
| **Sketch (pen)** | draw | draw over | draw | pen nib |
| **Sketch (eraser)** | — | erase stroke | — | eraser |

The bold cells are the corrections to today's behaviour: **in a drawing/placing
tool, objects are inert** — a click passes through to the tool, never silently
steals into selection.

---

## 2. The five rules (each is testable)

1. **Cursor = outcome, always.** The cursor is a pure function of
   `(tool, hover-target, locked)`. If a click will draw, the draw cursor shows
   even over an object. If Select is the state, the pointer is the grab hand,
   and closes to grab-active when hovering a draggable object.
   *Test:* for every tool, the cursor over an object equals the cursor over
   empty board (except Select, which may switch to grab-closed on a draggable).

2. **In a tool, objects are inert.** Trace / Measure / Zone / Calib / Level /
   Service / Add treat objects as canvas — the click reaches the tool. No
   `onSelect` from an object handler while a drawing/placing tool is armed.
   *Test:* click an object in each tool → the tool's action fires (or nothing);
   selection does NOT change.

3. **Selection is the ground state, not a hidden fallback.** There is a
   **Select** tool (today's "Edit", renamed) — or "no tool armed" *is* Select.
   Grab, marquee, and the orbit live there and only there.
   *Test:* selection + marquee only occur when the armed tool is Select.

4. **Pan is a gesture, not a tool.** Camera pan is space-hold / two-finger /
   middle-drag. The Pan *tool* is deleted — it currently marquee-selects while
   showing a grab cursor, which is the contradiction rule 1 forbids.
   *Test:* no tool value `"pan"` remains; space-drag pans the camera; a plain
   drag in Select marquees (does not pan).

5. **Lock's cursor tells the truth.** Lock permits selection but blocks move.
   The cursor is a normal pointer with a lock badge — never `not-allowed`
   (which claims the click does nothing, then it selects).
   *Test:* in Lock, click an object → it selects; drag → no move; cursor is not
   `not-allowed`.

---

## 3. Naming + discoverability

- Rename **Edit → Select** (icon reads as an arrow/marquee, not a diamond).
  "How do I just grab something?" must have an obvious answer.
- One-time hint on first object selection: "drop the tool to select" (uses the
  existing hint-pill pattern; never repeats).
- Keyboard: Esc returns to Select from any tool; Delete removes the selection;
  arrow keys nudge. Parity is required (checklist item 16, surfaces doc).

---

## 4. Migration notes (for the implementer)

- Single cursor authority already exists: `features/pointer/resolveStudioCursor.ts`.
  Rule 1 means it also takes the hover-target, and every tool returns its draw
  cursor unconditionally (no object special-case except Select).
- The object pointer handler in `CadPlanBoard.tsx` (~line 1656) must gate
  `onSelect` on `tool === "select"` (plus the existing Paint/Lock/eyedropper
  branches). That single guard implements rule 2.
- The empty-board handler (~line 603) already limits marquee to Edit/Pan —
  narrow it to Select only, and delete the Pan branch (rule 4).
- Deleting the Pan tool: remove it from `TOOLS`, the cursor map, and the tool
  tray; wire space/two-finger pan if not already the sole path. **Delete the
  dead tool, do not leave it disabled.**

---

## Revision history

| Date | Note |
| --- | --- |
| 2026-07-23 | Written from the pen/grab audit. Codifies "tool owns the click, selection is the ground state"; five testable rules; Edit→Select, delete Pan tool, honest Lock cursor, inert-objects-in-tools. |
