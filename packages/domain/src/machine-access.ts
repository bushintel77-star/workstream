/**
 * Machine access — the narrowest gap between the dwelling and the boundary,
 * restricted to the side corridors (excluding the street frontage).
 *
 * Whether a bobcat can reach the rear of a site changes the labour cost of
 * everything that follows. Under ~800 mm every cubic metre of spoil and every
 * tonne of paving moves by wheelbarrow, and the labour on excavation, base and
 * paving multiplies. This is the assumption that most often makes a quote
 * wrong, and it is fully computable from geometry the app already holds: the
 * title boundary and the building footprint.
 *
 * Domain-pure: no server imports. The band comes from the operator's plant
 * profile (their actual machines), not generic thresholds.
 */

import type { OperatorPlantProfile } from "@workstream/contracts";

/** Board-space point in `%` coords (0–100). */
export type MachineAccessPoint = { x: number; y: number };

export type MachineAccessBand = "barrow" | "narrow" | "standard" | "none";

export type MachineAccessCorridor = {
  /** Side label — which boundary edge the corridor runs along. */
  side: "north" | "south" | "east" | "west";
  /** Narrowest gap in metres along this corridor. */
  widthM: number;
};

export type MachineAccessResult = {
  /** Narrowest side-corridor width in metres (the wider of the two sides — the one a machine would use). */
  widthM: number;
  /** Side label for the primary (widest) corridor. */
  sideLabel: "north" | "south" | "east" | "west";
  /** Access band derived from the operator's plant profile. */
  band: MachineAccessBand;
  /** Name of the widest machine that fits, if any (else null = barrow). */
  machineName: string | null;
  /** Pinch-point location in board `%` coords — where the annotation goes. */
  pinchPoint: MachineAccessPoint;
  /** Both side corridors reported — the narrow side often constrains spoil staging. */
  corridors: MachineAccessCorridor[];
};

/**
 * Compute machine access from the title boundary and building footprint.
 *
 * Returns `null` when there is no building to compute against — never a guess.
 * Building touching the boundary returns `widthM: 0` and band `"none"`.
 *
 * The street frontage is excluded: the boundary edge whose midpoint is closest
 * to the lowest-y board edge (south = street in the canonical orientation) is
 * treated as the frontage and dropped from the side-corridor search. This is
 * an approximation — the canonical board has street at the bottom — but it is
 * honest about being indicative, and the operator override wins anyway.
 *
 * `scaleM` is the board width in metres (100% → m), used to convert `%` gaps
 * to metres. The corridor width is the minimum distance from any building edge
 * to any boundary edge, per side.
 */
export function computeMachineAccess(
  boundary: MachineAccessPoint[],
  building: MachineAccessPoint[],
  scaleM: number,
  profile: OperatorPlantProfile | null,
): MachineAccessResult | null {
  if (building.length < 3 || boundary.length < 3 || scaleM <= 0) return null;

  // Project to metres: x% → m, y% → m (square board assumption — board_width_m
  // is the single scale, same as canvas-geometry's square-board path).
  const toM = (p: MachineAccessPoint) => ({
    x: (p.x / 100) * scaleM,
    y: (p.y / 100) * scaleM,
  });
  const bM = boundary.map(toM);
  const dM = building.map(toM);

  // Boundary centroid — the reference for side classification.
  const bc = centroid(bM);

  // Identify the street frontage edge: the boundary edge whose midpoint has the
  // largest y (south = bottom = street in screen coords). Also identify the
  // rear edge (smallest y midpoint — the opposite end). Both are excluded from
  // the side-corridor search; only east/west edges are side access.
  const boundaryEdges = edges(bM);
  let frontageIdx = 0;
  let rearIdx = 0;
  let maxY = -Infinity;
  let minY = Infinity;
  for (let i = 0; i < boundaryEdges.length; i++) {
    const mid = midpoint(boundaryEdges[i]!.a, boundaryEdges[i]!.b);
    if (mid.y > maxY) {
      maxY = mid.y;
      frontageIdx = i;
    }
    if (mid.y < minY) {
      minY = mid.y;
      rearIdx = i;
    }
  }
  const excluded = new Set([frontageIdx, rearIdx]);

  // For each non-excluded boundary edge, find the min distance to any building
  // edge, and classify the side by the edge's position relative to the centroid.
  const buildingEdges = edges(dM);
  const corridorBySide = new Map<
    "north" | "south" | "east" | "west",
    { widthM: number; pinch: MachineAccessPoint }
  >();

  for (let i = 0; i < boundaryEdges.length; i++) {
    if (excluded.has(i)) continue;
    const be = boundaryEdges[i]!;
    const side = sideOf(be, bc);
    let minDist = Infinity;
    let pinchM = midpoint(be.a, be.b);
    for (const de of buildingEdges) {
      const d = segmentToSegmentDistance(be.a, be.b, de.a, de.b);
      if (d < minDist) {
        minDist = d;
        pinchM = midpoint(be.a, be.b);
      }
    }
    const pinchPct: MachineAccessPoint = {
      x: (pinchM.x / scaleM) * 100,
      y: (pinchM.y / scaleM) * 100,
    };
    const prev = corridorBySide.get(side);
    if (!prev || minDist < prev.widthM) {
      corridorBySide.set(side, { widthM: minDist, pinch: pinchPct });
    }
  }

  const corridors: MachineAccessCorridor[] = [...corridorBySide.entries()].map(
    ([side, v]) => ({ side, widthM: v.widthM }),
  );
  if (corridors.length === 0) return null;

  // Primary = widest corridor (the one a machine would use).
  let primary: { side: typeof corridors[number]["side"]; widthM: number; pinch: MachineAccessPoint } =
    { side: corridors[0]!.side, widthM: corridors[0]!.widthM, pinch: corridorBySide.get(corridors[0]!.side)!.pinch };
  for (const c of corridors) {
    if (c.widthM > primary.widthM) {
      primary = {
        side: c.side,
        widthM: c.widthM,
        pinch: corridorBySide.get(c.side)!.pinch,
      };
    }
  }

  const widthMm = Math.round(primary.widthM * 1000);
  const band = bandFor(widthMm, profile);
  const machineName = machineFor(widthMm, profile);

  return {
    widthM: Math.round(primary.widthM * 1000) / 1000,
    sideLabel: primary.side,
    band,
    machineName,
    pinchPoint: primary.pinch,
    corridors: corridors.sort((a, b) => b.widthM - a.widthM),
  };
}

