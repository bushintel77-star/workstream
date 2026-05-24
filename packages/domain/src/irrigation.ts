import type { CanvasPointPct, IrrigationZone } from "@workstream/contracts";
import {
  polylineLengthFromCanvasPercent,
  type CanvasGroundScale,
} from "./canvas-geometry";

export const DEFAULT_MAX_LPH_PER_VALVE = 1000;

export type IrrigationZoneStats = {
  zoneId: string;
  name: string;
  lengthM: number;
  emitters: number;
  flowLph: number;
};

export type IrrigationSummary = {
  zones: IrrigationZoneStats[];
  totalLengthM: number;
  totalEmitters: number;
  totalFlowLph: number;
  valveCount: number;
};

export function emitterCountForLine(
  lengthM: number,
  spacingCm: number,
): number {
  if (lengthM <= 0 || spacingCm <= 0) return 0;
  const spacingM = spacingCm / 100;
  return Math.floor(lengthM / spacingM) + 1;
}

export function zoneFlowLph(emitters: number, flowLphPerEmitter: number): number {
  return emitters * flowLphPerEmitter;
}

export function valveCount(
  totalFlowLph: number,
  maxLphPerValve = DEFAULT_MAX_LPH_PER_VALVE,
): number {
  if (totalFlowLph <= 0) return 0;
  return Math.ceil(totalFlowLph / maxLphPerValve);
}

export function summarizeIrrigationZone(
  zone: IrrigationZone,
  scale: CanvasGroundScale,
): IrrigationZoneStats {
  const lengthM = polylineLengthFromCanvasPercent(zone.points, scale);
  const emitters = emitterCountForLine(lengthM, zone.emitter_spacing_cm);
  const flowLph = zoneFlowLph(emitters, zone.emitter_flow_lph);
  return {
    zoneId: zone.id,
    name: zone.name,
    lengthM,
    emitters,
    flowLph,
  };
}

export function summarizeIrrigationZones(
  zones: IrrigationZone[],
  scale: CanvasGroundScale,
  maxLphPerValve = DEFAULT_MAX_LPH_PER_VALVE,
): IrrigationSummary {
  const zoneStats = zones.map((z) => summarizeIrrigationZone(z, scale));
  const totalLengthM = zoneStats.reduce((s, z) => s + z.lengthM, 0);
  const totalEmitters = zoneStats.reduce((s, z) => s + z.emitters, 0);
  const totalFlowLph = zoneStats.reduce((s, z) => s + z.flowLph, 0);
  return {
    zones: zoneStats,
    totalLengthM,
    totalEmitters,
    totalFlowLph,
    valveCount: valveCount(totalFlowLph, maxLphPerValve),
  };
}

export type IrrigationLineItem = {
  sku: string;
  label: string;
  unit: string;
  qty: number;
};

export function irrigationLineItems(
  summary: IrrigationSummary,
  rateLookup: Map<string, { label: string; unit: string }>,
): IrrigationLineItem[] {
  const items: IrrigationLineItem[] = [];
  if (summary.totalLengthM > 0) {
    const drip = rateLookup.get("IRR-DRIP");
    items.push({
      sku: "IRR-DRIP",
      label: drip?.label ?? "Drip line (inline emitter)",
      unit: drip?.unit ?? "lm",
      qty: Math.ceil(summary.totalLengthM * 10) / 10,
    });
  }
  if (summary.valveCount > 0) {
    const valve = rateLookup.get("IRR-VALVE");
    items.push({
      sku: "IRR-VALVE",
      label: valve?.label ?? "Solenoid valve assembly",
      unit: valve?.unit ?? "ea",
      qty: summary.valveCount,
    });
  }
  if (summary.zones.length > 0) {
    const zoneTask = rateLookup.get("TSK-IRR-ZONE");
    items.push({
      sku: "TSK-IRR-ZONE",
      label: zoneTask?.label ?? "Irrigation zone install",
      unit: zoneTask?.unit ?? "zone",
      qty: summary.zones.length,
    });
  }
  return items;
}

export function polylineToSvgPoints(
  points: CanvasPointPct[],
  widthPx: number,
  heightPx: number,
): string {
  return points
    .map((p) => `${(p.x_pct / 100) * widthPx},${(p.y_pct / 100) * heightPx}`)
    .join(" ");
}
