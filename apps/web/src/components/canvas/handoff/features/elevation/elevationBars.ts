import {
  elevationLookProjector,
  isIndicativeCanopySource,
  type ElevationLook,
  type GardenAssetFamily,
} from "@workstream/domain";
import type { PctPoint } from "../../geometry";
import {
  elevationTagFor,
  hasElevationPresence,
  resolveItemFamily,
  resolveItemHeightM,
  resolveItemSpreadM,
} from "../../geometry/itemHeight";
import type { StudioItem } from "../../studioCatalog";
import { TILT_EAVE_M } from "../tilt/tiltMath";
import type { ElevBox } from "./gardenElevationGeometry";

/**
 * Plan → elevation bar layout, shared by every elevation surface.
 *
 * The elevation board and the fit sheet both lay their profiles out through
 * here, so a placed 7.8 m tree cannot stand 7.8 m on the board and 6 m on the
 * sheet. Heights, spreads, silhouette families and callout names all come from
 * the Tier 2 resolvers (`geometry/itemHeight`), which read the placed catalog
 * symbol before falling back to the coarse studio type.
 *
 * Pure — no React, no DOM. Units are the caller's own (each surface has its own
 * viewBox), declared once as an `ElevationPlot`.
 */

/** Where the ground line and the datum ceiling sit, in the caller's units. */
export type ElevationPlot = {
  /** Left edge of the drawn parcel. */
  x0: number;
  /** Parcel width — the boundary span maps onto exactly this. */
  w: number;
  /** Ground line (datum RL 0.00). */
  groundY: number;
  /** Distance above the ground line representing `ceilingM` metres. */
  h: number;
};

/** Bar widths (caller units) for assets with no catalogued spread. */
export type ElevationFallbackWidths = {
  ghost: number;
  /** Linear / platform families (hedge, deck) read wider than a stem. */
  wide: number;
  narrow: number;
};

export type ElevationBar = {
  item: StudioItem;
  /** Silhouette family, null for structures / fixtures (plain profile). */
  family: GardenAssetFamily | null;
  /** Drawn height (m) — catalogued mature height with placement scale. */
  heightM: number;
  /** Callout name — the placed symbol's label when the symbol has one. */
  tag: string;
  /** Silhouette box, ground-anchored and centred on the projected position. */
  box: ElevBox;
  selected: boolean;
  /** Vision-detected canopy — render with indicative line-weight. */
  indicative: boolean;
};

/**
 * How wide a bar is drawn.
 *
 * `spread` — catalogued mature spread, honest when the surface draws its two
 * axes at roughly one scale (the elevation board).
 * `indicative` — the fallback ladder only. The fit sheet's elevation strip
 * compresses ~10 vertical metres into 28 px while its width spans the whole
 * parcel, so spread-true bars there would render as grossly flattened blobs.
 * Heights and families still mirror the board exactly; only width is symbolic.
 */
export type ElevationBarWidthMode = "spread" | "indicative";

export type ElevationBarsOpts = {
  look: ElevationLook;
  boundary: PctPoint[];
  /** Metres across the full plan width (board scale). */
  scaleM: number;
  plot: ElevationPlot;
  ceilingM: number;
  fallbackWidth: ElevationFallbackWidths;
  widthMode?: ElevationBarWidthMode;
  selectedId?: string | null;
};

/** Datum headroom above the tallest thing standing on it. */
const CEILING_HEADROOM_M = 0.75;
const CEILING_HEADROOM_K = 1.2;
/** Ceiling bounds so one freak tree cannot squash the whole garden. */
const CEILING_MIN_M = 1;
const CEILING_MAX_M = 14;
/**
 * Bar width clamp as a share of the parcel width — same policy as the domain
 * projector's MIN_BAR_PCT / MAX_BAR_PCT, expressed against `plot.w`.
 */
const MIN_BAR_SHARE = 0.006;
const MAX_BAR_SHARE = 0.4;

function alongPct(p: PctPoint, axis: "x" | "y", reverse: boolean): number {
  const raw = axis === "x" ? p.x : p.y;
  return reverse ? 100 - raw : raw;
}

function safeScale(it: StudioItem): number {
  return it.scale > 0 ? it.scale : 1;
}

/** Along-axis extent of the parcel for a look, in plan % units. */
export function elevationSpan(boundary: PctPoint[], look: ElevationLook) {
  const proj = elevationLookProjector(look);
  if (!boundary.length) return { proj, minC: 0, span: 100 };
  const coords = boundary.map((p) => alongPct(p, proj.axis, proj.reverse));
  const minC = Math.min(...coords);
  return { proj, minC, span: Math.max(1, Math.max(...coords) - minC) };
}

