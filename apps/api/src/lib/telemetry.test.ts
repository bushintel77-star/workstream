import { afterEach, describe, expect, it, vi } from "vitest";
import { initTelemetry, resetTelemetryForTests } from "./telemetry";

describe("telemetry", () => {
  afterEach(async () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    await resetTelemetryForTests();
  });

  it("is a no-op when OTEL_EXPORTER_OTLP_ENDPOINT is absent", () => {
    const createSdk = vi.fn();

    expect(initTelemetry({ createSdk })).toBe(false);
    expect(createSdk).not.toHaveBeenCalled();
  });

  it("starts the SDK when OTEL_EXPORTER_OTLP_ENDPOINT is configured", () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT =
      "https://otel.example.test/v1/traces";
    const shutdown = vi.fn(async () => undefined);
    const start = vi.fn();
    const createSdk = vi.fn(() => ({ start, shutdown }));

    expect(initTelemetry({ createSdk })).toBe(true);
    expect(createSdk).toHaveBeenCalledWith("https://otel.example.test/v1/traces");
    expect(start).toHaveBeenCalledOnce();
  });
});
