/**
 * Gold Standard 2026 — Flow Field (drainage overland-flow derivation).
 *
 * Pure module: derives where water goes from the SHARED terrainMath sampler —
 * the same surface the TerrainMesh renders, the ink drapes over, and the
 * elevation slice cuts. No sink filling / depression breaching: depressions
 * pond, and the ponding points ARE the product (they tell the operator where
 * a design needs drainage attention).
 *
 * Algorithm — classic D8 flow routing on the TerrainMesh grid:
 *   1. Sample elevations at every node of the same 60×60 grid + extents the
 *      TerrainMesh uses (w = scaleM×3, h = scaleM×boardAspect×3), so the
 *      derived flow lies exactly on the visible surface.
 *   2. Each node's D8 receiver = the steepest-descent of its 8 neighbours
 *      (slope = Δelev / centre-to-centre distance). No lower neighbour → pit.
 *   3. Flow accumulation: process nodes elevation-descending; each node
 *      contributes its accumulated cell count to its receiver. Because D8
 *      receivers are strictly lower, descending order finalises a node's
 *      total before any downstream node reads it.
 *   4. Streams = node→receiver edges where accumulation ≥ threshold
 *      (fraction of total cells — scale independent), chained into maximal
 *      polylines. Ponds = interior pits with real catchment + real relief.
 *
 * Vertical units: the sampler returns ×VERTICAL_SCALE-exaggerated metres
 * (terrainMath convention). Steepest-descent DIRECTION is invariant under a
 * uniform vertical scale, so the routing is unaffected; depth readouts are
 * converted to real metres via VERTICAL_SCALE like the SliceProfileCard's
 * "Δ real" pattern.
 *
 * Flat-site contract: zero relief → no downhill links, no streams, no ponds
 * (every candidate pond fails the min-depth test) — the feature is silently
 * inert, matching the sampler-null degradation of the other instruments.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2 (Vertical Truth consumers)
 */

import { GRID_SEGMENTS, VERTICAL_SCALE } from "./terrainMath";

/** Streams render where accumulation ≥ this fraction of all grid cells. */
export const STREAM_MIN_ACCUM_FRACTION = 0.008;
/** A pond is reported where its catchment ≥ this fraction of all cells. */
export const POND_MIN_ACCUM_FRACTION = 0.01;
/** Minimum local relief (REAL metres) for a pit to read as a pond. */
export const POND_MIN_DEPTH_M = 0.04;

/** Max ponding markers rendered (HUD lists the top 3 of these). */
export const MAX_POND_MARKERS = 6;

export interface FlowGrid {
  /** Nodes per axis (segments + 1). Row-major: idx = row * cols + col. */
  cols: number;
  rows: number;
  /** World coord of node (0,0) (min corner, grid centred on the origin). */
  x0: number;
  z0: number;
  /** Node spacing in world metres. */
  dx: number;
  dz: number;
  /** Exaggerated elevations (same units as the sampler). */
  elev: Float32Array;
  /** Steepest-descent neighbour index, or -1 for a pit/outlet node. */
  downhill: Int32Array;
  /** Upstream cell count draining through each node (self included). */
  accumulation: Float32Array;
  /** Steepest single-node slope across the grid, as % (real metres basis). */
  maxSlopePct: number;
}

/**
 * Build the D8 flow grid over a world rectangle. `sampler` comes from
 * createElevationSampler; `w`/`h` must match the TerrainMesh extents
 * (buildStudioFlowGrid applies them for you).
 */
export function buildFlowGrid(
  sampler: (worldX: number, worldZ: number) => number,
  w: number,
  h: number,
  segments: number,
): FlowGrid {
  const cols = segments + 1;
  const rows = segments + 1;
  const dx = w / segments;
  const dz = h / segments;
  const x0 = -w / 2;
  const z0 = -h / 2;
  const n = cols * rows;

  const elev = new Float32Array(n);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      elev[row * cols + col] = sampler(x0 + col * dx, z0 + row * dz);
    }
  }

  // D8 receivers — steepest descent by slope (not raw Δelev; diagonals are
  // longer, so the diagonal must be steeper in absolute drop to win).
  const downhill = new Int32Array(n).fill(-1);
  let maxSlopePct = 0;
  const diag = Math.hypot(dx, dz);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const e = elev[i]!;
      let best = -1;
      let bestSlope = 0;
      for (let dr = -1; dr <= 1; dr++) {
        const nr = row + dr;
        if (nr < 0 || nr >= rows) continue;
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nc = col + dc;
          if (nc < 0 || nc >= cols) continue;
          const j = nr * cols + nc;
          const drop = e - elev[j]!;
          if (drop <= 0) continue;
          const dist = dr !== 0 && dc !== 0 ? diag : dr !== 0 ? dz : dx;
          const slope = drop / dist;
          if (slope > bestSlope) {
            bestSlope = slope;
            best = j;
          }
        }
      }
      downhill[i] = best;
      if (bestSlope > 0) {
        // Slope is scale-invariant vertically, so the % is already real-basis.
        const pct = bestSlope * 100;
        if (pct > maxSlopePct) maxSlopePct = pct;
      }
    }
  }

  // Accumulation — elevation-descending pass. Sort indices by elev (desc);
  // each node pushes its (already final) total into its receiver.
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => elev[b]! - elev[a]!,
  );
  const accumulation = new Float32Array(n).fill(1);
  for (const i of order) {
    const j = downhill[i]!;
    if (j >= 0) accumulation[j] += accumulation[i]!;
  }

  return { cols, rows, x0, z0, dx, dz, elev, downhill, accumulation, maxSlopePct };
}

