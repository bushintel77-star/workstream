/**
 * Gold Standard 2026 — Precision drafting (Polyline + Area) pure maths.
 *
 * The click-to-place counterpart to the freehand `FusedSketchLayer`. Everything
 * here is pure so the draft-session reducer, the live readout and both commit
 * shapes are unit-testable without a WebGL context:
 *
 *   - session reducer   — add / undo / cancel a vertex run
 *   - live readout      — segment length (m) + bearing (deg from north)
 *   - boundary edges    — the title ring as world-metre snap segments, the
 *                         same per-edge geometry `DimensionLayer` derives
 *   - commit shapes     — Polyline → `CanvasStroke` (kind "shape"),
 *                         Area     → `LandscapeFeature` (Polygon region)
 *
 * Persistence law (docs/precision-drafting-tools-spec.md §3, §6b): a polyline
 * writes BOTH `shape_points` (the clicked control points) and `points` (the
 * flattened render path). `points` is what makes it render — the existing
 * `CommittedStrokeRenderer` draws from `points` alone — so no new renderer
 * exists. An Area is a region, not linework, so it persists as a
 * `LandscapeFeature` and is a costable entity the moment it is drawn.
 *
 * Binding: docs/precision-drafting-tools-spec.md §5–§6
 */

import type { CanvasStroke, LandscapeFeature } from "@workstream/contracts";
import { pctToWorld, worldToPct, type PctPoint } from "./coordTransform";
import { nibSpec } from "./nibs";
import type { SnapSegment, WorldXZ } from "./snapWorld";

/** The two v1 drafting tools. Curve is v2 (spec §7 slice table). */
export type DraftTool = "polyline" | "area";

/** One live drafting run — the operator's placed vertices in world metres. */
export interface DraftSession {
  tool: DraftTool;
  vertices: WorldXZ[];
}

/**
 * Minimum spacing between two placed vertices (world metres). A double-click
 * finish fires a second pointer-down on the same spot; without this the run
 * would gain a zero-length segment before it closed.
 */
export const MIN_DRAFT_VERTEX_GAP_M = 0.05;

/** Vertex cap — matches `CanvasStroke.shape_points` `.max(256)` in contracts. */
export const MAX_DRAFT_VERTICES = 256;

/** An open polyline needs two vertices; a closed region needs three. */
export const MIN_POLYLINE_VERTICES = 2;
export const MIN_AREA_VERTICES = 3;

/** Placeholder SKU for a region drawn before its material is chosen. */
export const UNSPECIFIED_AREA_SKU = "unspecified";

/** Operator-facing default name for a drafted region. */
export const DRAFTED_AREA_NAME = "Drafted area";

/** Arm a tool with an empty run. */
export function beginDraftSession(tool: DraftTool): DraftSession {
  return { tool, vertices: [] };
}

/**
 * Place a vertex. Coincident placements (within MIN_DRAFT_VERTEX_GAP_M of the
 * previous vertex) and placements past the cap are ignored — the session is
 * returned unchanged so callers can treat the reducer as idempotent.
 */
export function addDraftVertex(
  session: DraftSession,
  vertex: WorldXZ,
): DraftSession {
  if (session.vertices.length >= MAX_DRAFT_VERTICES) return session;
  const last = session.vertices[session.vertices.length - 1];
  if (
    last &&
    Math.hypot(vertex.x - last.x, vertex.z - last.z) < MIN_DRAFT_VERTEX_GAP_M
  ) {
    return session;
  }
  return {
    tool: session.tool,
    vertices: [...session.vertices, { x: vertex.x, z: vertex.z }],
  };
}

/** Remove the last placed vertex (Backspace). An empty run stays empty. */
export function undoDraftVertex(session: DraftSession): DraftSession {
  if (session.vertices.length === 0) return session;
  return { tool: session.tool, vertices: session.vertices.slice(0, -1) };
}

