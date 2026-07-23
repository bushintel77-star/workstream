/**
 * Tilt lens math — view-only 2.5D axonometric preview.
 * Strictly camera presentation; never inverted into board pointer maths.
 */

/** Default settle angle for Cmd+K / client-view flourish (deg). */
export const TILT_DEG = 55;

/** Continuous Ctrl/Cmd+drag ceiling (deg). */
export const TILT_MAX = 60;

/** Release below this angle snaps flat (deg). */
export const TILT_SNAP_FLAT = 15;

/** Dwelling eave height — same constant Fit sheet elevation profile uses. */
export const TILT_EAVE_M = 5;

/**
 * Safety clears for the temporary transform transition class.
 * Slightly above the CSS durations (420ms / 2000ms) so a missed
 * transitionend / transitioncancel cannot leave the class stuck.
 */
export const TILT_ANIM_MS_FAST = 700;
export const TILT_ANIM_MS_SLOW = 2500;

/** Board px represented by one metre at the current camera zoom. */
export function pxPerMetre(
  boardW: number,
  scaleM: number,
  zoom: number,
): number {
  const w = Math.max(1, boardW);
  const m = Math.max(1e-6, scaleM);
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return (w / m) * z;
}

/** Standing billboard CSS for a planted item of known height. */
export function billboardStyle(
  heightM: number,
  ppm: number,
  tiltDeg: number,
): {
  transform: string;
  transformOrigin: string;
  height: string;
} {
  const h = Math.max(0, heightM) * Math.max(0, ppm);
  return {
    transform: `rotateX(${-tiltDeg}deg)`,
    transformOrigin: "bottom center",
    height: `${h}px`,
  };
}

/** True when the lens is active enough to lock editing. */
export function isTiltActive(tiltDeg: number): boolean {
  return Number.isFinite(tiltDeg) && tiltDeg > 0.5;
}

/**
 * Clamp a continuous drag delta into the 0…TILT_MAX window.
 * Positive dy (drag down) increases tilt — maps-app convention.
 */
export function tiltFromDragDelta(
  startDeg: number,
  dyPx: number,
  sensitivity = 0.18,
): number {
  const next = startDeg + dyPx * sensitivity;
  return Math.max(0, Math.min(TILT_MAX, next));
}

/** Snap policy on gesture release. */
export function settleTiltDeg(deg: number): number {
  if (!Number.isFinite(deg) || deg < TILT_SNAP_FLAT) return 0;
  return Math.min(TILT_MAX, deg);
}

/**
 * True-3D vertical wall quad standing on ground edge A→B, extruded from
 * Z=0 (ground) to Z=`eavePx` (roofline) — a `matrix3d` column-major
 * rotation + translation, NOT a billboard. Because it shares the exact same
 * world-Z convention as the roof plane's `translateZ(eavePx)`, the wall's
 * top edge lands pixel-exact under the roofline corner once both are
 * composed with the shared ancestor `rotateX(tiltDeg)` — no drift, no gap,
 * so a low-angle tilt reads as "roof sitting on a footprint that's inside
 * the boundary", never as a shape disconnected from its own footprint.
 *
 * Derivation: the quad's local axes must map to world directions
 *   local +x (width, A→B)   → unit(B−A) in the ground (X,Y) plane
 *   local +y (height, top→bottom) → world −Z (top=roofline, bottom=ground)
 *   local +z                → local-x × local-y (forces a proper rotation,
 *                              det=+1, so there is no unwanted mirroring)
 * with the box's own width=|AB|, height=`eavePx`, origin at top-left.
 */
export function wallQuadMatrix3d(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  eavePx: number,
): string {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.max(0.01, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  const m = [
    ux, uy, 0, 0,
    0, 0, -1, 0,
    -uy, ux, 0, 0,
    ax, ay, eavePx, 1,
  ];
  return `matrix3d(${m.map((v) => v.toFixed(4)).join(",")})`;
}

/**
 * True-3D vertical pole at a single ground point (x, y), spanning the same
 * Z=0…`eavePx` range as `wallQuadMatrix3d` — the corner-post special case
 * (no edge direction to align to). Equivalent to `translate3d(x, y, eavePx)
 * rotateX(-90deg)`, verified to reduce to the identical column-major matrix.
 */
export function poleMatrix3d(x: number, y: number, eavePx: number): string {
  return `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${eavePx.toFixed(2)}px) rotateX(-90deg)`;
}
