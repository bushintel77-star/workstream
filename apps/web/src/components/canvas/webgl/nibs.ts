/**
 * Gold Standard 2026 — The Nib & Tool Taxonomy (expressive stylus Sketch).
 *
 * The four-nib vocabulary from the Limner Sketch brief, mapped to concrete
 * render parameters. Everything here is PURE (unit-testable); the shader
 * layer (inkMaterial.ts) consumes the resolved per-segment width / grain /
 * edge / bleed values, and the FusedSketchLayer captures the raw
 * PointerEvent telemetry via `telemetryFromPointer`.
 *
 * Telemetry mappings (the brief):
 *   - 6B Graphite Lead   — tilt controls flat-edge shading; pressure controls
 *                          grain density & edge softness (gesture lines,
 *                          canopy masses, contour shading).
 *   - 0.3mm Technical Ink — pressure-invariant fixed monoline, zero opacity
 *                          bleed (scale-invariant drafting: boundary tracing,
 *                          setback lines, dimension offsets).
 *   - Chisel Felt Marker — tilt locks nib orientation; speed controls ink
 *                          saturation (surface zone filling, overlap banding).
 *   - Stipple / Speckle   — pressure controls dot distribution density;
 *                          radius scales with altitude angle (soil, gravel,
 *                          mulch textures, lawn edge transitions).
 *
 * Binding: docs/GOLD-STANDARD-2026.md (zero-chrome drafting precision)
 */

import type { CanvasStroke, NibKind } from "@workstream/contracts";
import { PALETTE } from "../../../styles/colorTokens";
import { materialById } from "./materials";

export const NIB_KINDS: readonly NibKind[] = [
  "graphite-6b",
  "ink-03",
  "chisel-marker",
  "stipple",
] as const;

/** Which PointerEvent telemetry channels a nib consumes. */
export interface NibTelemetryMapping {
  /** Pressure scales the stroke width (graphite). */
  pressureWidth: boolean;
  /** Tilt magnitude modulates width / flat-edge shading (graphite, chisel). */
  tiltWidth: boolean;
  /** Segment speed (a spacing proxy) scales ink bleed (ink-03). */
  velocityBleed: boolean;
  /** Pressure controls stipple dot density. */
  pressureDensity: boolean;
  /** Stylus altitude controls stipple dot radius. */
  altitudeRadius: boolean;
}

export interface NibSpec {
  kind: NibKind;
  /** Operator-facing label (sentence case). */
  label: string;
  /**
   * Palette label. The nib swatch column is 42px wide, so this must stay
   * short enough not to ellipsize (the tool rail's text contract).
   */
  shortLabel: string;
  /** Spatial & CAD purpose (tooltip line). */
  purpose: string;
  /** Base stroke width in CSS px (LineMaterial linewidth). */
  baseWidthPx: number;
  /** The same weight expressed in mm at the 1:200 issued scale (3.5) —
   *  derived from `baseWidthPx` through the single `mmToPx` conversion so
   *  screen px can never drift from the issued-drawing weight. */
  weightMm: number;
  /** Stroke color (CanvasStroke.color — hex). */
  color: string;
  /** 0–1 graphite grain density. */
  grain: number;
  /** 0–1 edge softness (fraction of the width that fades). */
  edgeSoft: number;
  /** 0–1 wet-ink bleed. */
  bleed: number;
  /** Base stroke opacity. */
  opacity: number;
  /**
   * Tier-1 brush widget — the smoothing-dial default this nib arms with.
   * The dial follows it until the operator sets SM explicitly (their choice
   * then sticks across nib switches — studioStore.smoothingTouched).
   */
  defaultSmoothing: number;
  /** Width modulation range [min, max] as multiples of baseWidthPx. */
  widthScale: readonly [number, number];
  mapping: NibTelemetryMapping;
}

/** Inverse of `mmAtScaleToPx`: the issued-scale mm weight a px width
 *  corresponds to at 1:200 (3.5). One conversion for the whole table. */
function pxToWeightMm(px: number): number {
  return (px / 96) * 25.4; // px at 96dpi → mm (scale factor 1 at 1:200)
}

/** The other direction, for material weights (which are authored in mm). */
function weightMmToPx(mm: number): number {
  return (mm / 25.4) * 96;
}

