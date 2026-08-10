import type {
  CatalogPlacement,
  CanvasPointPct,
  IrrigationZone,
  SpatialObject,
} from "@workstream/contracts";
import { polylineLengthFromCanvasPercent } from "./canvas-geometry";
import { emitterCountForLine, zoneFlowLph } from "./irrigation";
import { boardWidthScale } from "./ops-schedules";

export type LightingAssistPoint = {
  id: string;
  fixture: string;
  x_pct: number;
  y_pct: number;
  count: number;
};

/** First-pass drip zones from open-space heuristics (editable layer). */
export function proposeIrrigationAssist(args: {
  projectId?: string;
  openAreaM2?: number;
  idFactory?: () => string;
}): IrrigationZone[] {
  const id = args.idFactory ?? (() => crypto.randomUUID());
  const area = args.openAreaM2 ?? 80;
  const zones: IrrigationZone[] = [
    {
      id: id(),
      name: "Rear drip zone",
      kind: "drip",
      points: [
        { x_pct: 22, y_pct: 55 },
        { x_pct: 78, y_pct: 55 },
        { x_pct: 78, y_pct: 82 },
        { x_pct: 22, y_pct: 82 },
      ],
      emitter_spacing_cm: 30,
      emitter_flow_lph: 2,
    },
  ];
  if (area >= 120) {
    zones.push({
      id: id(),
      name: "Front drip zone",
      kind: "drip",
      points: [
        { x_pct: 18, y_pct: 12 },
        { x_pct: 70, y_pct: 12 },
        { x_pct: 70, y_pct: 32 },
        { x_pct: 18, y_pct: 32 },
      ],
      emitter_spacing_cm: 35,
      emitter_flow_lph: 2,
    });
  }
  return zones;
}

/** Place brass uplights near softscape trees (max 4). */
export function proposeLightingAssist(
  facts: SpatialObject[],
  idFactory: () => string = () => crypto.randomUUID(),
): LightingAssistPoint[] {
  const trees = facts.filter(
    (f) =>
      f.layer === "softscape" &&
      (f.symbol_id?.includes("tree") ||
        f.label.toLowerCase().includes("tree") ||
        (f.mature_canopy_m ?? 0) > 0),
  );
  return trees.slice(0, 4).map((t, i) => ({
    id: idFactory(),
    fixture: "Brass uplight",
    x_pct: Math.min(98, (t.x_pct ?? 50) + 1.2),
    y_pct: Math.min(98, (t.y_pct ?? 50) + 1.2),
    count: 1 + (i % 2),
  }));
}

export type IrrigationAssistSummary = {
  zone_count: number;
  open_area_m2: number;
  mean_spacing_cm: number;
  /** Indicative install labour hours from zone count + spacing density. */
  labour_hr: number;
  /** Rough material + labour AUD for first-pass drip. */
  cost_aud: number;
  label: string;
};

export type LightingAssistSummary = {
  fixture_count: number;
  tree_count: number;
  /** Indicative install labour hours. */
  labour_hr: number;
  /** Rough fixture + install AUD. */
  cost_aud: number;
  label: string;
};

/** Glanceable coverage / cost metrics for a first-pass irrigation proposal. */
export function summariseIrrigationAssist(
  zones: IrrigationZone[],
  openAreaM2 = 80,
): IrrigationAssistSummary {
  const zone_count = zones.length;
  const spacings = zones
    .map((z) => z.emitter_spacing_cm)
    .filter((n): n is number => typeof n === "number" && n > 0);
  const mean_spacing_cm =
    spacings.length > 0
      ? Math.round(
        (spacings.reduce((s, n) => s + n, 0) / spacings.length) * 10,
      ) / 10
      : 30;
  const density = mean_spacing_cm > 0 ? 30 / mean_spacing_cm : 1;
  const labour_hr =
    Math.round((zone_count * 1.4 + (openAreaM2 / 80) * density) * 10) / 10;
  const cost_aud = Math.round(
    openAreaM2 * 4.5 * density + zone_count * 180 + labour_hr * 85,
  );
  return {
    zone_count,
    open_area_m2: Math.round(openAreaM2),
    mean_spacing_cm,
    labour_hr,
    cost_aud,
    label:
      zone_count === 0
        ? "No irrigation zones"
        : `${zone_count} drip zone${zone_count === 1 ? "" : "s"} · ~${openAreaM2.toFixed(0)} m² · ~$${cost_aud.toLocaleString("en-AU")}`,
  };
}

