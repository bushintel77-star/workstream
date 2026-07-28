/**
 * Twin performance alerts from Live telemetry samples.
 *
 * These are maintenance watches — they fire only when a measured (or honestly
 * labelled demo) reading crosses an indicative threshold. They do not invent
 * readings, and they never mutate the board. Phase 5 of the Stage 2 track.
 *
 * Domain-pure: no server imports.
 */

import type {
  BoardFinding,
  BoardProvenance,
  TelemetryLatest,
  TelemetryReading,
  TelemetrySource,
} from "@workstream/contracts";
import { latestTelemetryByKind } from "./board-telemetry";

/** NTU above this is a silt watch at a raingarden / drain outlet. */
export const SEDIMENT_WATCH_NTU = 25;
/** NTU above this wants a clear-out before the next storm. */
export const SEDIMENT_CRITICAL_NTU = 50;

/** Volumetric soil moisture below this is vegetation stress (watch). */
export const MOISTURE_WATCH_PCT = 30;
/** Below this, beds are critically dry for temperate Melbourne gardens. */
export const MOISTURE_CRITICAL_PCT = 18;

/**
 * Air / globe comfort (°C) above this, with dry soil, compounds heat stress
 * on planting — indicative, not a weather station.
 */
export const HEAT_STRESS_C = 32;

function basisFor(source: TelemetrySource): BoardProvenance {
  return source === "demo" ? "seed" : "operator";
}

function sedimentAlert(row: TelemetryLatest): BoardFinding | null {
  if (row.value < SEDIMENT_WATCH_NTU) return null;
  const critical = row.value >= SEDIMENT_CRITICAL_NTU;
  const label = row.label ?? row.sensor_id ?? "outlet";
  return {
    id: `bf-twin-sediment-${row.sensor_id ?? row.reading_id}`,
    kind: "sediment_buildup",
    severity: critical ? "critical" : "watch",
    title: critical
      ? "Sediment buildup — clear outlet"
      : "Sediment rising at outlet",
    detail: critical
      ? `${label} reads ${Math.round(row.value)} NTU (threshold ${SEDIMENT_CRITICAL_NTU}). Clear silt before the next storm — confirm on site.`
      : `${label} reads ${Math.round(row.value)} NTU (watch ≥ ${SEDIMENT_WATCH_NTU}). Check raingarden / drain silt traps — confirm on site.`,
    cites: ["telemetry.sediment", label],
    basis: basisFor(row.source),
    ...(row.x_pct != null && row.y_pct != null
      ? { x: row.x_pct, y: row.y_pct }
      : {}),
  };
}

function vegetationAlert(
  moisture: TelemetryLatest | undefined,
  thermal: TelemetryLatest | undefined,
): BoardFinding | null {
  if (!moisture && !thermal) return null;

  const dry =
    moisture != null && moisture.value < MOISTURE_WATCH_PCT ? moisture : null;
  const hot =
    thermal != null && thermal.value >= HEAT_STRESS_C ? thermal : null;

  if (!dry && !hot) return null;

  // Heat alone without moisture is info; dry soil drives the watch/critical.
  if (!dry && hot) {
    const label = hot.label ?? hot.sensor_id ?? "comfort sensor";
    return {
      id: `bf-twin-heat-${hot.sensor_id ?? hot.reading_id}`,
      kind: "vegetation_stress",
      severity: "info",
      title: "Heat load high near planting",
      detail: `${label} reads ${hot.value.toFixed(1)} °C (watch ≥ ${HEAT_STRESS_C}). Pair with soil moisture before changing irrigation — confirm on site.`,
      cites: ["telemetry.thermal_comfort", label],
      basis: basisFor(hot.source),
      ...(hot.x_pct != null && hot.y_pct != null
        ? { x: hot.x_pct, y: hot.y_pct }
        : {}),
    };
  }

  if (!dry) return null;

  const critical = dry.value < MOISTURE_CRITICAL_PCT;
  const compounded = hot != null;
  const label = dry.label ?? dry.sensor_id ?? "bed sensor";
  const heatNote = compounded
    ? ` Comfort also high (${hot!.value.toFixed(1)} °C).`
    : "";

  return {
    id: `bf-twin-moisture-${dry.sensor_id ?? dry.reading_id}`,
    kind: "vegetation_stress",
    severity: critical ? "critical" : "watch",
    title: critical
      ? "Vegetation stress — beds critically dry"
      : compounded
        ? "Vegetation stress — dry soil under heat"
        : "Vegetation stress — soil moisture low",
    detail: critical
      ? `${label} reads ${Math.round(dry.value)}% moisture (critical < ${MOISTURE_CRITICAL_PCT}%). Check emitters / schedule before plant loss.${heatNote}`
      : `${label} reads ${Math.round(dry.value)}% moisture (watch < ${MOISTURE_WATCH_PCT}%). Tune irrigation hydrozone — confirm on site.${heatNote}`,
    cites: compounded
      ? ["telemetry.soil_moisture", "telemetry.thermal_comfort", label]
      : ["telemetry.soil_moisture", label],
    basis: basisFor(dry.source),
    ...(dry.x_pct != null && dry.y_pct != null
      ? { x: dry.x_pct, y: dry.y_pct }
      : {}),
  };
}

/**
 * Performance alerts from the latest telemetry sample per kind.
 * Empty when no reading crosses a threshold — never invents stress.
 */
export function buildTwinPerformanceAlerts(
  readings: readonly TelemetryReading[],
): BoardFinding[] {
  if (readings.length === 0) return [];
  const latest = latestTelemetryByKind(readings);
  const byKind = new Map(latest.map((r) => [r.kind, r]));

  const out: BoardFinding[] = [];
  const sediment = byKind.get("sediment");
  if (sediment) {
    const a = sedimentAlert(sediment);
    if (a) out.push(a);
  }
  const veg = vegetationAlert(
    byKind.get("soil_moisture"),
    byKind.get("thermal_comfort"),
  );
  if (veg) out.push(veg);

  return out.sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      a.id.localeCompare(b.id),
  );
}

function severityRank(s: BoardFinding["severity"]): number {
  if (s === "critical") return 0;
  if (s === "watch") return 1;
  return 2;
}
