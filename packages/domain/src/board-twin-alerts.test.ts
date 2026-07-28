import { describe, expect, it } from "vitest";
import type { TelemetryReading } from "@workstream/contracts";
import {
  HEAT_STRESS_C,
  MOISTURE_CRITICAL_PCT,
  MOISTURE_WATCH_PCT,
  SEDIMENT_CRITICAL_NTU,
  SEDIMENT_WATCH_NTU,
  buildTwinPerformanceAlerts,
} from "./board-twin-alerts";

const PROJECT = "11111111-1111-4111-8111-111111111111";

function reading(
  partial: Partial<TelemetryReading> &
    Pick<TelemetryReading, "id" | "kind" | "value">,
): TelemetryReading {
  return {
    project_id: PROJECT,
    unit:
      partial.kind === "soil_moisture"
        ? "%"
        : partial.kind === "thermal_comfort"
          ? "°C"
          : partial.kind === "flow"
            ? "L/min"
            : "NTU",
    x_pct: 40,
    y_pct: 50,
    sensor_id: "s1",
    label: "Probe",
    source: "sensor",
    observed_at: "2026-07-28T12:00:00.000Z",
    created_at: "2026-07-28T12:00:00.000Z",
    ...partial,
  };
}

describe("buildTwinPerformanceAlerts", () => {
  it("stays silent when readings are within band", () => {
    const alerts = buildTwinPerformanceAlerts([
      reading({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        kind: "soil_moisture",
        value: MOISTURE_WATCH_PCT + 5,
      }),
      reading({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        kind: "sediment",
        value: SEDIMENT_WATCH_NTU - 5,
      }),
    ]);
    expect(alerts).toEqual([]);
  });

  it("flags sediment watch and critical", () => {
    const watch = buildTwinPerformanceAlerts([
      reading({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        kind: "sediment",
        value: SEDIMENT_WATCH_NTU + 1,
        label: "Raingarden",
      }),
    ]);
    expect(watch).toHaveLength(1);
    expect(watch[0]).toMatchObject({
      kind: "sediment_buildup",
      severity: "watch",
    });

    const crit = buildTwinPerformanceAlerts([
      reading({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        kind: "sediment",
        value: SEDIMENT_CRITICAL_NTU,
      }),
    ]);
    expect(crit[0]?.severity).toBe("critical");
  });

  it("flags vegetation stress from dry soil and compounds with heat", () => {
    const dry = buildTwinPerformanceAlerts([
      reading({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        kind: "soil_moisture",
        value: MOISTURE_WATCH_PCT - 2,
      }),
      reading({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        kind: "thermal_comfort",
        value: HEAT_STRESS_C + 1,
      }),
    ]);
    expect(dry).toHaveLength(1);
    expect(dry[0]).toMatchObject({
      kind: "vegetation_stress",
      severity: "watch",
    });
    expect(dry[0]!.title).toMatch(/heat/i);
    expect(dry[0]!.cites).toContain("telemetry.thermal_comfort");

    const critical = buildTwinPerformanceAlerts([
      reading({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        kind: "soil_moisture",
        value: MOISTURE_CRITICAL_PCT - 1,
      }),
    ]);
    expect(critical[0]?.severity).toBe("critical");
  });

  it("labels demo source as seed basis", () => {
    const alerts = buildTwinPerformanceAlerts([
      reading({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        kind: "sediment",
        value: 40,
        source: "demo",
      }),
    ]);
    expect(alerts[0]?.basis).toBe("seed");
  });
});