/** Glanceable cost metrics for a first-pass lighting proposal. */
export function summariseLightingAssist(
  points: LightingAssistPoint[],
): LightingAssistSummary {
  const fixture_count = points.reduce((s, p) => s + (p.count || 1), 0);
  const tree_count = points.length;
  const labour_hr = Math.round(fixture_count * 0.45 * 10) / 10;
  const cost_aud = Math.round(fixture_count * 220 + labour_hr * 85);
  return {
    fixture_count,
    tree_count,
    labour_hr,
    cost_aud,
    label:
      fixture_count === 0
        ? "No lighting points"
        : `${fixture_count} uplight${fixture_count === 1 ? "" : "s"} · ~$${cost_aud.toLocaleString("en-AU")}`,
  };
}

// --- §4.7 edit loop: revise assist layers + live coverage / cost --------------

const ASSIST_NAME = /^assist:\s*/i;
const DRIP_ZONE_NAME = /drip zone/i;

export function isAssistIrrigationZone(zone: IrrigationZone): boolean {
  if (zone.kind && zone.kind !== "drip") return false;
  return ASSIST_NAME.test(zone.name) || DRIP_ZONE_NAME.test(zone.name);
}

export function listAssistIrrigationZones(
  zones: IrrigationZone[],
): IrrigationZone[] {
  return zones.filter(isAssistIrrigationZone);
}

/** Assist luminaires: path-light tagged Assist:… or legacy Brass uplight. */
export function isAssistLightingPlacement(p: CatalogPlacement): boolean {
  const sid = p.symbol_id.toLowerCase();
  if (!sid.includes("path-light") && !sid.includes("uplight")) return false;
  const label = (p.label ?? "").toLowerCase();
  return (
    label.startsWith("assist:") ||
    label.includes("brass uplight") ||
    label.includes("uplight")
  );
}

export function listAssistLightingPlacements(
  placements: CatalogPlacement[],
): CatalogPlacement[] {
  return placements.filter(isAssistLightingPlacement);
}

export function clampEmitterSpacingCm(cm: number): number {
  if (!Number.isFinite(cm)) return 30;
  return Math.round(Math.min(60, Math.max(15, cm)));
}

/** Trade-standard drip emitter spacing presets, within the clamp range. */
export const SPACING_PRESETS_CM: readonly number[] = [20, 30, 40, 50];

/** Set emitter spacing on assist drip zones only (other zones untouched). */
export function setAssistEmitterSpacing(
  zones: IrrigationZone[],
  spacingCm: number,
): IrrigationZone[] {
  const spacing = clampEmitterSpacingCm(spacingCm);
  return zones.map((z) =>
    isAssistIrrigationZone(z) ? { ...z, emitter_spacing_cm: spacing } : z,
  );
}

/**
 * Scale assist pipe-run polylines about each zone centroid.
 * `factor` 1 = unchanged; clamped to 0.6–1.6 so runs stay on-board.
 */
export function scaleAssistPipeRuns(
  zones: IrrigationZone[],
  factor: number,
): IrrigationZone[] {
  const s = Number.isFinite(factor)
    ? Math.min(1.6, Math.max(0.6, factor))
    : 1;
  if (s === 1) return zones;
  return zones.map((z) => {
    if (!isAssistIrrigationZone(z) || z.points.length < 2) return z;
    const cx = z.points.reduce((a, p) => a + p.x_pct, 0) / z.points.length;
    const cy = z.points.reduce((a, p) => a + p.y_pct, 0) / z.points.length;
    return {
      ...z,
      points: z.points.map((p) => ({
        x_pct: Math.min(100, Math.max(0, cx + (p.x_pct - cx) * s)),
        y_pct: Math.min(100, Math.max(0, cy + (p.y_pct - cy) * s)),
      })),
    };
  });
}

/** Nudge assist luminaires by board-% deltas (clamped to 0–100). */
export function nudgeAssistLuminaires(
  placements: CatalogPlacement[],
  dxPct: number,
  dyPct: number,
): CatalogPlacement[] {
  const dx = Number.isFinite(dxPct) ? dxPct : 0;
  const dy = Number.isFinite(dyPct) ? dyPct : 0;
  if (dx === 0 && dy === 0) return placements;
  return placements.map((p) => {
    if (!isAssistLightingPlacement(p)) return p;
    return {
      ...p,
      x_pct: Math.min(100, Math.max(0, p.x_pct + dx)),
      y_pct: Math.min(100, Math.max(0, p.y_pct + dy)),
    };
  });
}

function closedRing(points: CanvasPointPct[]): CanvasPointPct[] {
  if (points.length < 2) return points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (first.x_pct === last.x_pct && first.y_pct === last.y_pct) return points;
  return [...points, first];
}

