/**
 * Section profile — the pure math core of the cross-section view (spec 9.6).
 *
 * Samples the existing grade along a cut line, overlays the proposed pad
 * grade where earthworks cross the cut, and yields cut/fill bands (the hatch
 * regions). Rendering (dashed existing / solid proposed / 45°± hatch + RL
 * datums) is a separate layer; this module owns the numbers so the draw layer
 * can never disagree with the terrain mesh or the cut/fill readouts.
 */

export interface SectionPad {
  worldXZ: Array<{ x: number; z: number }>;
  heightM: number;
}

export interface SectionPoint {
  /** Distance along the cut, 0..lengthM. */
  t: number;
  x: number;
  z: number;
  /** Existing grade (sampled terrain elevation). */
  existing: number;
  /** Proposed grade at this station, or null where no pad covers it. */
  proposed: number | null;
}

export interface SectionCutBand {
  t0: number;
  t1: number;
  kind: "cut" | "fill";
  /** Depth magnitude: cut = existing − proposed, fill = proposed − existing. */
  depth: number;
}

export interface SectionProfile {
  points: SectionPoint[];
  bands: SectionCutBand[];
  lengthM: number;
}

/** Point-in-polygon (XZ plane), ray casting. */
export function pointInPadXZ(
  x: number,
  z: number,
  ring: Array<{ x: number; z: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (
      a.z > z !== b.z > z &&
      x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function buildSectionProfile(input: {
  cut: { x0: number; z0: number; x1: number; z1: number };
  elevAt: (x: number, z: number) => number;
  pads?: SectionPad[];
  samples?: number;
}): SectionProfile {
  const { x0, z0, x1, z1 } = input.cut;
  const pads = input.pads ?? [];
  const samples = Math.max(8, input.samples ?? 64);
  const dx = x1 - x0;
  const dz = z1 - z0;
  const lengthM = Math.hypot(dx, dz);
  if (lengthM === 0) {
    return { points: [], bands: [], lengthM: 0 };
  }

  const points: SectionPoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const f = i / samples;
    const x = x0 + dx * f;
    const z = z0 + dz * f;
    const existing = input.elevAt(x, z);
    const pad = pads.find((p) => pointInPadXZ(x, z, p.worldXZ));
    points.push({
      t: lengthM * f,
      x,
      z,
      existing,
      proposed: pad ? pad.heightM : null,
    });
  }

  const bands: SectionCutBand[] = [];
  let band: SectionCutBand | null = null;
  for (const p of points) {
    if (p.proposed == null) {
      band = null;
      continue;
    }
    const kind: SectionCutBand["kind"] = p.proposed < p.existing ? "cut" : "fill";
    const depth = Math.abs(p.existing - p.proposed);
    if (band && band.kind === kind) {
      band.t1 = p.t;
      band.depth = Math.max(band.depth, depth);
    } else {
      band = { t0: p.t, t1: p.t, kind, depth };
      bands.push(band);
    }
  }

  return { points, bands, lengthM };
}
