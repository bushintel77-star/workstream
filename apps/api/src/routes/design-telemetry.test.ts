import { describe, expect, it } from "vitest";
import { buildTestApp } from "../test/build-app";

describe("design telemetry routes", () => {
  it("ingests readings and returns latest-by-kind", async () => {
    const { app, store } = await buildTestApp();
    const project = await store.createProject("dev-user", {
      address: "1 Telemetry Street Melbourne",
    });

    const post = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/design/telemetry`,
      payload: {
        readings: [
          {
            kind: "soil_moisture",
            value: 33,
            x_pct: 40,
            y_pct: 55,
            sensor_id: "sm-1",
            label: "Bed A",
          },
          {
            kind: "flow",
            value: 9.5,
            x_pct: 30,
            y_pct: 40,
          },
        ],
      },
    });
    expect(post.statusCode).toBe(201);
    const body = post.json();
    expect(body.count).toBe(2);
    expect(body.latest).toHaveLength(2);
    expect(body.latest[0].kind).toBe("soil_moisture");
    expect(body.latest[0].unit).toBe("%");

    const get = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/design/telemetry`,
    });
    expect(get.statusCode).toBe(200);
    expect(get.json().count).toBe(2);

    await app.close();
  });

  it("rejects mismatched units", async () => {
    const { app, store } = await buildTestApp();
    const project = await store.createProject("dev-user", {
      address: "2 Telemetry Street Melbourne",
    });

    const post = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/design/telemetry`,
      payload: {
        readings: [{ kind: "flow", value: 1, unit: "L/s" }],
      },
    });
    expect(post.statusCode).toBe(400);
    expect(post.json().error).toBe("invalid_telemetry_unit");

    await app.close();
  });
});
