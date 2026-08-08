/**
 * Live twin telemetry helpers — latest-by-kind and board overlay points.
 *
 * Domain-pure: no server imports. Persistence and HTTP live elsewhere.
 */

import {
  TELEMETRY_UNITS,
  type TelemetryKind,
  type TelemetryLatest,
  type TelemetryReading,
  type TelemetrySource,
} from "@workstream/contracts";

export type { TelemetryKind, TelemetryLatest, TelemetryReading };

export const TELEMETRY_KIND_ORDER: TelemetryKind[] = [
  "soil_moisture",
  "thermal_comfort",
  "flow",
  "sediment",
];

export const TELEMETRY_KIND_LABEL: Record<TelemetryKind, string> = {
  soil_moisture: "Soil moisture",
  thermal_comfort: "Thermal comfort",
  flow: "Flow",
  sediment: "Sediment",
};

/** Resolve unit for a kind — ingest may omit; never invent a mismatched unit. */
export function telemetryUnitFor(
  kind: TelemetryKind,
  unit?: string | null,
): string {
  const expected = TELEMETRY_UNITS[kind];
  if (!unit || unit.trim() === "") return expected;
  return unit.trim();
}

export function assertTelemetryUnit(
  kind: TelemetryKind,
  unit: string,
): { ok: true } | { ok: false; expected: string } {
  const expected = TELEMETRY_UNITS[kind];
  if (unit === expected) return { ok: true };
  return { ok: false, expected };
}

/**
 * Newest reading per kind (by observed_at, then created_at).
 * Empty kinds are omitted — absent is not a comfortable zero.
 */
export function latestTelemetryByKind(
  readings: readonly TelemetryReading[],
): TelemetryLatest[] {
  const best = new Map<TelemetryKind, TelemetryReading>();
  for (const r of readings) {
    const prev = best.get(r.kind);
    if (!prev) {
      best.set(r.kind, r);
      continue;
    }
    const t = Date.parse(r.observed_at) || Date.parse(r.created_at) || 0;
    const pt = Date.parse(prev.observed_at) || Date.parse(prev.created_at) || 0;
    if (t > pt) best.set(r.kind, r);
  }
  return TELEMETRY_KIND_ORDER.filter((k) => best.has(k)).map((k) => {
    const r = best.get(k)!;
    return {
      kind: r.kind,
      value: r.value,
      unit: r.unit,
      observed_at: r.observed_at,
      sensor_id: r.sensor_id,
      label: r.label,
      x_pct: r.x_pct,
      y_pct: r.y_pct,
      source: r.source,
      reading_id: r.id,
    };
  });
}

export type TelemetryBoardPoint = {
  reading_id: string;
  kind: TelemetryKind;
  label: string;
  value: number;
  unit: string;
  x_pct: number;
  y_pct: number;
  source: TelemetrySource;
  observed_at: string;
};

/** Points with board coords for the Live telemetry overlay. */
export function telemetryBoardPoints(
  readings: readonly TelemetryReading[],
): TelemetryBoardPoint[] {
  const latest = latestTelemetryByKind(readings);
  const out: TelemetryBoardPoint[] = [];
  for (const row of latest) {
    if (row.x_pct == null || row.y_pct == null) continue;
    out.push({
      reading_id: row.reading_id,
      kind: row.kind,
      label: row.label ?? TELEMETRY_KIND_LABEL[row.kind],
      value: row.value,
      unit: row.unit,
      x_pct: row.x_pct,
      y_pct: row.y_pct,
      source: row.source,
      observed_at: row.observed_at,
    });
  }
  return out;
}

/** Demo seed for empty boards — labelled `demo`, never presented as sensor fact. */
export function demoTelemetryIngest(): Array<{
  kind: TelemetryKind;
  value: number;
  unit: string;
  x_pct: number;
  y_pct: number;
  sensor_id: string;
  label: string;
  source: "demo";
}> {
  return [
    {
      kind: "soil_moisture",
      /** Below moisture watch so Load demo sensors exercises Phase 5 alerts. */
      value: 22,
      unit: TELEMETRY_UNITS.soil_moisture,
      x_pct: 38,
      y_pct: 62,
      sensor_id: "demo-sm-1",
      label: "Bed moisture",
      source: "demo",
    },
    {
      kind: "thermal_comfort",
      value: 33.2,
      unit: TELEMETRY_UNITS.thermal_comfort,
      x_pct: 52,
      y_pct: 44,
      sensor_id: "demo-th-1",
      label: "Patio comfort",
      source: "demo",
    },
    {
      kind: "flow",
      value: 12.5,
      unit: TELEMETRY_UNITS.flow,
      x_pct: 28,
      y_pct: 48,
      sensor_id: "demo-fl-1",
      label: "Irrigation feed",
      source: "demo",
    },
    {
      kind: "sediment",
      value: 32,
      unit: TELEMETRY_UNITS.sediment,
      x_pct: 70,
      y_pct: 58,
      sensor_id: "demo-sd-1",
      label: "Raingarden outlet",
      source: "demo",
    },
  ];
}