export const NIBS: Record<NibKind, NibSpec> = {
  "graphite-6b": {
    kind: "graphite-6b",
    label: "6B graphite",
    shortLabel: "6B",
    purpose:
      "Soft site gesture lines, tree canopy masses, contour shading — tilt shades the flat edge, pressure drives grain & softness",
    baseWidthPx: 3.5,
    weightMm: pxToWeightMm(3.5),
    color: "#3B3B3B",
    grain: 0.55,
    edgeSoft: 0.45,
    bleed: 0,
    opacity: 0.85,
    // The historical global dial default — graphite keeps it so the studio's
    // initial damping is unchanged by the per-nib defaults landing.
    defaultSmoothing: 0.2,
    widthScale: [0.35, 1.6],
    mapping: {
      pressureWidth: true,
      tiltWidth: true,
      velocityBleed: false,
      pressureDensity: false,
      altitudeRadius: false,
    },
  },
  "ink-03": {
    kind: "ink-03",
    label: "0.3mm ink",
    shortLabel: "Ink",
    purpose:
      "Crisp boundary tracing, exact setbacks, dimension offsets — pressure-invariant monoline with zero opacity bleed (spec 3.4)",
    baseWidthPx: 1.5,
    weightMm: pxToWeightMm(1.5),
    color: PALETTE.sketchInk,
    grain: 0,
    edgeSoft: 0,
    bleed: 0,
    opacity: 0.92,
    defaultSmoothing: 0.05,
    widthScale: [1, 1],
    mapping: {
      pressureWidth: false,
      tiltWidth: false,
      velocityBleed: false,
      pressureDensity: false,
      altitudeRadius: false,
    },
  },
  "chisel-marker": {
    kind: "chisel-marker",
    label: "Chisel marker",
    shortLabel: "Chisel",
    purpose:
      "Rapid surface zone fills (paving, lawn, decking) — tilt locks the nib edge, speed drives saturation and overlap banding",
    baseWidthPx: 9,
    weightMm: pxToWeightMm(9),
    color: "#A52FD6",
    grain: 0,
    edgeSoft: 0.18,
    bleed: 0,
    opacity: 0.5,
    defaultSmoothing: 0.25,
    widthScale: [0.75, 1.25],
    mapping: {
      pressureWidth: false,
      tiltWidth: true,
      velocityBleed: false,
      pressureDensity: false,
      altitudeRadius: false,
    },
  },
  stipple: {
    kind: "stipple",
    label: "Stipple",
    shortLabel: "Stipple",
    purpose:
      "Indicative soil, gravel, mulch textures and soft lawn edges — pressure sets dot density, altitude scales the dot radius",
    baseWidthPx: 2,
    weightMm: pxToWeightMm(2),
    color: PALETTE.soilL500,
    grain: 0,
    edgeSoft: 0,
    bleed: 0,
    opacity: 0.8,
    defaultSmoothing: 0.1,
    widthScale: [1, 1],
    mapping: {
      pressureWidth: false,
      tiltWidth: false,
      velocityBleed: false,
      pressureDensity: true,
      altitudeRadius: true,
    },
  },
};

/** Ordered nib list for the floating palette (glyph order = taxonomy order). */
export const NIB_ORDER: readonly NibKind[] = NIB_KINDS;

/** The default nib when none is explicitly armed. */
export const DEFAULT_NIB: NibKind = "graphite-6b";

export function nibSpec(kind: NibKind | undefined): NibSpec {
  return NIBS[kind ?? DEFAULT_NIB];
}

/**
 * The spec for an ARMED nib — the one resolution path for both the live line
 * under the stylus and a committed stroke, so what the operator draws with is
 * what lands.
 *
 * Phase M — a material overrides the nib's colour and weight. Every renderer
 * reads its colour from the nib spec, so applying the override anywhere else
 * would leave the ink drawing in graphite: the palette wrote
 * `activeMaterialId`, the commit stamped `stroke.material`, and the line still
 * came out the nib's colour.
 */