/**
 * Whether the run carries enough vertices to persist. A closed run always
 * needs a polygon; an open run only applies to the polyline tool (Area must
 * close — spec §5).
 */
export function canCommitDraft(
  session: DraftSession,
  closed: boolean,
): boolean {
  if (session.tool === "area") {
    return session.vertices.length >= MIN_AREA_VERTICES;
  }
  return closed
    ? session.vertices.length >= MIN_AREA_VERTICES
    : session.vertices.length >= MIN_POLYLINE_VERTICES;
}

/** A live segment measurement — both figures derived, neither invented. */
export interface SegmentReadout {
  /** True length in metres. */
  lengthM: number;
  /** Bearing in degrees clockwise from north, [0, 360). */
  bearingDeg: number;
}

/**
 * Length + bearing of the segment a→b.
 *
 * Scene convention (StudioScene SunRig): +X east, +Z south, so north is −Z.
 * Bearing is therefore atan2(Δx, −Δz), normalised clockwise from north — the
 * surveyor's reading, not the maths-anticlockwise-from-east one.
 */
export function segmentReadout(a: WorldXZ, b: WorldXZ): SegmentReadout {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthM = Math.hypot(dx, dz);
  if (lengthM === 0) return { lengthM: 0, bearingDeg: 0 };
  const deg = (Math.atan2(dx, -dz) * 180) / Math.PI;
  return { lengthM, bearingDeg: ((deg % 360) + 360) % 360 };
}

/** Total run length in metres (adds the closing segment when closed). */
export function draftRunLengthM(
  vertices: readonly WorldXZ[],
  closed: boolean,
): number {
  if (vertices.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < vertices.length; i++) {
    total += Math.hypot(
      vertices[i]!.x - vertices[i - 1]!.x,
      vertices[i]!.z - vertices[i - 1]!.z,
    );
  }
  if (closed) {
    const first = vertices[0]!;
    const last = vertices[vertices.length - 1]!;
    total += Math.hypot(last.x - first.x, last.z - first.z);
  }
  return total;
}

/** Polygon area in m² (shoelace over the world-metre ring). */
export function draftAreaM2(vertices: readonly WorldXZ[]): number {
  if (vertices.length < 3) return 0;
  let twice = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    twice += a.x * b.z - b.x * a.z;
  }
  return Math.abs(twice) / 2;
}

/**
 * The title boundary ring as world-metre snap segments — the `boundary` rung
 * of `snapDrawPointer`. Derived per-edge via `pctToWorld`, the same conversion
 * `DimensionLayer` uses, and closed back onto the first vertex so the last
 * edge of the parcel is a snap target like every other one.
 *
 * A ring of fewer than two points has no edges; a ring already carrying a
 * duplicated closing point does not gain a degenerate zero-length edge.
 */
export function boundaryEdgeSegments(
  boundaryPct: readonly PctPoint[],
  scaleM: number,
  boardAspect: number,
): SnapSegment[] {
  if (boundaryPct.length < 2) return [];
  const world = boundaryPct.map((p) => {
    const [x, z] = pctToWorld(p, scaleM, boardAspect);
    return { x, z };
  });
  const edges: SnapSegment[] = [];
  for (let i = 0; i < world.length; i++) {
    const a = world[i]!;
    const b = world[(i + 1) % world.length]!;
    if (a.x === b.x && a.z === b.z) continue;
    edges.push({ a, b });
  }
  return edges;
}

/** Round a board-% ordinate for storage (2dp — the ink-commit convention). */
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function toStrokePoint(
  v: WorldXZ,
  scaleM: number,
  boardAspect: number,
): { x_pct: number; y_pct: number } {
  const pct = worldToPct(v.x, v.z, scaleM, boardAspect);
  return { x_pct: round2(pct.x), y_pct: round2(pct.y) };
}