/** Access band label for display. */
export function machineAccessBandLabel(band: MachineAccessBand): string {
  switch (band) {
    case "barrow":
      return "barrow only";
    case "narrow":
      return "narrow-access machine";
    case "standard":
      return "standard bobcat access";
    case "none":
      return "no side access";
  }
}

/**
 * Labour multiplier for the preemptive estimate — replaces the binary
 * `accessConstrained` flag. Barrow/none sites carry the full 1.15 penalty;
 * narrow sites a reduced 1.08; standard sites no penalty.
 */
export function machineAccessLabourMultiplier(band: MachineAccessBand): number {
  switch (band) {
    case "barrow":
      return 1.15;
    case "none":
      return 1.15;
    case "narrow":
      return 1.08;
    case "standard":
      return 1.0;
  }
}

// -- internals --------------------------------------------------------------

type Edge = { a: MachineAccessPoint; b: MachineAccessPoint };
type MPoint = { x: number; y: number };

function edges(ring: MPoint[]): Edge[] {
  const out: Edge[] = [];
  for (let i = 0; i < ring.length; i++) {
    out.push({ a: ring[i]!, b: ring[(i + 1) % ring.length]! });
  }
  return out;
}

function midpoint(a: MPoint, b: MPoint): MPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function centroid(pts: MPoint[]): MPoint {
  if (pts.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / pts.length, y: sy / pts.length };
}

/** Classify a boundary edge by its position relative to the boundary centroid. */
function sideOf(
  e: Edge,
  bc: MPoint,
): "north" | "south" | "east" | "west" {
  const mid = midpoint(e.a, e.b);
  const dx = Math.abs(e.b.x - e.a.x);
  const dy = Math.abs(e.b.y - e.a.y);
  if (dx >= dy) {
    // Horizontal edge — north/south by midpoint y relative to centroid.
    return mid.y < bc.y ? "north" : "south";
  }
  // Vertical edge — east/west by midpoint x relative to centroid.
  return mid.x < bc.x ? "west" : "east";
}

/** Min distance between two line segments in 2D. */
function segmentToSegmentDistance(
  p1: MPoint,
  p2: MPoint,
  p3: MPoint,
  p4: MPoint,
): number {
  // Four point-to-segment distances + intersection check.
  if (segmentsIntersect(p1, p2, p3, p4)) return 0;
  return Math.min(
    pointToSegmentDistance(p1, p3, p4),
    pointToSegmentDistance(p2, p3, p4),
    pointToSegmentDistance(p3, p1, p2),
    pointToSegmentDistance(p4, p1, p2),
  );
}

function pointToSegmentDistance(p: MPoint, a: MPoint, b: MPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}

function segmentsIntersect(
  p1: MPoint,
  p2: MPoint,
  p3: MPoint,
  p4: MPoint,
): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

function cross(a: MPoint, b: MPoint, c: MPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function bandFor(
  widthMm: number,
  profile: OperatorPlantProfile | null,
): MachineAccessBand {
  if (widthMm <= 0) return "none";
  const machines = profile?.machines ?? [];
  // Standard = a "standard bobcat"-class machine (>= 1200 mm) fits.
  const standard = machines.some((m) => m.min_access_width_mm >= 1200 && widthMm >= m.min_access_width_mm);
  if (standard) return "standard";
  // Narrow = a mini-loader-class machine (800–1200 mm) fits.
  const narrow = machines.some(
    (m) => m.min_access_width_mm >= 800 && m.min_access_width_mm < 1200 && widthMm >= m.min_access_width_mm,
  );
  if (narrow) return "narrow";
  return "barrow";
}

function machineFor(
  widthMm: number,
  profile: OperatorPlantProfile | null,
): string | null {
  if (widthMm <= 0) return null;
  const machines = (profile?.machines ?? [])
    .filter((m) => m.min_access_width_mm > 0 && widthMm >= m.min_access_width_mm)
    .sort((a, b) => b.min_access_width_mm - a.min_access_width_mm);
  return machines[0]?.name ?? null;
}
