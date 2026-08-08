import { describe, expect, it } from "vitest";
import { buildTestApp } from "../test/build-app";

describe("design findings twin alerts", () => {
  it("merges sediment / vegetation alerts when telemetry is stressed", async () => {
    const { app, store } = await buildTestApp();
    const project = await store.createProject("dev-user", {
      address: "9 Twin Alert Street Melbourne",
    });

    await app.inject({
      method: "POST",
      url: `/projects/${project.id}/design/telemetry`,
      payload: {
        readings: [
          {
            kind: "sediment",
            value: 40,
            x_pct: 70,
            y_pct: 55,
            label: "Outlet",
          },
          {
            kind: "soil_moisture",
            value: 15,
            x_pct: 40,
            y_pct: 60,
            label: "Bed",
          },
        ],
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/design/findings`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const kinds = body.findings.map((f: { kind: string }) => f.kind);
    expect(kinds).toContain("sediment_buildup");
    expect(kinds).toContain("vegetation_stress");

    await app.close();
  });
});
