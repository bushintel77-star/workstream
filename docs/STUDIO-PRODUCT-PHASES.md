# Design studio — product phases (locked)

**Workflow 1** ships now. **Stage 2** is a separate product scope — not a hidden mode inside Workflow 1.

---

## Workflow 1 — Professional sketch (current)

**Positioning:** CAD-*inspired* UX on an indicative site plan. Back-of-envelope for estimate, client conversation, AI develop, and council *flags* — not lodgement drawings.

| Dimension | Workflow 1 rule |
| --- | --- |
| **Geometry** | Percent of aerial (`x_pct`, `y_pct` 0–100). Responsive to viewport pan/zoom. |
| **Accuracy** | Indicative scale bar from static map bounds. Every metre readout labelled *indicative*. |
| **UX** | Ribbon, hand/pan, layer toggles (site intelligence), AI rail, keyboard shortcuts, status HUD. |
| **Overlays** | Sun/shade (predicted), TRP rings, utilities/easements (when data exists), live permit chips. |
| **Honesty** | Permanent copy: concept sketch, not construction; confirm on site / title / locate. |
| **Persistence** | `DesignCanvas` — placements, strokes, `irrigation_zones[]`. |
| **Downstream** | Envelope → develop from sketch → costing → audit → outputs → portal. |

**In scope for Workflow 1 engineering:** Everything in [DESIGNER-HANDOVER.md](./DESIGNER-HANDOVER.md), [STUDIO-SITE-INTELLIGENCE.md](./STUDIO-SITE-INTELLIGENCE.md), tier-1 Wrights Terrace logic, full icon libraries.

**Explicitly out of scope for Workflow 1:**

- Survey-grade coordinates or bearing/distance dims tied to title origin.
- DXF/DWG layer export with paper space / plot styles.
- Dimension styles, leaders, revision clouds, title blocks.
- Silent replacement of operator geometry with AI saves.

---

## Stage 2 — AI CAD (shipping)

**Positioning:** Working-planning surface for draftsperson handoff — same Workstream account and project, **new data model and studio mode**. See [AI-CAD.md](./AI-CAD.md).

| Dimension | Stage 2 rule |
| --- | --- |
| **Geometry** | Metres from aerial-frame origin (`CadDocument`); Y-up. |
| **AI** | Claude emits `CadOp[]`; `@workstream/cad` applies ops. All AI geometry is **ghost** until Accept. |
| **Layers** | SKETCH-REF, PLANTING, HARDSCAPE, STRUCTURES, WATER, IRRIGATION, TRP, ANNOTATION, DIMENSIONS, PERMITS. |
| **Export** | SVG preview in-app; **DXF for LibreCAD**; **glTF 2.0** (extruded proxies). Working plan metres — confirm on site. |
| **Workflow 1 link** | Import sketch → inserts + stroke polylines; upgrade via `/design/cad`. |

**Phase 1 gate (shipped):** calibrated plan-metre frame (`site_frame.board_width_m` preferred over survey/aerial span), site boundary/building/easements stamped into `CadDocument`, Share **Download DXF**.

**Phase 2 gate (shipped):** `cadDocumentToGltf` + Share **Download glTF** — extruded STRUCTURES / planting cylinders; not Nanite, not USD.

**Phase 3 gate (shipped):** `cad.sync.json` live-sync manifest + stable `symbol_id` / entity IDs on glTF extras for an external UE5 importer. Nanite/Lumen stay in Unreal — Workstream publishes the metre contract.

**Phase 4 gate (shipped):** twin telemetry ingest (`POST/GET …/design/telemetry`) for soil moisture, thermal comfort, flow, sediment + studio **Live telemetry** toggle (Cmd+K). Demo seeds labelled `demo` — not sensor fact.

**Phase 5 gate (shipped):** twin performance alerts — `sediment_buildup` / `vegetation_stress` board findings when readings cross indicative thresholds; merge into `GET …/design/findings`.

**Phase 6 gate (shipped):** on-site **AR bird's-eye** overlay (Cmd+K / share twin) with building **footprint occlusion**, pan/rotate/scale calibrate, indicative IoU align score. Not Vision Pro / city-twin chroma-key — confirm on site.

**Workflow 1 §4 (shipped):** temporal growth scrub draws canopy + root rings on the plan; crowded discs tint at Year 10 alongside findings.

**Workflow 1 §3 artboards (shipped):** session Sheets strip — Plan / Fit / Elev N·E·S·W viewports (CameraChrome). Persisted multi-sheet pasteboard remains later.

**Migration principle:** Workflow 1 canvases remain valid forever. Stage 2 opens as *Upgrade to AI CAD* — no silent coercion of sketch geometry.

---

## How the two phases relate

```text
Workflow 1 (now)                    Stage 2 (later)
─────────────────                   ─────────────────
Survey pin + aerial        ────────▶  Georeferenced plan origin
Sketch % placements      ────────▶  Layered CAD entities + dims
Indicative overlays      ────────▶  Survey-locked overlays
Envelope + AI develop    ────────▶  Same pipeline + sheet outputs
Portal concept plan      ────────▶  Optional CAD PDF sheet pack
```

Same **Clerk account**, same **project id**, same **pipeline tabs**. Studio route may branch:

- `/projects/:id/design` — Workflow 1 (default).
- `/projects/:id/design/cad` — Stage 2 AI CAD.

---

## Design DNA (both phases)

Shared tokens (`globals.css`), Garden Atelier type (Fraunces + Sora), AU locale. Stage 2 AI CAD uses the same DNA with an AI rail + aerial/SVG overlay.

---

## Engineering checklist

When reviewing a PR, ask:

- [ ] Does this stay in **percent + indicative** geometry? → Workflow 1 OK.
- [ ] Does it require **metre grid origin or DXF layers**? → Stage 2 only; do not bolt onto `DesignCanvas` without schema brief.

See also: [DESIGNER-HANDOVER.md](./DESIGNER-HANDOVER.md) §2, [STUDIO-SITE-INTELLIGENCE.md](./STUDIO-SITE-INTELLIGENCE.md), `PROPOSAL.md` (AI ghosts), [CANVAS-FIRST-SPATIAL-ENGINE-SDS.md](./CANVAS-FIRST-SPATIAL-ENGINE-SDS.md).
