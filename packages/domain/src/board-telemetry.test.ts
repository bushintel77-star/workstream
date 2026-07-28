import { describe, expect, it } from "vitest";
import type { TelemetryReading } from "@workstream/contracts";
import {
  assertTelemetryUnit,
  demoTelemetryIngest,
  latestTelemetryByKind,
  telemetryBoardPoints,
  telemetryUnitFor,
} from "./board-telemetry";

function reading(
  partial: Partial<TelemetryReading> &
    Pick<TelemetryReading, "id" | "kind" | "value" | "observed_at">,
): TelemetryReading {
  return {
    project_id: "11111111-1111-4111-8111-111111111111",
    unit: telemetryUnitFor(partial.kind, partial.unit),
    x_pct: null,
    y_pct: null,
    sensor_id: null,
    label: null,
    source: "sensor",
    created_at: partial.observed_at,
    ...partial,
  };
}

describe("board-telemetry", () => {
  it("prefers the newest observed_at per kind", () => {
    const rows = [
      reading({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        kind: "soil_moisture",
        value: 20,
        observed_at: "2026-07-01T10:00:00.000Z",
      }),
      reading({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        kind: "soil_moisture",
        value: 41,
        observed_at: "2026-07-28T10:00:00.000Z",
      }),
      reading({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        kind: "flow",
        value: 8,
        observed_at: "2026-07-28T09:00:00.000Z",
      }),
    ];
    const latest = latestTelemetryByKind(rows);
    expect(latest).toHaveLength(2);
    expect(latest[0]).toMatchObject({
      kind: "soil_moisture",
      value: 41,
      reading_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(latest[1]?.kind).toBe("flow");
  });

  it("only places board points with coords", () => {
    const rows = [
      reading({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        kind: "flow",
        value: 10,
        observed_at: "2026-07-28T10:00:00.000Z",
        x_pct: 40,
        y_pct: 50,
      }),
      reading({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        kind: "sediment",
        value: 5,
        observed_at: "2026-07-28T10:00:00.000Z",
      }),
    ];
    const pts = telemetryBoardPoints(rows);
    expect(pts).toHaveLength(1);
    expect(pts[0]).toMatchObject({ kind: "flow", x_pct: 40, y_pct: 50 });
  });

  it("enforces canonical units", () => {
    expect(assertTelemetryUnit("soil_moisture", "%")).toEqual({ ok: true });
    expect(assertTelemetryUnit("flow", "L/s")).toEqual({
      ok: false,
      expected: "L/min",
    });
    expect(telemetryUnitFor("thermal_comfort")).toBe("°C");
  });

  it("demo ingest is labelled demo and covers four kinds", () => {
    const demo = demoTelemetryIngest();
    expect(demo).toHaveLength(4);
    expect(demo.every((d) => d.source === "demo")).toBe(true);
    expect(new Set(demo.map((d) => d.kind)).size).toBe(4);
  });
});
