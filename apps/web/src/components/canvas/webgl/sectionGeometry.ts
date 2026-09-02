/**
 * Section render geometry — lays a SectionProfile into world space along its
 * cut line. Pure and tested; the R3F layer consumes these primitives verbatim.
 *
 * The profile plane runs along the cut (horizontal axis = distance along the
 * cut, vertical = elevation). A profile point (t, elev) maps to world
 * (x0 + ux·t, elev, z0 + uz·t). Cut/fill bands become filled quads between the
 * two grades; the RL datum column is a fixed ladder (spec 6c).
 */

import type { SectionProfile } from "./sectionProfile";
import { VERTICAL_SCALE } from "./terrainMath";

export interface SectionCut {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export type V3 = [number, number, number];

export interface SectionBandQuad {
  kind: "cut" | "fill";
  corners: [V3, V3, V3, V3];
}

export interface SectionGeometry {
  /** Existing-grade polyline (dashed in the renderer). */
  existing: V3[];
  /** Proposed-grade segments (only where a pad covers the cut). */
  proposed: Array<[V3, V3]>;
  bandQuads: SectionBandQuad[];
  /** RL datum elevations, one column (spec 6c). */
  datumYs: number[];
  lengthM: number;
}

export const SECTION_DATUMS = [0, 1.5, 3.0, 4.5, 6.0];

export function buildSectionGeometry(
  profile: SectionProfile,
  cut: SectionCut,
  opts?: { yScale?: number },
): SectionGeometry {
  // The drawn profile must sit at the SAME vertical exaggeration as the
  // TerrainMesh, or the "section" visibly disagrees with the grade it
  // claims to cut (raw elevation vs ×VERTICAL_SCALE displaced mesh).
  const yScale = opts?.yScale ?? VERTICAL_SCALE;
  const dx = cut.x1 - cut.x0;
  const dz = cut.z1 - cut.z0;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const at = (t: number, elev: number): V3 => [
    cut.x0 + ux * t,
    elev * yScale,
    cut.z0 + uz * t,
  ];

  const existing: V3[] = profile.points.map((p) => at(p.t, p.existing));

  const proposed: Array<[V3, V3]> = [];
  for (let i = 0; i < profile.points.length - 1; i++) {
    const a = profile.points[i]!;
    const b = profile.points[i + 1]!;
    if (a.proposed == null || b.proposed == null) continue;
    proposed.push([at(a.t, a.proposed), at(b.t, b.proposed)]);
  }

  const bandQuads: SectionBandQuad[] = [];
  for (const band of profile.bands) {
    const pts = profile.points.filter(
      (p) => p.t >= band.t0 - 1e-6 && p.t <= band.t1 + 1e-6,
    );
    const start = pts[0];
    const end = pts[pts.length - 1];
    if (!start || !end) continue;
    // The band spans between the ACTUAL grades at its edges — proposed on
    // top, existing below — never a flat 0..depth strip.
    const topY = (p: SectionProfile["points"][number]) =>
      p.proposed == null ? p.existing : p.proposed;
    bandQuads.push({
      kind: band.kind,
      corners: [
        at(start.t, topY(start)),
        at(end.t, topY(end)),
        at(end.t, end.existing),
        at(start.t, start.existing),
      ],
    });
  }

  return {
    existing,
    proposed,
    bandQuads,
    datumYs: SECTION_DATUMS,
    lengthM: profile.lengthM,
  };
}
