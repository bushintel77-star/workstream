/**
 * Gold Standard 2026 — Ink geometry builders (Line2 segments + stipple dots).
 *
 * Converts a committed CanvasStroke (board-% points + telemetry) into the
 * geometry the dynamic ink shaders consume:
 *
 *   - `buildInkGeometry` — a three-stdlib LineGeometry whose per-segment
 *     instance attributes (aWidth, aBleed) feed NibInkMaterial's shader
 *     (width taper from pressure/tilt, velocity bleed).
 *   - `stipplePointsForStroke` / `buildStippleGeometry` — the stipple nib's
 *     dot cloud: pressure subsamples the path deterministically (density),
 *     altitude scales each dot's size (radius).
 *
 * Y is seeded at the FLAT_Y plane; the FusedSketchLayer drapes positions
 * over the terrain per-frame afterwards.
 */

import * as THREE from "three";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import type { CanvasStroke } from "@workstream/contracts";
import { pctToWorld } from "./coordTransform";
import {
  bleedScaleForSegment,
  telemetryFromStored,
  widthScaleForPoint,
  type NibSpec,
} from "./nibs";

/** Flat ink Y — just above the ground/terrain to avoid z-fighting. */
const FLAT_Y = 0.02;

export interface InkSegmentData {
  /** Flat world xyz positions (N points). */
  positions: Float32Array;
  /** N−1 per-segment width scales (× material.linewidth). */
  widths: Float32Array;
  /** N−1 per-segment bleed scales (velocity proxy for ink-03). */
  bleeds: Float32Array;
}

/**
 * Build the Line2 geometry with per-segment aWidth/aBleed instance
 * attributes (divisor 1 — the NibInkMaterial vertex shader reads them).
 */
export function buildInkGeometry(data: InkSegmentData): LineGeometry {
  const geo = new LineGeometry();
  geo.setPositions(data.positions);
  const count = Math.max(0, Math.floor(data.positions.length / 3) - 1);
  const widths = new Float32Array(count);
  const bleeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Non-finite / absent samples fall back to neutral defaults.
    const w = data.widths[i];
    const b = data.bleeds[i];
    widths[i] = Number.isFinite(w) ? w : 1;
    bleeds[i] = Number.isFinite(b) ? b : 0.5;
  }
  geo.setAttribute("aWidth", new THREE.InstancedBufferAttribute(widths, 1));
  geo.setAttribute("aBleed", new THREE.InstancedBufferAttribute(bleeds, 1));
  return geo;
}

/**
 * Segment data for a committed stroke: world positions + per-segment width
 * (averaged from the two endpoint telemetry samples) and bleed scales.
 * Telemetry is parallel to points; missing samples fall back to neutral.
 */
export function strokeSegmentData(
  stroke: CanvasStroke,
  nib: NibSpec,
  scaleM: number,
  boardAspect: number,
): InkSegmentData {
  const pts = stroke.points ?? [];
  const t = stroke.telemetry ?? [];
  const n = pts.length;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [x, z] = pctToWorld(
      { x: pts[i]!.x_pct, y: pts[i]!.y_pct },
      scaleM,
      boardAspect,
    );
    positions[i * 3] = x;
    positions[i * 3 + 1] = FLAT_Y;
    positions[i * 3 + 2] = z;
  }
  const count = Math.max(0, n - 1);
  const widths = new Float32Array(count);
  const bleeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const ta = telemetryFromStored(t[i]);
    const tb = telemetryFromStored(t[i + 1]);
    widths[i] = (widthScaleForPoint(nib, ta) + widthScaleForPoint(nib, tb)) / 2;
    const dx = positions[(i + 1) * 3] - positions[i * 3];
    const dz = positions[(i + 1) * 3 + 2] - positions[i * 3 + 2];
    bleeds[i] = bleedScaleForSegment(nib, Math.hypot(dx, dz));
  }
  return { positions, widths, bleeds };
}

/** Deterministic 0–1 hash — stable stipple subsampling across frames. */
function hash01(seed: number): number {
  const s = Math.sin(seed) * 43758.5453;
  return s - Math.floor(s);
}

export interface StipplePointData {
  /** World position (Y seeded at FLAT_Y; draped per-frame by the renderer). */
  world: [number, number, number];
  /** Dot radius in device px (scales with stylus altitude). */
  sizePx: number;
  /** Pressure sample — drives dot alpha (StippleMaterial aPressure). */
  pressure: number;
}

/**
 * Build the stipple dot cloud from a stroke. Pressure controls DISTRIBUTION
 * DENSITY: point i survives with probability 0.2 + 0.8·pressure (deterministic
 * hash — no flicker). Altitude controls the dot RADIUS: 3–12 px, upright pen
 * (altitude 90°) → full radius, grazing pen → pinprick.
 */
export function stipplePointsForStroke(
  stroke: CanvasStroke,
  scaleM: number,
  boardAspect: number,
): StipplePointData[] {
  const pts = stroke.points ?? [];
  const t = stroke.telemetry ?? [];
  const out: StipplePointData[] = [];
  for (let i = 0; i < pts.length; i++) {
    const tel = telemetryFromStored(t[i]);
    if (hash01(i * 7.31) > 0.2 + 0.8 * tel.pressure) continue;
    const [x, z] = pctToWorld(
      { x: pts[i]!.x_pct, y: pts[i]!.y_pct },
      scaleM,
      boardAspect,
    );
    out.push({
      world: [x, FLAT_Y, z],
      sizePx: 3 + (tel.altitude / 90) * 9,
      pressure: tel.pressure,
    });
  }
  return out;
}

/** Build the BufferGeometry for a stipple dot cloud (position + aSize + aPressure). */
export function buildStippleGeometry(points: readonly StipplePointData[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(points.length * 3);
  const sizes = new Float32Array(points.length);
  const pressures = new Float32Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    pos[i * 3] = p.world[0];
    pos[i * 3 + 1] = p.world[1];
    pos[i * 3 + 2] = p.world[2];
    sizes[i] = p.sizePx;
    pressures[i] = p.pressure;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aPressure", new THREE.BufferAttribute(pressures, 1));
  return geo;
}
