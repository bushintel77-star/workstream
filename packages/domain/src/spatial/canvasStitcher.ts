/**
 * Canvas Geometry & Photo-Trace Stitching Engine.
 *
 * Freehand sketch / photo-trace ink is drawn as disconnected multi-stroke
 * segments. This module welds them into CAD-ready geometry with a
 * deterministic spatial pipeline:
 *
 *   1. Proximity snap / vertex welding — stroke endpoints within a spatial
 *      tolerance ε (default 0.15 m in world space) merge into a single node.
 *   2. T-junction splitting — an endpoint landing on another segment's
 *      interior splits that segment at the junction so the graph connects.
 *   3. Segment fusion — adjacent connected edges walk into maximal chains,
 *      then redundant collinear intermediate points are removed, producing
 *      unified `FeaturePolyline` entities.
 *   4. Closed-loop detection — a welded chain whose start and end land on
 *      the same node becomes a `FeaturePolygon` (garden bed, footprint,
 *      boundary ring). Self-intersecting loops are demoted to polylines
 *      (invalid CAD polygons are never emitted) or split into simple rings.
 *   5. Overlap handling — duplicate parallel edges are deduped and
 *      collinear overlapping runs merge into their union span.
 *
 * Classification integration: every stroke is classified through
 * `classifySpatialEntity` (layer registry + provenance). When welded strokes
 * disagree on a layer, the higher-confidence classification wins, with the
 * state cadastre / Vicmap provenance breaking ties — a user draft never
 * overwrites a surveyed easement.
 *
 * Units: `SpatialPoint` is 2-D world space in metres (the WebGL studio's XZ
 * plane maps to (x, y)); ε is expressed in the same metres. The engine is
 * otherwise unit-agnostic.
 *
 * Non-destructive: `stitchCanvasStrokes` never mutates its input, and every
 * entity carries `meta.segments` — the fused source runs — so
 * `unstitchEntity` can split a merged path back into its constituent
 * strokes. UI undo stacks cover the stitch action itself.
 */

import {
  isRegisteredLayerId,
  type LayerID,
  type ProvenanceSource,
} from "../layers/layerRegistry";
import {
  classifySpatialEntity,
  provenanceOf,
  type ClassifiedSpatialFeature,
  type SpatialEntitySource,
} from "./classifySpatialEntity";

export interface SpatialPoint {
  x: number;
  y: number;
}

export type StitchClassification = {
  rule: string;
  confidence: "high" | "medium" | "low";
};

export type StitchUserModificationState =
  | "system_imported"
  | "user_drawn"
  | "user_edited";

/**
 * A raw stroke to stitch. `layerId` / `classification` are optional — when
 * absent the entity is classified through `classifySpatialEntity` using
 * `source` + `attributes` (the canonical ingestion path). `closed` forces an
 * implicit closing edge back to the first point.
 */
export interface SpatialStroke {
  id: string;
  /** Ordered polyline vertices, ≥ 2 (world metres). */
  points: SpatialPoint[];
  layerId?: LayerID;
  source?: SpatialEntitySource;
  /** Classifier hints / raw metadata — preserved verbatim on `meta.rawAttributes`. */
  attributes?: Record<string, unknown>;
  classification?: StitchClassification;
  userModificationState?: StitchUserModificationState;
  closed?: boolean;
}

/** Classification hook — defaults to `classifySpatialEntity`. */
export type StitchClassifier = (input: {
  id: string;
  source: SpatialEntitySource;
  attributes?: Record<string, unknown>;
}) => ClassifiedSpatialFeature;

export interface StitchOptions {
  /** Weld / snap tolerance in world metres. Default 0.15. */
  epsilonM?: number;
  /** Remove redundant collinear intermediate points after fusion. Default true. */
  mergeCollinear?: boolean;
  /** Angular tolerance (deg from 180°) for the collinear test. Default 3. */
  collinearToleranceDeg?: number;
  /** Convert welded loops into polygons. Default true. */
  closeLoops?: boolean;
  /**
   * Self-intersecting loop handling. "demote" (default) keeps the loop as a
   * polyline flagged `loop: "selfIntersecting"`; "split" cuts the ring at
   * the first crossing into two simple polygons.
   */
  selfIntersectionPolicy?: "demote" | "split";
  /** Override the classifier (defaults to `classifySpatialEntity`). */
  classify?: StitchClassifier;
}

/** Provenance of the entity and every stitching decision it carries. */
export interface StitchMeta {
  source: SpatialEntitySource;
  classification: StitchClassification;
  /** Raw attributes merged first-wins across the fused strokes. */
  rawAttributes: Record<string, unknown>;
  provenance: ProvenanceSource;
  userModificationState: StitchUserModificationState;
  /** Endpoint joins made while welding this entity. */
  weldedVertices: number;
  /** Adjacent-edge joins across distinct source strokes. */
  fusedSegments: number;
  /** Collinear intermediate points removed after fusion. */
  collinearPointsRemoved: number;
  /** The loop was only closed because stitching welded its ends. */
  closedByStitch: boolean;
  /** True when a detected loop was demoted for self-intersection. */
  selfIntersecting?: boolean;
  /** A weld actually moved an endpoint (positions differed > 1e-9 m). */
  snapped: boolean;
  /**
   * Fused source runs (post-weld, pre-simplification) — the lossless
   * constituent strokes `unstitchEntity` splits a merged path back into.
   */
  segments: SpatialPoint[][];
}

export interface FeaturePolyline {
  kind: "polyline";
  id: string;
  /** Simplified open vertex run (≥ 2). */
  points: SpatialPoint[];
  /** "closed" = closed loop kept as a line (closeLoops off); "selfIntersecting" = demoted loop. */
  loop?: "closed" | "selfIntersecting";
  layerId: LayerID;
  /** Source stroke ids, first-seen order. */
  strokeIds: string[];
  meta: StitchMeta;
}

export interface FeaturePolygon {
  kind: "polygon";
  id: string;
  /** Simplified closed ring (distinct vertices, implicit closure, ≥ 3). */
  ring: SpatialPoint[];
  layerId: LayerID;
  /** Shoelace area in m². */
  areaM2: number;
  strokeIds: string[];
  meta: StitchMeta;
}

export type StitchedFeature = FeaturePolyline | FeaturePolygon;