export function armedNibSpec(opts: {
  nib: NibKind;
  materialId?: string | null;
  /** R.4 — the bound office template's weight for the material's signature,
   *  in mm at issued scale. Outranks the material palette's own copy of the
   *  weight, which is what makes a standard change reach a drawing that
   *  already exists. */
  templateWeightMm?: number;
  /** Phase I — an explicit brush width in px, which outranks both. */
  brushWidthPx?: number | null;
  /** Tier-1 brush widget — an explicit opacity 0–1, which overrides the
   *  nib's base opacity for the live line. */
  brushOpacity?: number | null;
}): NibSpec {
  const base = NIBS[opts.nib];
  const material = opts.materialId ? materialById(opts.materialId) : undefined;
  const weightMm = opts.templateWeightMm ?? material?.weightMm;
  const styled: NibSpec = material
    ? {
      ...base,
      color: material.color,
      ...(weightMm != null
        ? { weightMm, baseWidthPx: weightMmToPx(weightMm) }
        : {}),
    }
    : base;
  const withOpacity =
    opts.brushOpacity != null
      ? { ...styled, opacity: clamp01(opts.brushOpacity) }
      : styled;
  return opts.brushWidthPx != null
    ? {
      ...withOpacity,
      baseWidthPx: opts.brushWidthPx,
      weightMm: pxToWeightMm(opts.brushWidthPx),
    }
    : withOpacity;
}

/**
 * Resolve the render spec for a stored stroke — legacy strokes (no `nib`)
 * render with the graphite profile's neutral settings but keep the stroke's
 * own color/width (no visual regression for existing ink).
 */
export function nibSpecForStroke(
  stroke: CanvasStroke,
  /** R.4 — see `armedNibSpec`. */
  templateWeightMm?: number,
): NibSpec {
  if (stroke.nib) {
    const resolved = armedNibSpec({
      nib: stroke.nib,
      materialId: stroke.material ?? null,
      ...(templateWeightMm != null ? { templateWeightMm } : {}),
    });
    // Tier-1 brush widget — the stroke's own stamped opacity outranks the
    // nib's base (the same precedence a stamped width_px gets).
    return stroke.opacity != null
      ? { ...resolved, opacity: stroke.opacity }
      : resolved;
  }
  const widthPx = stroke.width_px ?? 2;
  return {
    ...NIBS["graphite-6b"],
    color: stroke.color ?? PALETTE.sketchInk,
    baseWidthPx: widthPx,
    weightMm: pxToWeightMm(widthPx),
    grain: 0,
    edgeSoft: 0,
    bleed: 0,
  };
}

/**
 * The width to draw a committed stroke at, in px. Three sources want to set
 * it, so the precedence is stated once here rather than at each renderer:
 *
 *   1. a width the operator explicitly chose (the Phase I brush slider) — a
 *      deliberate per-stroke deviation, which must survive a standard change;
 *   2. the weight the standard gives this stroke's material — the bound
 *      office template's weight where it governs the material's signature
 *      (R.4), otherwise the material palette's own mm weight (Phase M). Both
 *      arrive already resolved on `nib.baseWidthPx` via `nibSpecForStroke`;
 *   3. the nib's own base width, for ink carrying no material at all.
 *
 * A stamped `width_px` counts as case 1 only when it differs from the raw nib
 * default it would have been stamped with at commit. Reading every stamped
 * width as an operator choice is what made case 2 unreachable: every stroke
 * carries `nib.baseWidthPx` from commit, so the material weight was computed
 * at render and then discarded, and the template weight had nowhere to land.
 */