/**
 * Feature geometry is board-bounded by contract (`CanvasPctPointSchema` is
 * 0–100), while stroke points are not. A vertex placed on the context ground
 * beyond the board therefore clamps to the board edge for a region — the same
 * convention every other feature writer uses (`sketchCad.ts` clampPct).
 */
function toFeaturePoint(
  v: WorldXZ,
  scaleM: number,
  boardAspect: number,
): { x_pct: number; y_pct: number } {
  const p = toStrokePoint(v, scaleM, boardAspect);
  return {
    x_pct: Math.max(0, Math.min(100, p.x_pct)),
    y_pct: Math.max(0, Math.min(100, p.y_pct)),
  };
}

export interface PolylineCommitArgs {
  id: string;
  vertices: readonly WorldXZ[];
  /** True when the run was finished on the origin snap. */
  closed: boolean;
  scaleM: number;
  boardAspect: number;
}

/**
 * Polyline → `CanvasStroke` with `kind: "shape"`.
 *
 * `shape_points` keeps the clicked control points; `points` carries the
 * flattened render path (identical vertices for straight segments, plus the
 * origin again when closed) because that is what `CommittedStrokeRenderer`
 * and every other stroke consumer read. The 0.3 mm technical-ink nib is the
 * crispest monoline profile available, so a set-out line reads as drafted
 * linework rather than gestural graphite.
 *
 * Returns null when the run is too short to be linework.
 */
export function polylineStrokeFromDraft(
  args: PolylineCommitArgs,
): CanvasStroke | null {
  const { id, vertices, closed, scaleM, boardAspect } = args;
  if (vertices.length < MIN_POLYLINE_VERTICES) return null;
  if (closed && vertices.length < MIN_AREA_VERTICES) return null;
  const control = vertices.map((v) => toStrokePoint(v, scaleM, boardAspect));
  const nib = nibSpec("ink-03");
  return {
    id,
    points: closed ? [...control, control[0]!] : control,
    color: nib.color,
    width_px: nib.baseWidthPx,
    kind: "shape",
    shape_tool: "polyline",
    shape_points: control,
    shape_closed: closed,
    nib: nib.kind,
  };
}

export interface AreaCommitArgs {
  id: string;
  vertices: readonly WorldXZ[];
  scaleM: number;
  boardAspect: number;
}

/**
 * Area → `LandscapeFeature` (a Polygon region, not linework).
 *
 * The region is `human_drawn` / `human_locked` — the operator placed every
 * vertex, so AI regeneration must never overwrite it. `material_fill` exists
 * so the region is costable, but the SKU is stamped `unspecified` rather than
 * guessed: the operator picks the material in the inspector. No
 * `live_calculations` are written — an invented cost is worse than an absent
 * one.
 *
 * The ring is stored WITHOUT a duplicated closing vertex; `FeatureLayer`
 * closes Polygon geometry itself.
 *
 * Returns null when the ring is not a polygon.
 */
export function areaFeatureFromDraft(
  args: AreaCommitArgs,
): LandscapeFeature | null {
  const { id, vertices, scaleM, boardAspect } = args;
  if (vertices.length < MIN_AREA_VERTICES) return null;
  return {
    id,
    type: "LandscapeFeature",
    metadata: {
      layer: "other",
      friendly_name: DRAFTED_AREA_NAME,
      timestamp_created: new Date().toISOString(),
      source_attribution: "human_drawn",
      user_modification_state: "human_locked",
    },
    geometry: {
      type: "Polygon",
      spatial_reference: "EPSG:3857",
      canvas_origin_pct: { x_pct: 0, y_pct: 0 },
      points: vertices.map((v, i) => ({
        id: `${id}-v${i}`,
        pct: toFeaturePoint(v, scaleM, boardAspect),
      })),
    },
    material_fill: {
      type: "surface",
      sku: UNSPECIFIED_AREA_SKU,
      depth_m: 0.075,
      waste_allocation_pct: 10,
    },
  };
}
