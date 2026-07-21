import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getActiveTelemetryAttributes,
  initTelemetry,
  resetTelemetryForTest,
  runWithTelemetryAttributes,
  shutdownTelemetry,
} from "./telemetry";

describe("telemetry", () => {
  afterEach(async () => {
    await shutdownTelemetry();
    resetTelemetryForTest();
    vi.restoreAllMocks();
  });

  it("is a no-op when OTEL_EXPORTER_OTLP_ENDPOINT is absent", () => {
    const sdkFactory = vi.fn();
    const result = initTelemetry({ env: {}, sdkFactory });

    expect(result).toEqual({ enabled: false, started: false });
    expect(sdkFactory).not.toHaveBeenCalled();
  });

  it("initialises the SDK when OTEL_EXPORTER_OTLP_ENDPOINT is set", () => {
    const start = vi.fn();
    const shutdown = vi.fn();
    const sdkFactory = vi.fn(() => ({ start, shutdown }));

    const result = initTelemetry({
      env: { OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com" },
      sdkFactory,
    });

    expect(result).toEqual({
      enabled: true,
      started: true,
      traceUrl: "https://otel.example.com/v1/traces",
    });
    expect(sdkFactory).toHaveBeenCalledWith({
      traceUrl: "https://otel.example.com/v1/traces",
    });
    expect(start).toHaveBeenCalledOnce();
  });

  it("inherits active attributes for nested telemetry spans", async () => {
    await runWithTelemetryAttributes(
      {
        "operator.id": "operator-1",
        "project.id": "project-1",
      },
      async () => {
        await runWithTelemetryAttributes(
          {
            "pipeline.stage": "design",
            "tokens.input": undefined,
          },
          async () => {
            expect(getActiveTelemetryAttributes()).toEqual({
              "operator.id": "operator-1",
              "project.id": "project-1",
              "pipeline.stage": "design",
            });
          },
        );
      },
    );
  });
});