/** Compact provenance record — what the canvas store needs to un-stitch. */
export interface StitchRecord {
  segments: SpatialPoint[][];
  strokeIds: string[];
  layerId: LayerID;
  source: SpatialEntitySource;
  classification: StitchClassification;
  userModificationState: StitchUserModificationState;
}

export const DEFAULT_STITCH_EPSILON_M = 0.15;
const DEFAULT_COLLINEAR_TOL_DEG = 3;
const EPS = 1e-9;
const SEGMENT_END_MARGIN = 0.05; // projection parameter margin for T-junction splits

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function dist(a: SpatialPoint, b: SpatialPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Project p onto segment (a,b). Returns the raw parameter (may exceed 0..1),
 *  the clamped projection point, and the distance to it. */
function projectPointToSegment(
  p: SpatialPoint,
  a: SpatialPoint,
  b: SpatialPoint,
): { t: number; point: SpatialPoint; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS) return { t: 0, point: { ...a }, distance: dist(p, a) };
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  const tc = Math.min(1, Math.max(0, t));
  const point = { x: a.x + tc * dx, y: a.y + tc * dy };
  return { t, point, distance: dist(p, point) };
}

function cross(o: SpatialPoint, a: SpatialPoint, b: SpatialPoint): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Proper segment crossing (strictly interior on both segments). */
function segmentsIntersectAt(
  a: SpatialPoint,
  b: SpatialPoint,
  c: SpatialPoint,
  d: SpatialPoint,
): SpatialPoint | null {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  const proper =
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  if (!proper) return null;
  const t = d1 / (d1 - d2);
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

/** Shoelace area (m²) of a ring with implicit closure. */
function ringAreaM2(ring: SpatialPoint[]): number {
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Proper self-crossing among non-adjacent ring segments. */
function isSelfIntersecting(ring: SpatialPoint[]): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i += 1) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    for (let j = i + 1; j < n; j += 1) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // adjacent segments
      const c = ring[j]!;
      const d = ring[(j + 1) % n]!;
      if (segmentsIntersectAt(a, b, c, d)) return true;
    }
  }
  return false;
}

/** Cut a self-intersecting ring at the first proper crossing into two open
 *  simple rings (each with implicit closure back to the crossing point). */
function splitRingAtIntersection(ring: SpatialPoint[]): SpatialPoint[][] {
  const n = ring.length;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      const x = segmentsIntersectAt(
        ring[i]!,
        ring[(i + 1) % n]!,
        ring[j]!,
        ring[(j + 1) % n]!,
      );
      if (!x) continue;
      const ringA = [x, ...ring.slice(i + 1, j + 1)];
      const ringB = [x, ...ring.slice(j + 1), ...ring.slice(0, i + 1)];
      return [ringA, ringB];
    }
  }
  return [];
}

/** Angle (deg) at b between (b→a) and (b→c). Duplicate neighbours read 180°. */
function angleAtDeg(
  a: SpatialPoint,
  b: SpatialPoint,
  c: SpatialPoint,
): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const l1 = Math.hypot(v1x, v1y);
  const l2 = Math.hypot(v2x, v2y);
  if (l1 < EPS || l2 < EPS) return 180;
  const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (l1 * l2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Remove consecutive duplicate points. */
function stripConsecutiveDuplicates(pts: SpatialPoint[]): SpatialPoint[] {
  const out: SpatialPoint[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && dist(p, last) < EPS) continue;
    out.push(p);
  }
  return out;
}

/** Iteratively drop points whose neighbours are (near-)collinear. Junction
 *  points flagged `keep` (graph nodes with degree ≠ 2) are structural and
 *  never removed — a welded T-junction must survive fusion. */
function simplifyCollinear(
  pts: Array<{ p: SpatialPoint; keep: boolean }>,
  tolDeg: number,
): { points: SpatialPoint[]; removed: number } {
  const out = [...pts];
  let removed = 0;
  let changed = true;
  let guard = 0;
  while (changed && guard < 64) {
    changed = false;
    guard += 1;
    for (let i = 1; i < out.length - 1; i += 1) {
      if (out[i]!.keep) continue;
      if (angleAtDeg(out[i - 1]!.p, out[i]!.p, out[i + 1]!.p) >= 180 - tolDeg) {
        out.splice(i, 1);
        removed += 1;
        changed = true;
        i -= 1;
      }
    }
  }
  return { points: out.map((x) => x.p), removed };
}

/** Pair a walked run with its node-degree keep flags (interior vertices and
 *  pass-through degree-2 nodes are simplifiable; junctions are protected).
 *  Consecutive duplicates collapse, absorbing the keep flag. */
