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

## Stage 2 — True CAD (future product)

**Positioning:** Working-planning surface for draftsperson handoff — same Workstream account and project, **new data model and studio mode**.

| Dimension | Stage 2 rule |
| --- | --- |
| **Geometry** | Survey / title-derived coordinate system (e.g. MGA2020 metres from lot origin, or georeferenced canvas). |
| **Accuracy** | Stated precision, snap to grid, orthogonal, optional stationing. |
| **Layers** | Named layers (plants, hardscape, irrigation, annotations, services, easements) with export. |
| **Dims** | Dim styles (mm, chainage optional), associative to geometry where supported. |
| **Export** | Structured SVG/DXF/PDF sheet with layer table; optional sync to external CAD. |
| **Workflow 1 link** | Import sketch canvas as reference layer; promote symbols to CAD entities on upgrade. |

**Stage 2 prerequisites (product, not code yet):**

1. Title/survey origin + Vicmap lock confirmed per project.
2. Product sign-off on export formats and liability copy.
3. Schema version (`DesignCanvasV2` or `CadDocument`) in `packages/contracts` before API/clients.

**Migration principle:** Workflow 1 canvases remain valid forever. Stage 2 opens as *Upgrade to CAD document* — one-way promote with reference snapshot, no silent coercion.

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
- `/projects/:id/design/cad` — Stage 2 when shipped.

---

## Design DNA (both phases)

Shared tokens (`globals.css`), Inter + JetBrains Mono, Curtis palette, AU locale, `SiteContextRibbon` chip language. Stage 2 adds denser chrome (layer manager, dim toolbar) but **same accent discipline** (≤3% accent surface).

---

## Engineering checklist

When reviewing a PR, ask:

- [ ] Does this stay in **percent + indicative** geometry? → Workflow 1 OK.
- [ ] Does it require **metre grid origin or DXF layers**? → Stage 2 only; do not bolt onto `DesignCanvas` without schema brief.

See also: [DESIGNER-HANDOVER.md](./DESIGNER-HANDOVER.md) §2, [STUDIO-SITE-INTELLIGENCE.md](./STUDIO-SITE-INTELLIGENCE.md), `PROPOSAL.md` (AI ghosts).