export type IrrigationAssistLiveEstimate = IrrigationAssistSummary & {
  pipe_m: number;
  emitters: number;
  flow_lph: number;
  /** Indicative fraction of open area covered by drip density (0–100). */
  coverage_pct: number;
};

/**
 * Live coverage / cost for placed assist irrigation — updates with spacing + pipe geometry.
 */
export function estimateIrrigationAssistLive(
  zones: IrrigationZone[],
  openAreaM2 = 80,
  boardWidthM = 20,
): IrrigationAssistLiveEstimate {
  const assist = listAssistIrrigationZones(zones);
  const base = summariseIrrigationAssist(assist, openAreaM2);
  const scale = boardWidthScale(boardWidthM > 0 ? boardWidthM : 20);

  let pipe_m = 0;
  let emitters = 0;
  let flow_lph = 0;
  for (const z of assist) {
    const lengthM = polylineLengthFromCanvasPercent(
      closedRing(z.points),
      scale,
    );
    const n = emitterCountForLine(lengthM, z.emitter_spacing_cm);
    pipe_m += lengthM;
    emitters += n;
    flow_lph += zoneFlowLph(n, z.emitter_flow_lph);
  }
  pipe_m = Math.round(pipe_m * 10) / 10;
  flow_lph = Math.round(flow_lph);

  const density = base.mean_spacing_cm > 0 ? 30 / base.mean_spacing_cm : 1;
  const coverage_pct = Math.min(
    100,
    Math.round(
      ((pipe_m * 0.35 * density) / Math.max(openAreaM2, 1)) * 100 * 10,
    ) / 10,
  );

  const labour_hr =
    Math.round(
      (emitters * 0.08 + assist.length * 1.2 + pipe_m * 0.05) * 10,
    ) / 10;
  const cost_aud = Math.round(
    pipe_m * 12 + emitters * 1.8 + assist.length * 180 + labour_hr * 85,
  );

  return {
    ...base,
    labour_hr,
    cost_aud,
    pipe_m,
    emitters,
    flow_lph,
    coverage_pct: Math.max(0, coverage_pct),
    label:
      assist.length === 0
        ? "No irrigation zones"
        : `${assist.length} zone${assist.length === 1 ? "" : "s"} · ${pipe_m} m pipe · ~${coverage_pct}% cover · ~$${cost_aud.toLocaleString("en-AU")}`,
  };
}

export type LightingAssistLiveEstimate = LightingAssistSummary & {
  /** Indicative fixture span across board (m). */
  span_m: number;
};

export function lightingPointsFromPlacements(
  placements: CatalogPlacement[],
): LightingAssistPoint[] {
  return listAssistLightingPlacements(placements).map((p) => ({
    id: p.id,
    fixture: p.label ?? "Brass uplight",
    x_pct: p.x_pct,
    y_pct: p.y_pct,
    count: 1,
  }));
}

/** Live cost for placed assist luminaires — updates as positions change. */
export function estimateLightingAssistLive(
  placements: CatalogPlacement[],
  boardWidthM = 20,
): LightingAssistLiveEstimate {
  const pts = lightingPointsFromPlacements(placements);
  const base = summariseLightingAssist(pts);
  if (pts.length === 0) {
    return { ...base, span_m: 0 };
  }
  const xs = pts.map((p) => p.x_pct);
  const ys = pts.map((p) => p.y_pct);
  const dx = (Math.max(...xs) - Math.min(...xs)) / 100;
  const dy = (Math.max(...ys) - Math.min(...ys)) / 100;
  const width = boardWidthM > 0 ? boardWidthM : 20;
  const span_m = Math.round(Math.hypot(dx * width, dy * width) * 10) / 10;
  // Wider scatter → slightly more cable labour.
  const labour_hr =
    Math.round((base.fixture_count * 0.45 + span_m * 0.08) * 10) / 10;
  const cost_aud = Math.round(
    base.fixture_count * 220 + labour_hr * 85 + span_m * 18,
  );
  return {
    ...base,
    labour_hr,
    cost_aud,
    span_m,
    label:
      base.fixture_count === 0
        ? "No lighting points"
        : `${base.fixture_count} uplight${base.fixture_count === 1 ? "" : "s"} · ${span_m} m span · ~$${cost_aud.toLocaleString("en-AU")}`,
  };
}

/** Label for assist lighting placements persisted to the canvas. */
export function assistLightingPlacementLabel(fixture: string): string {
  const trimmed = fixture.trim() || "Brass uplight";
  return ASSIST_NAME.test(trimmed) ? trimmed : `Assist: ${trimmed}`;
}