/**
 * Convenience wrapper — applies the TerrainMesh extents + grid resolution.
 * Keeping the formula next to the routing keeps the stream network locked to
 * the visible surface (same 60×60 nodes over w = scaleM×3).
 */
export function buildStudioFlowGrid(
  sampler: (worldX: number, worldZ: number) => number,
  scaleM: number,
  boardAspect: number,
): FlowGrid {
  return buildFlowGrid(sampler, scaleM * 3, scaleM * boardAspect * 3, GRID_SEGMENTS);
}

/** A single stream path — world-space polyline (exaggerated Y from the grid). */
export interface StreamPath {
  /** [x, y, z] triples following the water downhill. */
  points: Array<[number, number, number]>;
  /** Peak accumulation along the path (cell count) — drives line weight. */
  maxAccum: number;
}

/**
 * Trace the stream network: edges whose upstream accumulation clears the
 * threshold, chained node→receiver into maximal polylines (headwater →
 * outlet/pond). Pure function of the grid.
 */
export function traceStreamNetwork(
  grid: FlowGrid,
  minAccumFraction = STREAM_MIN_ACCUM_FRACTION,
): StreamPath[] {
  const { cols, rows, x0, z0, dx, dz, elev, downhill, accumulation } = grid;
  const n = cols * rows;
  const minAccum = Math.max(2, Math.floor(minAccumFraction * n));

  const isStream = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (accumulation[i]! >= minAccum) isStream[i] = 1;
  }

  // A stream edge exists where a stream node's receiver is also a stream node
  // (or the node is the last before a pond/off-grid — receiver keeps flowing
  // only while it also carries the threshold).
  const hasOutgoing = new Uint8Array(n);
  const indegree = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const j = downhill[i]!;
    if (isStream[i] && j >= 0 && isStream[j]) {
      hasOutgoing[i] = 1;
      indegree[j]! += 1;
    }
  }

  const world = (i: number): [number, number, number] => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    return [x0 + col * dx, elev[i]!, z0 + row * dz];
  };

  const paths: StreamPath[] = [];
  for (let start = 0; start < n; start++) {
    // Head of a polyline: a stream node with no incoming stream edge (or an
    // incoming edge from a non-stream tributary — indegree counts only
    // stream edges, so headwaters have indegree 0).
    if (!isStream[start] || indegree[start]! > 0) continue;

    const points: Array<[number, number, number]> = [world(start)];
    let maxAccum = accumulation[start]!;
    let node = start;
    while (hasOutgoing[node]) {
      node = downhill[node]!;
      points.push(world(node));
      const a = accumulation[node]!;
      if (a > maxAccum) maxAccum = a;
    }
    if (points.length >= 2) paths.push({ points, maxAccum });
  }
  return paths;
}

/** A ponding point — an interior pit with real catchment and real relief. */
export interface PondingPoint {
  x: number;
  z: number;
  /** Surface elevation at the pit (exaggerated units, like the grid). */
  elevY: number;
  /** Depth below the lowest rim neighbour, in REAL metres. */
  depthM: number;
  /** Upstream catchment area in m² (accumulated cells × cell area). */
  catchmentM2: number;
}

/**
 * Find ponding points: interior pits (no lower neighbour) whose catchment
 * clears the fraction threshold and whose local relief exceeds the minimum
 * depth. Boundary pits are outlets (water leaves the domain), not ponds.
 * Sorted by catchment, largest first.
 */
export function findPondingPoints(
  grid: FlowGrid,
  minAccumFraction = POND_MIN_ACCUM_FRACTION,
  minDepthM = POND_MIN_DEPTH_M,
): PondingPoint[] {
  const {
    cols,
    rows,
    x0,
    z0,
    dx,
    dz,
    elev,
    downhill,
    accumulation,
  } = grid;
  const n = cols * rows;
  const minAccum = Math.max(2, Math.floor(minAccumFraction * n));
  const minDepthExaggerated = minDepthM * VERTICAL_SCALE;
  const cellArea = dx * dz;

  const ponds: PondingPoint[] = [];
  for (let row = 1; row < rows - 1; row++) {
    for (let col = 1; col < cols - 1; col++) {
      const i = row * cols + col;
      if (downhill[i] !== -1) continue; // not a pit
      if (accumulation[i]! < minAccum) continue; // negligible catchment

      // Local relief — lowest rim neighbour above the pit.
      let minRim = Infinity;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rim = elev[(row + dr) * cols + (col + dc)]!;
          if (rim < minRim) minRim = rim;
        }
      }
      const depth = minRim - elev[i]!;
      if (depth < minDepthExaggerated) continue; // flat micro-noise, not a pond

      ponds.push({
        x: x0 + col * dx,
        z: z0 + row * dz,
        elevY: elev[i]!,
        depthM: depth / VERTICAL_SCALE,
        catchmentM2: accumulation[i]! * cellArea,
      });
    }
  }

  ponds.sort((a, b) => b.catchmentM2 - a.catchmentM2);
  return ponds;
}
