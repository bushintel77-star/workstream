import type { IrrigationZone, SpatialObject } from "@workstream/contracts";

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
