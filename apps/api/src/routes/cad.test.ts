import { afterEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../test/build-app";

describe("API — cad", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>["app"];
  let store: Awaited<ReturnType<typeof buildTestApp>>["store"];

  afterEach(async () => {
    if (app) await app.close();
  });

  async function createProject() {
    ({ app, store } = await buildTestApp());
    const res = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: {
        address: "12 CAD Test Ave, Hawthorn VIC 3122",
        lat: -37.82,
        lng: 145.04,
      },
    });
    expect(res.statusCode).toBe(201);
    return (res.json() as { project: { id: string } }).project.id;
  }

  /** ensureCadDocument requires a survey — seed one directly via the store. */
  async function seedSurvey(projectId: string) {
    await store.upsertSurvey("dev-user", projectId, {
      aerial_uri: "https://example.com/aerial.png",
      title_polygon: {
        type: "Polygon",
        coordinates: [
          [
            [145.04, -37.82],
            [145.0403, -37.82],
            [145.0403, -37.8197],
            [145.04, -37.8197],
            [145.04, -37.82],
          ],
        ],
      },
      house_polygon: {
        type: "Polygon",
        coordinates: [
          [
            [145.0401, -37.8199],
            [145.0402, -37.8199],
            [145.0402, -37.8198],
            [145.0401, -37.8198],
            [145.0401, -37.8199],
          ],
        ],
      },
      garden_polygon: {
        type: "Polygon",
        coordinates: [
          [
            [145.04, -37.82],
            [145.0403, -37.82],
            [145.0403, -37.8197],
            [145.04, -37.8197],
            [145.04, -37.82],
          ],
        ],
      },
      lot_area_m2: 600,
      house_area_m2: 200,
      garden_area_m2: 400,
      measurements: [],
    });
  }

  it("returns 404 for project-not-found on every cad route", async () => {
    ({ app } = await buildTestApp());
    const missingId = "11111111-1111-4111-8111-111111111111";
    const cases = [
      { method: "GET", url: `/projects/${missingId}/cad` },
      { method: "GET", url: `/projects/${missingId}/cad.dxf` },
      { method: "GET", url: `/projects/${missingId}/cad.gltf` },
      { method: "GET", url: `/projects/${missingId}/cad.sync.json` },
      { method: "POST", url: `/projects/${missingId}/cad/ensure` },
      { method: "POST", url: `/projects/${missingId}/cad/ops` },
      { method: "POST", url: `/projects/${missingId}/cad/generate` },
      { method: "POST", url: `/projects/${missingId}/cad/edit` },
      { method: "POST", url: `/projects/${missingId}/cad/accept` },
      { method: "POST", url: `/projects/${missingId}/cad/quantity-survey` },
      { method: "POST", url: `/projects/${missingId}/cad/build` },
      { method: "POST", url: `/projects/${missingId}/cad/quote` },
    ] as const;
    for (const c of cases) {
      const res = await app.inject({
        method: c.method,
        url: c.url,
        payload: c.method === "POST" ? {} : undefined,
      });
      expect(res.statusCode).toBe(404);
    }
  });

  it("ensure → generate → ops → get round-trip builds a CAD document with svg", async () => {
    const projectId = await createProject();
    await seedSurvey(projectId);

    // generate requires a canvas with at least one placement.
    await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/design-canvas`,
      payload: {
        placements: [
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            symbol_id: "hornbeam-pleached",
            x_pct: 20,
            y_pct: 30,
            rotation_deg: 0,
            scale: 1,
          },
        ],
        construction_trenches: [],
      },
    });

    const ensure = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/cad/ensure`,
    });
    expect(ensure.statusCode).toBe(200);
    const ensureBody = ensure.json() as {
      document?: { id?: string };
      svg?: string;
    };
    expect(ensureBody.document).toBeDefined();

    const generate = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/cad/generate`,
      payload: { width_m: 20, height_m: 15 },
    });
    expect(generate.statusCode).toBe(200);

    const get = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/cad`,
    });
    expect(get.statusCode).toBe(200);
    const getBody = get.json() as {
      document: { id: string };
      svg: string;
    };
    expect(getBody.document.id).toBeDefined();
    expect(typeof getBody.svg).toBe("string");
  });

  it("cad/ops rejects an invalid batch with 400", async () => {
    const projectId = await createProject();
    // ops with an unknown op kind fails CadOpsBatchSchema.
    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/cad/ops`,
      payload: { ops: [{ kind: "not-a-real-op" }] },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string; issues: unknown[] };
    expect(body.error).toBe("Validation failed");
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it("cad/edit rejects an empty instruction with 400", async () => {
    const projectId = await createProject();
    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/cad/edit`,
      payload: { instruction: "" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string; issues: unknown[] };
    expect(body.error).toBe("Validation failed");
  });

  it("cad/build rejects an invalid scenario with 400", async () => {
    const projectId = await createProject();
    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/cad/build`,
      payload: { scenario: "deluxe" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string; issues: unknown[] };
    expect(body.error).toBe("Validation failed");
  });

  it("cad.dxf / cad.gltf / cad.sync.json return attachment downloads after ensure", async () => {
    const projectId = await createProject();
    await seedSurvey(projectId);
    const ensure = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/cad/ensure`,
    });
    expect(ensure.statusCode).toBe(200);

    const dxf = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/cad.dxf`,
    });
    expect(dxf.statusCode).toBe(200);
    expect(dxf.headers["content-type"]).toContain("application/dxf");
    expect(dxf.headers["content-disposition"]).toContain("attachment");

    const gltf = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/cad.gltf`,
    });
    expect(gltf.statusCode).toBe(200);
    expect(gltf.headers["content-type"]).toContain("model/gltf+json");

    const sync = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/cad.sync.json`,
    });
    expect(sync.statusCode).toBe(200);
    expect(sync.headers["content-type"]).toContain("application/json");
  });
});
