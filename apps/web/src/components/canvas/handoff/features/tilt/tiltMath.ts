/**
 * Tilt lens math — view-only 2.5D axonometric preview.
 * Strictly camera presentation; never inverted into board pointer maths.
 */

/** Default settle angle for Cmd+K / client-view flourish (deg). */
export const TILT_DEG = 55;

/**
 * Cardinal garden axon look — look *toward* title north/east/south/west.
 * Board north-up: x→east, y↓south. Default tilt (yaw 0) looks north.
 */
export type GardenViewpointLook = "N" | "S" | "E" | "W";

export const GARDEN_VIEWPOINT_LOOKS: readonly GardenViewpointLook[] = [
  "N",
  "E",
  "S",
  "W",
] as const;

/** Camera yaw CW from north-up for each look (compose with rotateX tilt). */
export function viewpointYawDeg(look: GardenViewpointLook): number {
  switch (look) {
    case "N":
      return 0;
    case "E":
      return 90;
    case "S":
      return 180;
    case "W":
      return 270;
  }
}

export function gardenViewpointLabel(look: GardenViewpointLook): string {
  switch (look) {
    case "N":
      return "Looking north";
    case "E":
      return "Looking east";
    case "S":
      return "Looking south";
    case "W":
      return "Looking west";
  }
}

/** Settled camera for a named axon preset. */
export function gardenViewpointCamera(look: GardenViewpointLook): {
  viewRotationDeg: number;
  tiltDeg: number;
} {
  return { viewRotationDeg: viewpointYawDeg(look), tiltDeg: TILT_DEG };
}

/**
 * Which cardinal preset matches the live camera (null if flat or off-cardinal).
 */
export function activeGardenViewpoint(
  tiltDeg: number,
  viewRotationDeg: number,
  yawTolDeg = 8,
): GardenViewpointLook | null {
  if (!isTiltActive(tiltDeg)) return null;
  let yaw = viewRotationDeg % 360;
  if (yaw < 0) yaw += 360;
  for (const look of GARDEN_VIEWPOINT_LOOKS) {
    const target = viewpointYawDeg(look);
    const d = Math.min(
      Math.abs(yaw - target),
      360 - Math.abs(yaw - target),
    );
    if (d <= yawTolDeg) return look;
  }
  return null;
}

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

/**
 * Board px represented by one metre.
 * For geometry *inside* `.zoomWorld` (tilt walls/billboards), pass zoom=1 —
 * the camera already scales. For screen-space HUD outside the camera, pass
 * the live planZoom.
 */
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

/** Narrowest standing face — a hairline sprite is worse than a thin one. */
export const BILLBOARD_MIN_W_PX = 6;

/**
 * Standing billboard CSS for a planted item of known height.
 *
 * Pass `spreadM` to size the face at its real mature spread as well — the
 * silhouette then stands at true proportions instead of a fixed sprite width.
 */
export function billboardStyle(
  heightM: number,
  ppm: number,
  tiltDeg: number,
  spreadM?: number | null,
): {
  transform: string;
  transformOrigin: string;
  height: string;
  width?: string;
  marginLeft?: string;
} {
  const px = Math.max(0, ppm);
  const h = Math.max(0, heightM) * px;
  const w =
    spreadM != null && spreadM > 0
      ? Math.max(BILLBOARD_MIN_W_PX, spreadM * px)
      : null;
  return {
    transform: `rotateX(${-tiltDeg}deg)`,
    transformOrigin: "bottom center",
    height: `${h}px`,
    ...(w != null ? { width: `${w}px`, marginLeft: `${-w / 2}px` } : {}),
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
 * How far the camera-bound parchment/mesh must oversize the board so
 * rotateX + zoom-out never reveals a hard "postage stamp" plate edge.
 * Caps keep DOM cost sane; board cream still fills any extreme gap.
 */
export const TILT_SKIN_SCALE_MIN = 2.4;
export const TILT_SKIN_SCALE_MAX = 8;

export function tiltSkinScale(tiltDeg: number, zoom: number): number {
  if (!isTiltActive(tiltDeg)) return 1;
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const rad = (Math.min(TILT_MAX, Math.max(0, tiltDeg)) * Math.PI) / 180;
  const foreshorten = Math.max(0.35, Math.cos(rad));
  const raw = 1.2 / (Math.max(0.12, z) * foreshorten);
  return Math.min(
    TILT_SKIN_SCALE_MAX,
    Math.max(TILT_SKIN_SCALE_MIN, raw),
  );
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

/**
 * Fallback drafting light when no live sun azimuth is available (deg,
 * 0 = north, 90 = east — same convention as sunPositionAt / SunCastOverlay).
 * 315° = NW, the classic top-left drafting light.
 */
export const LIGHT_AZIMUTH_DEG = 315;

/**
 * Per-wall brightness band. The darkest back facet never drops below
 * WALL_LIGHT_MIN — in a landscaping render the dwelling is a quiet support
 * volume for the garden, never a hero building, so shading stays soft.
 */
export const WALL_LIGHT_MIN = 0.72;
export const WALL_LIGHT_MAX = 1.0;

/**
 * Roof cap lightness — the most sun-facing facet, held slightly above the
 * wall band's average (no roof-normal computation; a constant is enough for
 * a support massing cue).
 */
export const ROOF_LIGHTNESS = 1.04;

/**
 * Unit plan-space vector pointing toward the light source. Azimuth is
 * compass degrees (0 = north, 90 = east); board space is x-right / y-down,
 * so north maps to −y.
 */
export function lightVectorFromAzimuth(azimuthDeg: number = LIGHT_AZIMUTH_DEG): {
  lx: number;
  ly: number;
} {
  const rad =
    ((Number.isFinite(azimuthDeg) ? azimuthDeg : LIGHT_AZIMUTH_DEG) * Math.PI) /
    180;
  return { lx: Math.sin(rad), ly: -Math.cos(rad) };
}

/**
 * Directional lightness for one wall facet from its outward unit normal
 * (nx, ny) versus the light vector (lx, ly). The dot product is clamped to
 * [0, 1] (all back-facing walls share the same quiet minimum) then mapped
 * into WALL_LIGHT_MIN…WALL_LIGHT_MAX.
 */
export function wallLightness(
  nx: number,
  ny: number,
  lx: number,
  ly: number,
): number {
  const dot = Math.max(0, Math.min(1, nx * lx + ny * ly));
  return WALL_LIGHT_MIN + dot * (WALL_LIGHT_MAX - WALL_LIGHT_MIN);
}
