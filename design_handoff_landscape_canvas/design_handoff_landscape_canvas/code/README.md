# Reference implementation snippets

**These are not the design.** `Landscape Canvas.dc.html` is the visual source of truth; this folder shows the
*shape* the code should take for the parts where a picture is ambiguous — camera blending, scene-space measurement,
the chrome contract, trade-pack scoping and template binding.

Stack assumed: **React 18 + TypeScript + React Three Fiber + zustand**. Swap freely; keep the boundaries.

| File | Card | Why it exists |
|---|---|---|
| `tokens.ts` | §4 | One source for colour, type, geometry. Nothing hard-codes a hex. |
| `state.ts` | §9 | The whole store. Derived values are selectors, never stored twice. |
| `tradePacks.ts` | 16a / §18 | Why 21 tools fit an 88px ribbon: the pack scopes the groups. |
| `ToolRibbon.tsx` | 4a / 4b / 16a | Three widths, group wayfinding, flyout anchoring, lock reasons. |
| `FusedCamera.tsx` | 4c / §6.1 | Four rig presets and the 320ms projection-matrix blend. |
| `PlaneRuler.tsx` | §8 | The ruler as scene geometry parented to the active canvas. |
| `chromeContract.ts` | 11c | same / convert / lock / hide, per element, per camera — as data. |
| `useQuietState.ts` | 4d / 13b | Pen-down choreography: opacity only, 240ms restore. |
| `officeTemplate.ts` | 17a / 17b | Binding by reference, visible overrides, diff-on-new-version. |

## The three boundaries that matter

1. **Screen space vs scene space.** Ribbon, docks, panels, chips are DOM. Strokes, planes, ruler, crosshair,
   section geometry are R3F. The ruler is the trap — it looks like an overlay and is not (§8).
2. **Derived is never stored.** Schedule rows, cut/fill volumes, canopy cover and areas are selectors over
   `objects`. If you cache one, it will drift from the geometry within a sprint.
3. **Chrome never moves between camera states.** Elements change *what they say*, not *where they are* (11c).
