# Punch-list — survey studio (clashing overlays + dwelling envelope + 3D)

**From:** Design & Architecture (Claude) → Cursor
**Date:** 2026-07-27
**Surface:** `HandoffDesignStudio` survey mode, `feat/canvas-asset-menu-quote-builder`
**Note:** independent of the neutral-token retune (already applied to `globals.css`). `stickyMeta` and `color-tokens.css` are mid-WIP — coordinate before editing those.

Three reported issues; two share one root cause.

---

## 1. Top overlays clash (lane-law violation) · P1

Four independent overlays anchor top-centre with no arbitration, so they overlap:

| Overlay | Source | Problem |
| --- | --- | --- |
| Trace instruction "Hover node to move · hover edge diamond to add · right-click node to delete" | `features/cadPlan/CadPlanBoard.tsx` ~line 2375 | Rendered **persistently**, not only while editing |
| Meta chips (Compliance / Planting / Notes) | `features/stickyMeta/*` | Shares the top-centre band |
| Tilt pill "Tilt on — drag" | `features/tilt/TiltHintPill.tsx` (rendered twice in `HandoffDesignStudio.tsx` ~3866, ~3872) | Competes for the same space |
| Cadastral status strip (BOUNDARY / EASEMENTS / ZONING / OVERLAYS / HERITAGE / TREES / BYDA) | `CadPlanBoard.tsx` (`cadTitleMode`) | Overlaps the above |

**Fixes**

- Gate the trace instruction to **active node-editing only** (tool is edit/trace and a node/edge is hovered or a draw is in progress) — not always-on.
- **One contextual hint at a time**: tilt pill and trace instruction are mutually exclusive; suppress the tilt pill while a trace/edit instruction is showing.
- Give the **status strip** and the **meta chips** distinct lanes — the strip stays the top rail; chips fold into it or move to a side lane. Assign explicit z-index order through the existing chrome state machine (`resolveHandoffChrome` / lane law), don't stack ad-hoc.
- Verify the two `TiltHintPill` renders aren't both mounting.

**Done when:** in survey mode at 375 and 1280, no two top overlays overlap; the trace instruction only appears while editing nodes.

---

## 2 + 3. Existing dwelling envelope missing → 3D missing · P1 (same root cause)

Both symptoms come from one empty input: there is **no `building` geometry** for this lot.

- `TiltBuildingExtrusion.tsx:76` returns `null` when `building.length < 3` → nothing to extrude → **3D absent** on tilt.
- The plan dwelling, the "Existing dwelling" checklist row (`SurveyChecklist.tsx`), and the CadPlanBoard cue all key off the same `building` array.
- For 12 Wrights Terrace, Vicmap returns **0 building footprints** (verified earlier) → `building = []` → envelope, checklist, and 3D are all empty. This is honest, not a bug — but the recovery path is under-surfaced.

The recovery path already exists: `TraceTarget = "boundary" | "building"` (`state/studioTypes.ts`), and `TraceOverlay.tsx:376` offers `["building", "Existing dwelling"]`. Tracing it populates `building`, which lights up the plan, the checklist, and the 3D together. Gaps to close:

**Fixes**

- `traceTarget` defaults to `"boundary"` (`useStudioState.ts` ~574). Make the **"Trace → Existing dwelling" cue and the unticked checklist row arm the building trace target on click** — one tap starts drawing the dwelling.
- **Graceful 3D degradation**: when `building.length < 3`, don't render an empty tilt. Either extrude the boundary/ground so tilt still reads as 3D, or show an inline affordance ("Trace the dwelling to see it in 3D"). The tilt pill shouldn't imply 3D is available when there's nothing to lift.
- Optional: once a dwelling is traced, confirm it round-trips through `applyParcelSnap` (`buildingSource: "traced"`) and persists.

**Done when:** clicking the dwelling cue/checklist row starts a building trace; completing it shows the envelope on the plan, ticks "Existing dwelling", and renders the 3D extrusion on tilt; empty state shows a clear trace affordance instead of blank 3D.

---

## Out of scope

- The neutral palette (done separately).
- Vicmap hydrate logic — correct as-is; this is purely the empty-`building` UX and overlay arbitration.