/** Metres across the drawn parcel at a given board scale. */
export function elevationParcelWidthM(span: number, scaleM: number): number {
  return (span / 100) * scaleM;
}

/**
 * Datum ceiling (m) — clears the dwelling eave and the tallest planting with
 * headroom, so the height ticks, the dwelling mass and every profile share one
 * vertical scale.
 */
export function elevationCeilingM(
  items: StudioItem[],
  eaveM: number = TILT_EAVE_M,
): number {
  const tallest = items.reduce(
    (m, it) =>
      hasElevationPresence(it) ? Math.max(m, resolveItemHeightM(it)) : m,
    0,
  );
  const top = Math.max(CEILING_MIN_M, eaveM, tallest);
  return Math.min(
    CEILING_MAX_M,
    Math.max(top + CEILING_HEADROOM_M, top * CEILING_HEADROOM_K),
  );
}

function barWidth(
  spreadM: number | null,
  scale: number,
  parcelWidthM: number,
  plotW: number,
  fallback: number,
): number {
  if (parcelWidthM > 0 && spreadM != null && spreadM > 0) {
    const units = ((spreadM * scale) / parcelWidthM) * plotW;
    return Math.min(
      plotW * MAX_BAR_SHARE,
      Math.max(plotW * MIN_BAR_SHARE, units),
    );
  }
  return fallback;
}

/** One ground-anchored bar per placement that has vertical presence. */
export function elevationBars(
  items: StudioItem[],
  opts: ElevationBarsOpts,
): ElevationBar[] {
  const { proj, minC, span } = elevationSpan(opts.boundary, opts.look);
  const parcelWidthM = elevationParcelWidthM(span, opts.scaleM);
  const ceiling = Math.max(CEILING_MIN_M, opts.ceilingM);
  return items.filter(hasElevationPresence).map((item) => {
    const family = resolveItemFamily(item);
    const heightM = resolveItemHeightM(item);
    const fallback = item.ghost
      ? opts.fallbackWidth.ghost
      : family === "hedge" || family === "deck"
        ? opts.fallbackWidth.wide
        : opts.fallbackWidth.narrow;
    const w = barWidth(
      opts.widthMode === "indicative" ? null : resolveItemSpreadM(item),
      safeScale(item),
      parcelWidthM,
      opts.plot.w,
      fallback,
    );
    const centre =
      opts.plot.x0 +
      ((alongPct(item, proj.axis, proj.reverse) - minC) / span) * opts.plot.w;
    const h = Math.min(opts.plot.h, (heightM / ceiling) * opts.plot.h);
    return {
      item,
      family,
      heightM,
      tag: elevationTagFor(item),
      box: { x: centre - w / 2, y: opts.plot.groundY - h, w, h },
      selected: !item.ghost && item.id === opts.selectedId,
      indicative: isIndicativeCanopySource(item.source),
    };
  });
}

/**
 * Dwelling envelope band on the same datum as the bars — an eave-true mass, so
 * a 7.8 m tree visibly overtops a 5 m eave instead of both being drawn at a
 * fixed share of the plot.
 */
export function elevationBuildingBox(
  building: PctPoint[],
  opts: {
    look: ElevationLook;
    boundary: PctPoint[];
    plot: ElevationPlot;
    ceilingM: number;
    eaveM?: number;
    /** Share of the plot used when the dwelling has not been traced yet. */
    fallbackSpan?: { from: number; to: number };
  },
): ElevBox {
  const { proj, minC, span } = elevationSpan(opts.boundary, opts.look);
  const fb = opts.fallbackSpan ?? { from: 0.22, to: 0.55 };
  const coords = building.map((p) => alongPct(p, proj.axis, proj.reverse));
  const x0 = coords.length
    ? opts.plot.x0 + ((Math.min(...coords) - minC) / span) * opts.plot.w
    : opts.plot.x0 + opts.plot.w * fb.from;
  const x1 = coords.length
    ? opts.plot.x0 + ((Math.max(...coords) - minC) / span) * opts.plot.w
    : opts.plot.x0 + opts.plot.w * fb.to;
  const eaveM = opts.eaveM ?? TILT_EAVE_M;
  const ceiling = Math.max(CEILING_MIN_M, opts.ceilingM);
  const h = Math.min(opts.plot.h, (eaveM / ceiling) * opts.plot.h);
  return {
    x: x0,
    y: opts.plot.groundY - h,
    w: Math.max(opts.plot.w * 0.03, x1 - x0),
    h,
  };
}