export function committedStrokeWidthPx(
  stroke: CanvasStroke,
  nib: NibSpec,
): number {
  const rawDefault = stroke.nib ? NIBS[stroke.nib].baseWidthPx : undefined;
  if (stroke.width_px != null && stroke.width_px !== rawDefault) {
    return stroke.width_px;
  }
  return nib.baseWidthPx;
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

/** Normalized stylus telemetry (angles in degrees). */
export interface StylusTelemetry {
  /** Normalized pen pressure 0–1 (mouse/touch synthesize 0.5). */
  pressure: number;
  /** PointerEvent.tiltX in degrees. */
  tiltX: number;
  /** PointerEvent.tiltY in degrees. */
  tiltY: number;
  /** Pen azimuth (clockwise around the vertical), degrees 0–360. */
  azimuth: number;
  /** Pen altitude above the surface, degrees 0–90. */
  altitude: number;
}

/** Neutral telemetry for mouse/touch and defensive fallbacks. */
export const NEUTRAL_TELEMETRY: StylusTelemetry = {
  pressure: 0.5,
  tiltX: 0,
  tiltY: 0,
  azimuth: 0,
  altitude: 90,
};

/** A stored per-point telemetry record (the CanvasStroke contract shape). */
export type StrokeTelemetryPoint = NonNullable<
  CanvasStroke["telemetry"]
>[number];

/**
 * Adapt a STORED telemetry sample (snake_case contract fields) back to the
 * renderer's StylusTelemetry shape. Missing optional angles default to an
 * upright pen; missing samples fall back to neutral telemetry.
 */
export function telemetryFromStored(
  t: StrokeTelemetryPoint | undefined,
): StylusTelemetry {
  if (!t) return { ...NEUTRAL_TELEMETRY };
  return {
    pressure: clamp01(t.pressure),
    tiltX: t.tilt_x_deg ?? 0,
    tiltY: t.tilt_y_deg ?? 0,
    azimuth: t.azimuth_deg ?? 0,
    altitude: t.altitude_deg ?? 90,
  };
}

/**
 * Capture stylus telemetry from a raw PointerEvent. Tilt/azimuth/altitude
 * follow the W3C relationship tiltX ≈ altitude·sin(azimuth),
 * tiltY ≈ altitude·cos(azimuth) — the browser's azimuthAngle/altitudeAngle
 * (radians) are preferred when present, otherwise derived from tiltX/tiltY.
 * Mouse and touch draw with a neutral 0.5 pressure and upright pen.
 */
export function telemetryFromPointer(e: PointerEvent): StylusTelemetry {
  const isPen = e.pointerType === "pen";
  const pressure = isPen ? clamp01(e.pressure) : 0.5;
  const tiltX = Number.isFinite(e.tiltX) ? e.tiltX : 0;
  const tiltY = Number.isFinite(e.tiltY) ? e.tiltY : 0;
  const tiltMag = Math.min(90, Math.hypot(tiltX, tiltY));

  const azimuth =
    typeof e.azimuthAngle === "number" && Number.isFinite(e.azimuthAngle)
      ? (((e.azimuthAngle * 180) / Math.PI) % 360 + 360) % 360
      : tiltMag > 0.5
        ? (((Math.atan2(tiltX, tiltY) * 180) / Math.PI) % 360 + 360) % 360
        : 0;

  const altitude =
    typeof e.altitudeAngle === "number" && Number.isFinite(e.altitudeAngle)
      ? clamp01((e.altitudeAngle * 180) / Math.PI / 90) * 90
      : 90 - tiltMag;

  return { pressure, tiltX, tiltY, azimuth, altitude };
}

/**
 * The width scale factor a nib maps a single telemetry sample to (1 = base
 * width). Ink-03 is pressure-invariant by design (returns 1). Graphite blends
 * pressure and tilt; chisel width follows tilt magnitude.
 */
export function widthScaleForPoint(nib: NibSpec, t: StylusTelemetry): number {
  if (nib.mapping.pressureWidth) {
    const p = clamp01(t.pressure);
    const tilt = nib.mapping.tiltWidth ? clamp01(t.altitude / 90) : 0;
    const driver = 0.65 * p + 0.35 * tilt;
    return nib.widthScale[0] + (nib.widthScale[1] - nib.widthScale[0]) * driver;
  }
  if (nib.mapping.tiltWidth) {
    const tilt = clamp01(Math.hypot(t.tiltX, t.tiltY) / 90);
    return nib.widthScale[0] + (nib.widthScale[1] - nib.widthScale[0]) * tilt;
  }
  return 1;
}

/**
 * Per-segment bleed scale — the brief's "velocity slightly scales ink bleed".
 * Pointer streams don't persist timestamps, so segment spacing in world
 * metres stands in for speed (long segments = fast stroke). Only applied when
 * the nib maps velocity (ink-03); other nibs pass 0.5 (neutral).
 */
export function bleedScaleForSegment(
  nib: NibSpec,
  segmentLengthM: number,
): number {
  if (!nib.mapping.velocityBleed) return 0.5;
  return Math.max(0.3, Math.min(1.4, segmentLengthM / 0.6));
}

/** Convenience: the nib of a committed stroke (for the palette readout). */
export function strokeNibLabel(stroke: CanvasStroke): string {
  return nibSpecForStroke(stroke).label;
}
