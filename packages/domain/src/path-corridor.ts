/**
 * Residential path corridor — centreline → width buffer in board % (Workflow 1).
 * Not Civil 3D: mitered residential modules + indicative fillet labels.
 */

import type { HardscapeEdgeType, PathFilletLockM, PathWidthLockM } from "./hardscape-grammar";
import { hardscapeWhy } from "./hardscape-grammar";

export type PathCorridorPt = { x: number; y: number };

export type PathCorridor = {
  id: string;
  /** Open centreline in board %. */
  points: PathCorridorPt[];
  material: "paving" | "deck";
  pathWidthM: PathWidthLockM;
  edgeType: HardscapeEdgeType;
  pathFilletM: PathFilletLockM;
  why: string;
};

export type PathCorridorInput = {
  points: PathCorridorPt[];
  material: "paving" | "deck";
  pathWidthM: PathWidthLockM;
  edgeType: HardscapeEdgeType;
  pathFilletM: PathFilletLockM;
  /** Board width in metres (default 110). */
  scaleM?: number;
  id?: string;
};

const EPS = 1e-9;
const MITER_LIMIT = 2.9;

function dedupe(points: PathCorridorPt[]): PathCorridorPt[] {
  const out: PathCorridorPt[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.x - p.x) < EPS && Math.abs(prev.y - p.y) < EPS) {
      continue;
    }
    out.push(p);
  }
  return out;
}

function segmentNormal(a: PathCorridorPt, b: PathCorridorPt): PathCorridorPt | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;
  return { x: -dy / len, y: dx / len };
}

/**
 * Buffer centreline (board %) into a closed corridor ring (board %).
 * halfWidthPct derived from locked metres ÷ scaleM.
 */
export function pathCorridorRingPct(
  points: PathCorridorPt[],
  pathWidthM: number,
  scaleM = 110,
): PathCorridorPt[] {
  const pts = dedupe(points);
  if (pts.length < 2 || pathWidthM <= 0 || scaleM <= 0) return [];
  const halfWidth = ((pathWidthM / 2) / scaleM) * 100;

  const left: PathCorridorPt[] = [];
  const right: PathCorridorPt[] = [];
  for (let i = 0; i < pts.length; i += 1) {
    const before = i > 0 ? segmentNormal(pts[i - 1]!, pts[i]!) : null;
    const after =
      i < pts.length - 1 ? segmentNormal(pts[i]!, pts[i + 1]!) : null;
    const n =
      before && after
        ? { x: before.x + after.x, y: before.y + after.y }
        : (before ?? after);
    if (!n) return [];
    const len = Math.hypot(n.x, n.y);
    if (len < EPS) {
      const fallback = before ?? after!;
      left.push({
        x: pts[i]!.x + fallback.x * halfWidth,
        y: pts[i]!.y + fallback.y * halfWidth,
      });
      right.push({
        x: pts[i]!.x - fallback.x * halfWidth,
        y: pts[i]!.y - fallback.y * halfWidth,
      });
      continue;
    }
    const unit = { x: n.x / len, y: n.y / len };
    const cosHalf = before
      ? unit.x * before.x + unit.y * before.y
      : unit.x * after!.x + unit.y * after!.y;
    const scale = Math.min(MITER_LIMIT, 1 / Math.max(1 / MITER_LIMIT, cosHalf));
    const off = halfWidth * scale;
    left.push({ x: pts[i]!.x + unit.x * off, y: pts[i]!.y + unit.y * off });
    right.push({ x: pts[i]!.x - unit.x * off, y: pts[i]!.y - unit.y * off });
  }

  return [...left, ...right.reverse()];
}

/** Indicative fillet cue points at interior centreline vertices (not a Civil solver). */
export function pathFilletCues(
  points: PathCorridorPt[],
  filletM: number,
  scaleM = 110,
): Array<{ x: number; y: number; rPct: number }> {
  if (filletM <= 0 || points.length < 3) return [];
  const rPct = (filletM / scaleM) * 100;
  const cues: Array<{ x: number; y: number; rPct: number }> = [];
  for (let i = 1; i < points.length - 1; i += 1) {
    cues.push({ x: points[i]!.x, y: points[i]!.y, rPct });
  }
  return cues;
}

export function makePathCorridor(input: PathCorridorInput): PathCorridor | null {
  const pts = dedupe(input.points);
  if (pts.length < 2) return null;
  return {
    id: input.id ?? cryptoRandomId(),
    points: pts,
    material: input.material,
    pathWidthM: input.pathWidthM,
    edgeType: input.edgeType,
    pathFilletM: input.pathFilletM,
    why: hardscapeWhy(input.pathWidthM, input.edgeType, input.pathFilletM),
  };
}

function cryptoRandomId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `path-${Date.now()}`;
}

export function pathRingToSvg(points: PathCorridorPt[]): string {
  if (points.length < 3) return "";
  return `${points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")} Z`;
}

export function pathCentrelineToSvg(points: PathCorridorPt[]): string {
  if (points.length < 2) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}