function buildRunPoints(
  run: SpatialPoint[],
  runNodes: Array<number | null>,
  degrees: Map<number, number>,
): Array<{ p: SpatialPoint; keep: boolean }> {
  const out: Array<{ p: SpatialPoint; keep: boolean }> = [];
  for (let i = 0; i < run.length; i += 1) {
    const nid = runNodes[i];
    const keep = nid !== null && (degrees.get(nid) ?? 0) !== 2;
    const last = out[out.length - 1];
    if (last && dist(run[i]!, last.p) < EPS) {
      if (keep) last.keep = true;
      continue;
    }
    out.push({ p: run[i]!, keep });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Classification & conflict resolution
// ---------------------------------------------------------------------------

const CONFIDENCE_RANK: Record<StitchClassification["confidence"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const PROVENANCE_RANK: Record<ProvenanceSource, number> = {
  state_cadastre: 3,
  council_gis: 2,
  user_drawn: 1,
  inferred: 0,
};

const SOURCE_TO_PROVENANCE: Record<SpatialEntitySource, ProvenanceSource> = {
  vicmap: "state_cadastre",
  dxf: "council_gis",
  user_stroke: "user_drawn",
  cad: "user_drawn",
  inferred: "inferred",
};

const defaultClassify: StitchClassifier = (input) =>
  classifySpatialEntity(input);

interface ClassifiedView {
  strokeIndex: number;
  layerId: LayerID;
  classification: StitchClassification;
  source: SpatialEntitySource;
  provenance: ProvenanceSource;
  userModificationState: StitchUserModificationState;
  rawAttributes: Record<string, unknown>;
}

/**
 * Classify a single stroke. Pre-classified strokes (registered `layerId`)
 * keep their layer; everything else goes through the classifier hook
 * (default `classifySpatialEntity`) so layer + provenance tags always
 * derive from the canonical ingestion path.
 */
function classifyStrokeInput(
  stroke: SpatialStroke,
  classify: StitchClassifier,
): Omit<ClassifiedView, "strokeIndex"> {
  const source = stroke.source ?? "user_stroke";
  if (stroke.layerId && isRegisteredLayerId(stroke.layerId)) {
    return {
      layerId: stroke.layerId,
      classification:
        stroke.classification ??
        {
          rule: `explicit layerId '${stroke.layerId}'`,
          confidence: "high",
        },
      source,
      provenance: SOURCE_TO_PROVENANCE[source],
      userModificationState:
        stroke.userModificationState ??
        (source === "user_stroke" ? "user_drawn" : "system_imported"),
      rawAttributes: stroke.attributes ?? {},
    };
  }
  const classified = classify({
    id: stroke.id,
    source,
    attributes: stroke.attributes,
  });
  return {
    layerId: classified.layerId,
    classification: classified.meta.classification,
    source: classified.meta.source,
    provenance: provenanceOf(classified),
    userModificationState:
      stroke.userModificationState ?? classified.userModificationState,
    rawAttributes: classified.meta.rawAttributes ?? stroke.attributes ?? {},
  };
}

function viewScore(v: ClassifiedView): number {
  return (
    CONFIDENCE_RANK[v.classification.confidence] * 10 +
    PROVENANCE_RANK[v.provenance]
  );
}

/** Deterministic conflict resolution: confidence first, then state-cadastre /
 *  Vicmap provenance; ties fall to input order (first stroke wins). */
function pickBestView(views: ClassifiedView[]): ClassifiedView {
  let best = views[0]!;
  for (const v of views.slice(1)) {
    if (viewScore(v) > viewScore(best)) best = v;
  }
  return best;
}

/**
 * Resolve the layer/classification conflict across strokes that will be
 * welded together. Confidence dominates; equal confidence prefers the state
 * cadastre / Vicmap provenance (e.g. `vicmap.easement` beats
 * `draft.user_draft`). Null when no stroke resolves.
 */
export function resolveLayerConflict(
  strokes: readonly SpatialStroke[],
  classify?: StitchClassifier,
): Omit<ClassifiedView, "strokeIndex"> | null {
  const views = strokes
    .filter((s) => s.points.length >= 2)
    .map((s, i) => ({
      ...classifyStrokeInput(s, classify ?? defaultClassify),
      strokeIndex: i,
    }));
  if (views.length === 0) return null;
  return pickBestView(views);
}

// ---------------------------------------------------------------------------
// Welding, T-junctions, edge building
// ---------------------------------------------------------------------------

class UnionFind {
  private readonly parent: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }

  find(x: number): number {
    let r = x;
    while (this.parent[r] !== r) r = this.parent[r]!;
    let c = x;
    while (this.parent[c] !== c) {
      const n = this.parent[c]!;
      this.parent[c] = r;
      c = n;
    }
    return r;
  }

  /** Union a into b's cluster. True when two clusters were actually joined. */
  union(a: number, b: number): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    this.parent[rb] = ra;
    return true;
  }
}

interface Candidate {
  id: number;
  point: SpatialPoint;
  kind: "endpoint" | "split";
  strokeIndex: number;
  end?: 0 | 1;
  segIndex?: number;
  t?: number;
}

interface RebuiltStroke {
  points: SpatialPoint[];
  nodeIds: Array<number | null>;
}

interface WeldGraph {
  rebuilt: RebuiltStroke[];
  nodePos: Map<number, SpatialPoint>;
  nodeWelds: Map<number, { joins: number; real: number }>;
}

/**
 * Weld stroke endpoints within ε (union-find, nearest-first for
 * determinism), split target segments where an endpoint lands on their
 * interior (T-junctions), and rebuild every stroke with welded node
 * positions. Interior points are never welded — only endpoints and junction
 * points are graph nodes.
 */
function weldAndRebuild(strokes: SpatialStroke[], epsM: number): WeldGraph {
  const candidates: Candidate[] = [];
  strokes.forEach((s, si) => {
    candidates.push({
      id: 0,
      point: s.points[0]!,
      kind: "endpoint",
      strokeIndex: si,
      end: 0,
    });
    candidates.push({
      id: 0,
      point: s.points[s.points.length - 1]!,
      kind: "endpoint",
      strokeIndex: si,
      end: 1,
    });
  });

  // T-junction projections — an endpoint within ε of a segment interior
  // splits that segment (the projection welds back onto the endpoint's
  // cluster). Segments whose own ends are near the endpoint are skipped —
  // that is the parallel/coincident case, not a junction.
  const splitsByStroke = new Map<number, Candidate[]>();
  const endpointCount = candidates.length;
  for (let c = 0; c < endpointCount; c += 1) {
    const ec = candidates[c]!;
    for (let si = 0; si < strokes.length; si += 1) {
      const pts = strokes[si]!.points;
      for (let k = 0; k < pts.length - 1; k += 1) {
        const a = pts[k]!;
        const b = pts[k + 1]!;
        if (dist(ec.point, a) <= epsM || dist(ec.point, b) <= epsM) continue;
        const { t, point, distance } = projectPointToSegment(ec.point, a, b);
        if (
          distance <= epsM &&
          t > SEGMENT_END_MARGIN &&
          t < 1 - SEGMENT_END_MARGIN
        ) {
          const cand: Candidate = {
            id: 0,
            point,
            kind: "split",
            strokeIndex: si,
            segIndex: k,
            t,
          };
          candidates.push(cand);
          const arr = splitsByStroke.get(si) ?? [];
          arr.push(cand);
          splitsByStroke.set(si, arr);
        }
      }
    }
  }
  candidates.forEach((c, i) => {
    c.id = i;
  });

  // Weld — each candidate joins the nearest previously-seen candidate
  // within ε (deterministic; cluster centroids fall out after all unions).
  const uf = new UnionFind(candidates.length);
  const weldPairs: Array<[number, number]> = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const pi = candidates[i]!.point;
    let best: number | null = null;
    let bestD = epsM;
    for (let j = 0; j < i; j += 1) {
      const d = dist(pi, candidates[j]!.point);
      if (d <= bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best !== null && uf.union(i, best)) weldPairs.push([i, best]);
  }

  const nodePos = new Map<number, SpatialPoint>();
  {
    const sums = new Map<number, { sx: number; sy: number; n: number }>();
    candidates.forEach((c, i) => {
      const r = uf.find(i);
      const s = sums.get(r) ?? { sx: 0, sy: 0, n: 0 };
      s.sx += c.point.x;
      s.sy += c.point.y;
      s.n += 1;
      sums.set(r, s);
    });
    for (const [r, s] of sums) nodePos.set(r, { x: s.sx / s.n, y: s.sy / s.n });
  }

  const nodeWelds = new Map<number, { joins: number; real: number }>();
  for (const [a, b] of weldPairs) {
    const root = uf.find(a);
    const rec = nodeWelds.get(root) ?? { joins: 0, real: 0 };
    rec.joins += 1;
    if (dist(candidates[a]!.point, candidates[b]!.point) > EPS) rec.real += 1;
    nodeWelds.set(root, rec);
  }

  const rebuilt = strokes.map((s, si) =>
    rebuildStroke(si, s, candidates, splitsByStroke.get(si) ?? [], uf, nodePos),
  );
  return { rebuilt, nodePos, nodeWelds };
}

/** Rebuild one stroke: welded endpoint positions, split insertions sorted by
 *  parameter, original interior points untouched. Node ids ride alongside
 *  every node position so edge building never needs reverse lookups. */
function rebuildStroke(
  si: number,
  stroke: SpatialStroke,
  candidates: Candidate[],
  splits: Candidate[],
  uf: UnionFind,
  nodePos: Map<number, SpatialPoint>,
): RebuiltStroke {
  const pts = stroke.points;
  const bySeg = new Map<number, Candidate[]>();
  for (const sp of splits) {
    const arr = bySeg.get(sp.segIndex!) ?? [];
    arr.push(sp);
    bySeg.set(sp.segIndex!, arr);
  }

  const out: SpatialPoint[] = [];
  const nodeIds: Array<number | null> = [];

  const pushNode = (p: SpatialPoint, nodeId: number) => {
    const last = out[out.length - 1];
    if (last && dist(p, last) < EPS) return;
    out.push(p);
    nodeIds.push(nodeId);
  };
  const pushVertex = (p: SpatialPoint) => {
    const last = out[out.length - 1];
    if (last && dist(p, last) < EPS) return;
    out.push(p);
    nodeIds.push(null);
  };

  const firstC = candidates[si * 2]!;
  pushNode(nodePos.get(uf.find(firstC.id))!, uf.find(firstC.id));

  for (let k = 0; k < pts.length - 1; k += 1) {
    const segSplits = (bySeg.get(k) ?? []).sort((a, b) => a.t! - b.t!);
    for (const sp of segSplits) {
      pushNode(nodePos.get(uf.find(sp.id))!, uf.find(sp.id));
    }
    if (k < pts.length - 2) pushVertex(pts[k + 1]!);
  }

  const lastC = candidates[si * 2 + 1]!;
  pushNode(nodePos.get(uf.find(lastC.id))!, uf.find(lastC.id));

  // Explicit closed input — force the closing edge back to the first node.
  if (
    stroke.closed &&
    out.length >= 2 &&
    dist(out[0]!, out[out.length - 1]!) >= EPS
  ) {
    const firstId = nodeIds[0]!;
    pushNode(nodePos.get(firstId)!, firstId);
  }
  return { points: out, nodeIds };
}

interface Edge {
  id: number;
  a: number;
  b: number;
  /** Intermediate vertices (welded positions), excluding the node ends. */
  interior: SpatialPoint[];
  strokeId: string;
  strokeIndex: number;
}

/** Edges = maximal runs between consecutive nodes within each rebuilt stroke. */
function buildEdges(strokes: SpatialStroke[], rebuilt: RebuiltStroke[]): Edge[] {
  const edges: Edge[] = [];
  let nextId = 0;
  rebuilt.forEach((rb, si) => {
    const nodeIdx = rb.nodeIds
      .map((id, i) => (id !== null ? i : -1))
      .filter((i) => i >= 0);
    for (let k = 0; k < nodeIdx.length - 1; k += 1) {
      const i = nodeIdx[k]!;
      const j = nodeIdx[k + 1]!;
      const a = rb.nodeIds[i]!;
      const b = rb.nodeIds[j]!;
      const interior = rb.points.slice(i + 1, j);
      // Self-loop: a stroke whose welded ends land on the same node (a
      // closed or near-closed ring) becomes a loop edge through its interior
      // vertices. Only a zero-length run (no interior) is truly degenerate.
      if (a === b && interior.length === 0) continue;
      edges.push({
        id: nextId,
        a,
        b,
        interior,
        strokeId: strokes[si]!.id,
        strokeIndex: si,
      });
      nextId += 1;
    }
  });
  return edges;
}

function buildAdjacency(edges: Edge[]): Map<number, number[]> {
  const adj = new Map<number, number[]>();
  for (const e of edges) {
    const la = adj.get(e.a) ?? [];
    la.push(e.id);
    adj.set(e.a, la);
    const lb = adj.get(e.b) ?? [];
    lb.push(e.id);
    adj.set(e.b, lb);
  }
  return adj;
}

/** Drop parallel edges between the same node pair (double-drawn runs). */
function dedupeParallelEdges(edges: Edge[]): Edge[] {
  const seen = new Set<string>();
  const out: Edge[] = [];
  for (const e of edges) {
    const key = e.a < e.b ? `${e.a}:${e.b}` : `${e.b}:${e.a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/**
 * Merge collinear, overlapping (parallel) edges into their union span —
 * safe only when every endpoint swallowed into the interior is a leaf (a
 * node with no other edges), so no topology is lost. Deterministic: the
 * first mergeable pair in edge order wins each pass.
 */
function mergeCollinearOverlaps(
  edges: Edge[],
  tolDeg: number,
  epsM: number,
  nodePos: Map<number, SpatialPoint>,
): { edges: Edge[]; merges: number } {
  let current = edges;
  let merges = 0;
  const tolRad = (tolDeg * Math.PI) / 180;
  for (let pass = 0; pass < 8; pass += 1) {
    const adjacency = buildAdjacency(current);
    let mergedAny = false;
    outer: for (let i = 0; i < current.length; i += 1) {
      for (let j = i + 1; j < current.length; j += 1) {
        const merged = tryMergePair(current[i]!, current[j]!, tolRad, epsM, adjacency, nodePos);
        if (!merged) continue;
        current = [
          ...current.slice(0, i),
          merged,
          ...current.slice(i + 1, j),
          ...current.slice(j + 1),
        ];
        merges += 1;
        mergedAny = true;
        break outer;
      }
    }
    if (!mergedAny) break;
  }
  return { edges: current, merges };
}

/** One collinear-overlap merge candidate, or null. */
function tryMergePair(
  e1: Edge,
  e2: Edge,
  tolRad: number,
  epsM: number,
  adjacency: Map<number, number[]>,
  nodePos: Map<number, SpatialPoint>,
): Edge | null {
  const p1 = nodePos.get(e1.a)!;
  const p2 = nodePos.get(e1.b)!;
  const q1 = nodePos.get(e2.a)!;
  const q2 = nodePos.get(e2.b)!;

  // Unit direction of e1.
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;
  const ux = dx / len;
  const uy = dy / len;

  // e2 must run (near-)parallel to e1 — either way round — within the
  // collinear angle tolerance. Shallow crossings are NOT merges.
  const e2dx = q2.x - q1.x;
  const e2dy = q2.y - q1.y;
  const e2len = Math.hypot(e2dx, e2dy);
  if (e2len < EPS) return null;
  if (Math.abs((e2dx * ux + e2dy * uy) / e2len) < Math.cos(tolRad)) return null;

  // Perpendicular distance of e2's endpoints from the e1 line must be within
  // the weld tolerance ε — beyond ε they are distinct features.
  const side = (p: SpatialPoint): number => (p.x - p1.x) * uy - (p.y - p1.y) * ux;
  if (Math.abs(side(q1)) > epsM || Math.abs(side(q2)) > epsM) return null;

  // Project all four endpoints onto the shared direction.
  const proj = (p: SpatialPoint): number => (p.x - p1.x) * ux + (p.y - p1.y) * uy;
  const t1 = proj(p1);
  const t2 = proj(p2);
  const s1 = proj(q1);
  const s2 = proj(q2);
  const lo = Math.min(t1, t2, s1, s2);
  const hi = Math.max(t1, t2, s1, s2);
  const overlap =
    Math.min(Math.max(t1, t2), Math.max(s1, s2)) -
    Math.max(Math.min(t1, t2), Math.min(s1, s2));
  if (overlap <= EPS) return null; // disjoint spans

  // Safety: an endpoint that falls strictly inside the union span may only
  // be demoted to an interior vertex when every edge incident to it is one
  // of the two being merged — otherwise the merge would detach topology.
  const isInteriorNode = (v: number): boolean => {
    const t = proj(nodePos.get(v)!);
    return t > lo + EPS && t < hi - EPS;
  };
  const leaf = (v: number): boolean => {
    const incident = adjacency.get(v) ?? [];
    return incident.every((eid) => eid === e1.id || eid === e2.id);
  };
  for (const v of [e1.a, e1.b, e2.a, e2.b]) {
    if (isInteriorNode(v) && !leaf(v)) return null;
  }

  // Union span: extremes keep their node identity; everything strictly
  // inside becomes an interior vertex of the merged edge, projection-sorted.
  const extreme = (wantLo: boolean): number => {
    const cands = [
      { v: e1.a, t: t1 },
      { v: e1.b, t: t2 },
      { v: e2.a, t: s1 },
      { v: e2.b, t: s2 },
    ];
    let best = cands[0]!;
    for (const c of cands) {
      if (wantLo ? c.t < best.t : c.t > best.t) best = c;
    }
    return best.v;
  };
  const aNode = extreme(true);
  const bNode = extreme(false);
  if (aNode === bNode) return null;

  const interiorPts: Array<{ t: number; p: SpatialPoint }> = [];
  const collect = (v: number, edgeT: number) => {
    if (edgeT > lo + EPS && edgeT < hi - EPS) {
      interiorPts.push({ t: edgeT, p: nodePos.get(v)! });
    }
  };
  collect(e1.a, t1);
  collect(e1.b, t2);
  collect(e2.a, s1);
  collect(e2.b, s2);
  for (const p of e1.interior) interiorPts.push({ t: proj(p), p });
  for (const p of e2.interior) interiorPts.push({ t: proj(p), p });
  interiorPts.sort((a, b) => a.t - b.t);
  const mergedInterior = stripConsecutiveDuplicates(interiorPts.map((x) => x.p));

  return {
    id: e1.id,
    a: aNode,
    b: bNode,
    interior: mergedInterior,
    strokeId: e1.strokeId,
    strokeIndex: e1.strokeIndex,
  };
}

// ---------------------------------------------------------------------------
// Chain walking — maximal chains + closed-loop extraction
// ---------------------------------------------------------------------------

interface DirectedEdge {
  e: Edge;
  /** Node the edge was traversed FROM. */
  from: number;
}

interface Chain {
  run: SpatialPoint[];
  /** Node id per run position (null = interior vertex). */
  runNodes: Array<number | null>;
  directed: DirectedEdge[];
}

interface Cycle {
  run: SpatialPoint[];
  runNodes: Array<number | null>;
  directed: DirectedEdge[];
  closureNode: number;
}

/**
 * Walk every edge exactly once (deterministic, creation order):
 *   - phase 1 starts walks at every node with degree ≠ 2 (junctions, free
 *     ends) — chains terminate when no unused edge remains at the current
 *     node, so they are maximal;
 *   - phase 2 walks the remaining pure cycles.
 * A walk that revisits a node peels the closed sub-run off as a `Cycle`
 * (lollipops, figure-8s) and keeps walking the open prefix.
 */
function walkGraph(
  edges: Edge[],
  adjacency: Map<number, number[]>,
  nodePos: Map<number, SpatialPoint>,
): { chains: Chain[]; cycles: Cycle[] } {
  const used = new Set<number>();
  const chains: Chain[] = [];
  const cycles: Cycle[] = [];
  const edgesById = new Map(edges.map((e) => [e.id, e]));

  const otherEnd = (e: Edge, from: number): number => (e.a === from ? e.b : e.a);

  const appendTraversal = (
    run: SpatialPoint[],
    runNodes: Array<number | null>,
    e: Edge,
    from: number,
  ) => {
    const to = otherEnd(e, from);
    const interior = e.a === from ? e.interior : [...e.interior].reverse();
    run.push(...interior);
    runNodes.push(...interior.map(() => null));
    run.push(nodePos.get(to)!);
    runNodes.push(to);
  };

  const walkFrom = (startNode: number, firstEdge: Edge): void => {
    const run: SpatialPoint[] = [nodePos.get(startNode)!];
    const runNodes: Array<number | null> = [startNode];
    const nodePath: number[] = [startNode];
    const nodeRunIdx: number[] = [0];
    const edgePath: DirectedEdge[] = [];

    used.add(firstEdge.id);
    appendTraversal(run, runNodes, firstEdge, startNode);
    edgePath.push({ e: firstEdge, from: startNode });
    let current = otherEnd(firstEdge, startNode);

    for (;;) {
      const pi = nodePath.indexOf(current);
      if (pi >= 0) {
        // Loop closed at an already-visited node — peel the cycle off.
        const cycleDirected = edgePath.slice(pi);
        cycles.push({
          run: run.slice(nodeRunIdx[pi]!),
          runNodes: runNodes.slice(nodeRunIdx[pi]!),
          directed: cycleDirected,
          closureNode: current,
        });
        run.length = nodeRunIdx[pi]! + 1;
        runNodes.length = nodeRunIdx[pi]! + 1;
        nodePath.length = pi + 1;
        nodeRunIdx.length = pi + 1;
        edgePath.length = pi;
      } else {
        nodePath.push(current);
        nodeRunIdx.push(run.length - 1);
      }

      let next: Edge | null = null;
      for (const eid of adjacency.get(current) ?? []) {
        if (!used.has(eid)) {
          next = edgesById.get(eid)!;
          break;
        }
      }
      if (!next) break;
      used.add(next.id);
      appendTraversal(run, runNodes, next, current);
      edgePath.push({ e: next, from: current });
      current = otherEnd(next, current);
    }

    if (run.length >= 2) {
      chains.push({ run: [...run], runNodes: [...runNodes], directed: [...edgePath] });
    }
  };

  const degrees = new Map<number, number>();
  for (const e of edges) {
    degrees.set(e.a, (degrees.get(e.a) ?? 0) + 1);
    degrees.set(e.b, (degrees.get(e.b) ?? 0) + 1);
  }
  for (const n of adjacency.keys()) {
    if ((degrees.get(n) ?? 0) === 2) continue;
    for (const eid of adjacency.get(n) ?? []) {
      if (!used.has(eid)) walkFrom(n, edgesById.get(eid)!);
    }
  }
  for (const e of edges) {
    if (!used.has(e.id)) walkFrom(e.a, e);
  }
  return { chains, cycles };
}

/** Consecutive-edge joins across distinct source strokes. */
function countFusions(directed: DirectedEdge[]): number {
  let n = 0;
  for (let i = 1; i < directed.length; i += 1) {
    if (directed[i]!.e.strokeIndex !== directed[i - 1]!.e.strokeIndex) n += 1;
  }
  return n;
}

function strokeIdsOf(directed: DirectedEdge[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { e } of directed) {
    if (!seen.has(e.strokeId)) {
      seen.add(e.strokeId);
      out.push(e.strokeId);
    }
  }
  return out;
}

/** The entity's vertex run split into maximal per-stroke sub-runs — the
 *  lossless constituent strokes for un-stitching. */
function segmentsFromDirectedEdges(
  directed: DirectedEdge[],
  nodePos: Map<number, SpatialPoint>,
): SpatialPoint[][] {
  const out: SpatialPoint[][] = [];
  let run: SpatialPoint[] = [];
  let runStroke = -1;
  for (const { e, from } of directed) {
    const to = e.a === from ? e.b : e.a;
    const fromPos = nodePos.get(from)!;
    if (run.length === 0) {
      run.push(fromPos);
    } else if (e.strokeIndex !== runStroke) {
      out.push(run);
      run = [fromPos];
    }
    const interior = e.a === from ? e.interior : [...e.interior].reverse();
    run.push(...interior, nodePos.get(to)!);
    runStroke = e.strokeIndex;
  }
  if (run.length > 0) out.push(run);
  return out;
}

// ---------------------------------------------------------------------------
// Entity building
// ---------------------------------------------------------------------------

interface BuildMetaArgs {
  view: ClassifiedView;
  allViews: ClassifiedView[];
  directed: DirectedEdge[];
  segments: SpatialPoint[][];
  nodeWelds: Map<number, { joins: number; real: number }>;
  collinearPointsRemoved: number;
  closedByStitch: boolean;
  selfIntersecting?: boolean;
}

function buildMeta(args: BuildMetaArgs): StitchMeta {
  const nodes = new Set<number>();
  for (const { e } of args.directed) {
    nodes.add(e.a);
    nodes.add(e.b);
  }
  let joins = 0;
  let real = 0;
  for (const n of nodes) {
    const rec = args.nodeWelds.get(n);
    if (rec) {
      joins += rec.joins;
      real += rec.real;
    }
  }
  // Raw attributes merge first-wins across every fused stroke so no source
  // metadata is lost, while layer/classification follow the winning view.
  const rawAttributes: Record<string, unknown> = {};
  for (const v of args.allViews) {
    for (const [k, val] of Object.entries(v.rawAttributes)) {
      if (!(k in rawAttributes)) rawAttributes[k] = val;
    }
  }
  const meta: StitchMeta = {
    source: args.view.source,
    classification: { ...args.view.classification },
    rawAttributes,
    provenance: args.view.provenance,
    userModificationState: args.view.userModificationState,
    weldedVertices: joins,
    fusedSegments: countFusions(args.directed),
    collinearPointsRemoved: args.collinearPointsRemoved,
    closedByStitch: args.closedByStitch,
    snapped: real > 0,
    segments: args.segments,
  };
  if (args.selfIntersecting) meta.selfIntersecting = true;
  return meta;
}

function entityView(allViews: ClassifiedView[], directed: DirectedEdge[]): ClassifiedView {
  const strokeIdx = new Set(directed.map((d) => d.e.strokeIndex));
  return pickBestView(allViews.filter((v) => strokeIdx.has(v.strokeIndex)));
}

function simplifyOpenRun(
  run: SpatialPoint[],
  runNodes: Array<number | null>,
  mergeCollinear: boolean,
  tolDeg: number,
  degrees: Map<number, number>,
): { points: SpatialPoint[]; removed: number } {
  const flagged = buildRunPoints(run, runNodes, degrees);
  // Cycle runs end where they started — drop the closing duplicate (the
  // opening point already carries the junction keep flag).
  const last = flagged[flagged.length - 1];
  if (flagged.length > 1 && last && dist(flagged[0]!.p, last.p) < EPS) {
    flagged.pop();
  }
  if (!mergeCollinear) return { points: flagged.map((x) => x.p), removed: 0 };
  return simplifyCollinear(flagged, tolDeg);
}

/** Open point list with no protected vertices (split sub-rings). */
function plainRunPoints(pts: SpatialPoint[]): Array<{ p: SpatialPoint; keep: boolean }> {
  return pts.map((p) => ({ p, keep: false }));
}

function chainToPolyline(
  chain: Chain,
  opts: NormalizedOptions,
  allViews: ClassifiedView[],
  nodePos: Map<number, SpatialPoint>,
  nodeWelds: Map<number, { joins: number; real: number }>,
  degrees: Map<number, number>,
  index: () => number,
): FeaturePolyline | null {
  const { points, removed } = simplifyOpenRun(
    chain.run,
    chain.runNodes,
    opts.mergeCollinear,
    opts.collinearToleranceDeg,
    degrees,
  );
  if (points.length < 2) return null;
  const view = entityView(allViews, chain.directed);
  return {
    kind: "polyline",
    id: `stitched-${index()}-polyline`,
    points,
    layerId: view.layerId,
    strokeIds: strokeIdsOf(chain.directed),
    meta: buildMeta({
      view,
      allViews,
      directed: chain.directed,
      segments: segmentsFromDirectedEdges(chain.directed, nodePos),
      nodeWelds,
      collinearPointsRemoved: removed,
      closedByStitch: false,
    }),
  };
}

function cycleToFeatures(
  cycle: Cycle,
  opts: NormalizedOptions,
  allViews: ClassifiedView[],
  nodePos: Map<number, SpatialPoint>,
  nodeWelds: Map<number, { joins: number; real: number }>,
  degrees: Map<number, number>,
  index: () => number,
): StitchedFeature[] {
  const out: StitchedFeature[] = [];
  const { points: ring, removed } = simplifyOpenRun(
    cycle.run,
    cycle.runNodes,
    opts.mergeCollinear,
    opts.collinearToleranceDeg,
    degrees,
  );
  if (ring.length < 3) return out;

  const view = entityView(allViews, cycle.directed);
  const strokeIds = strokeIdsOf(cycle.directed);
  const closureWelds = nodeWelds.get(cycle.closureNode);
  const closedByStitch =
    strokeIds.length > 1 || (closureWelds?.real ?? 0) > 0;
  const segments = segmentsFromDirectedEdges(cycle.directed, nodePos);

  if (isSelfIntersecting(ring)) {
    if (opts.selfIntersectionPolicy === "split") {
      for (const sub of splitRingAtIntersection(ring)) {
        const subFlags = plainRunPoints(sub);
        const { points: subRing, removed: subRemoved } = opts.mergeCollinear
          ? simplifyCollinear(subFlags, opts.collinearToleranceDeg)
          : { points: sub, removed: 0 };
        if (subRing.length < 3 || isSelfIntersecting(subRing)) continue;
        out.push({
          kind: "polygon",
          id: `stitched-${index()}-polygon`,
          ring: subRing,
          layerId: view.layerId,
          areaM2: ringAreaM2(subRing),
          strokeIds,
          meta: buildMeta({
            view,
            allViews,
            directed: cycle.directed,
            segments,
            nodeWelds,
            collinearPointsRemoved: removed + subRemoved,
            closedByStitch,
            selfIntersecting: true,
          }),
        });
      }
      if (out.length > 0) return out;
    }
    // Demote — an invalid CAD polygon is never emitted.
    out.push({
      kind: "polyline",
      id: `stitched-${index()}-polyline`,
      points: ring,
      loop: "selfIntersecting",
      layerId: view.layerId,
      strokeIds,
      meta: buildMeta({
        view,
        allViews,
        directed: cycle.directed,
        segments,
        nodeWelds,
        collinearPointsRemoved: removed,
        closedByStitch,
        selfIntersecting: true,
      }),
    });
    return out;
  }

  if (opts.closeLoops) {
    out.push({
      kind: "polygon",
      id: `stitched-${index()}-polygon`,
      ring,
      layerId: view.layerId,
      areaM2: ringAreaM2(ring),
      strokeIds,
      meta: buildMeta({
        view,
        allViews,
        directed: cycle.directed,
        segments,
        nodeWelds,
        collinearPointsRemoved: removed,
        closedByStitch,
      }),
    });
  } else {
    out.push({
      kind: "polyline",
      id: `stitched-${index()}-polyline`,
      points: ring,
      loop: "closed",
      layerId: view.layerId,
      strokeIds,
      meta: buildMeta({
        view,
        allViews,
        directed: cycle.directed,
        segments,
        nodeWelds,
        collinearPointsRemoved: removed,
        closedByStitch,
      }),
    });
  }
  return out;
}

interface NormalizedOptions {
  epsilonM: number;
  mergeCollinear: boolean;
  collinearToleranceDeg: number;
  closeLoops: boolean;
  selfIntersectionPolicy: "demote" | "split";
  classify: StitchClassifier;
}

function normalizeOptions(options: StitchOptions): NormalizedOptions {
  return {
    epsilonM: options.epsilonM ?? DEFAULT_STITCH_EPSILON_M,
    mergeCollinear: options.mergeCollinear ?? true,
    collinearToleranceDeg: options.collinearToleranceDeg ?? DEFAULT_COLLINEAR_TOL_DEG,
    closeLoops: options.closeLoops ?? true,
    selfIntersectionPolicy: options.selfIntersectionPolicy ?? "demote",
    classify: options.classify ?? defaultClassify,
  };
}

/**
 * Stitch disconnected strokes into fused CAD geometry.
 *
 * Welds endpoints within ε, splits T-junctions, fuses connected segments
 * into `FeaturePolyline`s, and promotes welded closed loops to
 * `FeaturePolygon`s. Deterministic: identical input always yields identical
 * output. Empty / degenerate input returns [].
 */
export function stitchCanvasStrokes(
  strokes: readonly SpatialStroke[],
  options: StitchOptions = {},
): StitchedFeature[] {
  const opts = normalizeOptions(options);
  const valid = strokes.filter((s) => s.points.length >= 2);
  if (valid.length === 0) return [];

  const allViews = valid.map((s, i) => ({
    ...classifyStrokeInput(s, opts.classify),
    strokeIndex: i,
  }));

  const { rebuilt, nodePos, nodeWelds } = weldAndRebuild(valid, opts.epsilonM);

  let edges = buildEdges(valid, rebuilt);
  edges = dedupeParallelEdges(edges);
  edges = mergeCollinearOverlaps(
    edges,
    opts.collinearToleranceDeg,
    opts.epsilonM,
    nodePos,
  ).edges;
  if (edges.length === 0) return [];

  const adjacency = buildAdjacency(edges);
  const { chains, cycles } = walkGraph(edges, adjacency, nodePos);

  // Global node degrees — junction nodes (degree ≠ 2) survive collinear
  // simplification because welding them away would break the topology.
  const degrees = new Map<number, number>();
  for (const e of edges) {
    degrees.set(e.a, (degrees.get(e.a) ?? 0) + 1);
    degrees.set(e.b, (degrees.get(e.b) ?? 0) + 1);
  }

  const out: StitchedFeature[] = [];
  let counter = 0;
  const index = () => counter++;
  for (const chain of chains) {
    const f = chainToPolyline(chain, opts, allViews, nodePos, nodeWelds, degrees, index);
    if (f) out.push(f);
  }
  for (const cycle of cycles) {
    out.push(...cycleToFeatures(cycle, opts, allViews, nodePos, nodeWelds, degrees, index));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Live-snap helpers (canvas + photo-trace highlights) and un-stitching
// ---------------------------------------------------------------------------

/**
 * The welded endpoint nodes of a stroke set — the "existing nodes" the
 * canvas highlights when a drawing cursor (or unwarped photo stroke
 * endpoint) falls within the ε-snap radius.
 */
export function collectSnapNodes(
  strokes: readonly SpatialStroke[],
  epsilonM?: number,
): SpatialPoint[] {
  const eps = epsilonM ?? DEFAULT_STITCH_EPSILON_M;
  const valid = strokes.filter((s) => s.points.length >= 2);
  const candidates = valid.flatMap((s) => [
    { id: 0, point: s.points[0]! },
    { id: 0, point: s.points[s.points.length - 1]! },
  ]);
  candidates.forEach((c, i) => {
    c.id = i;
  });
  const uf = new UnionFind(candidates.length);
  for (let i = 0; i < candidates.length; i += 1) {
    let best: number | null = null;
    let bestD = eps;
    for (let j = 0; j < i; j += 1) {
      const d = dist(candidates[i]!.point, candidates[j]!.point);
      if (d <= bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best !== null) uf.union(i, best);
  }
  const sums = new Map<number, { sx: number; sy: number; n: number }>();
  candidates.forEach((c, i) => {
    const r = uf.find(i);
    const s = sums.get(r) ?? { sx: 0, sy: 0, n: 0 };
    s.sx += c.point.x;
    s.sy += c.point.y;
    s.n += 1;
    sums.set(r, s);
  });
  return [...sums.values()].map((s) => ({ x: s.sx / s.n, y: s.sy / s.n }));
}

export interface SnapCandidate {
  point: SpatialPoint;
  distanceM: number;
}

/** Nodes within the ε-snap radius of a point, nearest first (ties broken
 *  deterministically by position). */
export function findSnapCandidates(
  point: SpatialPoint,
  nodes: readonly SpatialPoint[],
  epsilonM?: number,
): SnapCandidate[] {
  const eps = epsilonM ?? DEFAULT_STITCH_EPSILON_M;
  return nodes
    .map((n) => ({ point: n, distanceM: dist(point, n) }))
    .filter((c) => c.distanceM <= eps)
    .sort(
      (a, b) =>
        a.distanceM - b.distanceM ||
        a.point.x - b.point.x ||
        a.point.y - b.point.y,
    );
}

/** Snap a point to the nearest node within ε; unchanged when none is near. */
export function snapPointToNodes(
  point: SpatialPoint,
  nodes: readonly SpatialPoint[],
  epsilonM?: number,
): { point: SpatialPoint; candidate: SnapCandidate | null } {
  const candidates = findSnapCandidates(point, nodes, epsilonM);
  if (candidates.length === 0) return { point, candidate: null };
  const best = candidates[0]!;
  return { point: best.point, candidate: best };
}

/** Compact provenance record — what the canvas store needs to un-stitch. */
export function stitchRecordOf(entity: StitchedFeature): StitchRecord {
  return {
    segments: entity.meta.segments.map((s) => [...s]),
    strokeIds: [...entity.strokeIds],
    layerId: entity.layerId,
    source: entity.meta.source,
    classification: { ...entity.meta.classification },
    userModificationState: entity.meta.userModificationState,
  };
}

/**
 * Split a merged entity back into its constituent strokes — the non-
 * destructive un-stitch primitive. Each returned stroke is one fused source
 * run (post-weld), carrying the entity's layer + provenance so the split is
 * lossless; the caller keeps the original entity and any undo snapshot.
 */
export function unstitchEntity(entity: StitchedFeature): SpatialStroke[] {
  return entity.meta.segments.map((seg, i) => ({
    id: `${entity.id}::split::${i}`,
    points: [...seg],
    layerId: entity.layerId,
    source: entity.meta.source,
    attributes: { ...entity.meta.rawAttributes },
    classification: { ...entity.meta.classification },
    userModificationState: entity.meta.userModificationState,
  }));
}
