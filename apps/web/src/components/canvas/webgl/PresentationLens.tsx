/**
 * Gold Standard 2026 — Presentation Lens filter.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 3 (Presentation Lens)
 *
 * "High-fidelity storytelling mode that hides technical 'Spatial Truth'
 * but keeps 'Live Intelligence' data."
 *
 * This is a scene-graph visibility filter, not a separate surface. When
 * active, it hides:
 *   - Subsurface utility volumes (gas/water/electric tubes)
 *   - Strike Alerts (collision pulses)
 *   - TPZ rings (AS 4970 tree protection zones)
 *   - Easement hatching
 *   - Survey service corridors
 *
 * It keeps visible:
 *   - Boundary (the lot shape — the client needs to see the property)
 *   - Building footprint
 *   - Trees + planted regions (the design — the whole point)
 *   - Live BOM / cost widgets (the GlassCard overlay)
 *   - Dimensions (the client wants to see sizes)
 */

export interface PresentationLensFilter {
  /** Hide subsurface utility tubes. */
  hideSubsurface: boolean;
  /** Hide strike alert pulses. */
  hideStrikes: boolean;
  /** Hide TPZ rings on existing trees. */
  hideTpz: boolean;
  /** Hide easement hatching. */
  hideEasements: boolean;
  /** Hide survey service corridors. */
  hideServices: boolean;
}

/** The default Presentation Lens filter — hides technical truth, keeps design. */
export const PRESENTATION_LENS: PresentationLensFilter = {
  hideSubsurface: true,
  hideStrikes: true,
  hideTpz: true,
  hideEasements: true,
  hideServices: true,
};

/** The default CAD/technical filter — everything visible. */
export const TECHNICAL_LENS: PresentationLensFilter = {
  hideSubsurface: false,
  hideStrikes: false,
  hideTpz: false,
  hideEasements: false,
  hideServices: false,
};

/**
 * Resolve which lens filter applies for a given studio mode.
 * - present/quote modes → Presentation Lens (hide technical truth)
 * - all other modes → Technical Lens (everything visible)
 */
export function resolveLens(mode: string): PresentationLensFilter {
  if (mode === "present" || mode === "quote" || mode === "share") {
    return PRESENTATION_LENS;
  }
  return TECHNICAL_LENS;
}
