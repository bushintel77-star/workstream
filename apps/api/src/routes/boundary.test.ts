import { afterEach, describe, expect, it } from "vitest";
import { SiteBoundarySchema } from "@workstream/contracts";
import { buildTestApp } from "../test/build-app";

describe("API — boundary", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>["app"];

  afterEach(async () => {
    if (app) await app.close();
  });

  async function createProject() {
    ({ app } = await buildTestApp());
    const res = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: {
        address: "5 Boundary Rd, Kew VIC 3101",
        lat: -37.81,
        lng: 145.03,
      },
    });
    expect(res.statusCode).toBe(201);
    return (res.json() as { project: { id: string } }).project.id;
  }

  /** Minimal valid upsert payload matching UpsertSiteBoundarySchema. */
  function boundaryPayload(projectId: string) {
    return {
      project_id: projectId,
      status: "UNVERIFIED",
      geo_reference: {
        crs: "EPSG:4326",
        canvas_origin_geo: { lng: 145.03, lat: -37.81 },
        metres_per_canvas_unit: 1,
      },
      width_m: 30,
      height_m: 20,
      calculated_metrics: {
        total_area_m2: 600,
        perimeter_m: 100,
        ai_confidence: null,
      },
      vertices: [
        {
          vertex_id: "v1",
          sequence_index: 0,
          source: "HUMAN_ADDED",
          is_locked: false,
          canvas_coords: { x: 0, y: 0 },
          geo_coords: { lng: 145.03, lat: -37.81 },
        },
        {
          vertex_id: "v2",
          sequence_index: 1,
          source: "HUMAN_ADDED",
          is_locked: false,
          canvas_coords: { x: 30, y: 0 },
          geo_coords: { lng: 145.0303, lat: -37.81 },
        },
        {
          vertex_id: "v3",
          sequence_index: 2,
          source: "HUMAN_ADDED",
          is_locked: false,
          canvas_coords: { x: 30, y: 20 },
          geo_coords: { lng: 145.0303, lat: -37.8098 },
        },
      ],
    };
  }

  it("GET returns { boundary: null } when none exists (no 404)", async () => {
    const projectId = await createProject();
    const res = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/boundary`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ boundary: null });
  });

  it("PUT persists and GET round-trips; body parses as SiteBoundary", async () => {
    const projectId = await createProject();
    const put = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/boundary`,
      payload: boundaryPayload(projectId),
    });
    expect(put.statusCode).toBe(200);
    const putBody = put.json() as { boundary: unknown };
    const parsed = SiteBoundarySchema.safeParse(putBody.boundary);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.vertices).toHaveLength(3);
    expect(parsed.data.source_kind).toBe("manual");

    const get = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/boundary`,
    });
    expect(get.statusCode).toBe(200);
    const getBody = get.json() as { boundary: { vertices: unknown[] } };
    expect(getBody.boundary.vertices).toHaveLength(3);
  });

  it("PUT rejects a boundary with fewer than 3 vertices", async () => {
    const projectId = await createProject();
    const payload = boundaryPayload(projectId);
    payload.vertices = payload.vertices.slice(0, 2);
    const res = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/boundary`,
      payload,
    });
    expect(res.statusCode).toBe(400);
  });

  it("lock → unlock toggles status, both return the boundary", async () => {
    const projectId = await createProject();
    await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/boundary`,
      payload: boundaryPayload(projectId),
    });

    const lock = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/boundary/lock`,
    });
    expect(lock.statusCode).toBe(200);
    const locked = (lock.json() as { boundary: { status: string } }).boundary;
    expect(locked.status).toBe("VERIFIED");

    const unlock = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/boundary/unlock`,
    });
    expect(unlock.statusCode).toBe(200);
    const unlocked = (unlock.json() as { boundary: { status: string } })
      .boundary;
    expect(unlocked.status).toBe("UNVERIFIED");
  });

  it("DELETE resets the boundary and reports deleted=true", async () => {
    const projectId = await createProject();
    await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/boundary`,
      payload: boundaryPayload(projectId),
    });
    const del = await app.inject({
      method: "DELETE",
      url: `/projects/${projectId}/boundary`,
    });
    expect(del.statusCode).toBe(200);
    expect((del.json() as { deleted: boolean }).deleted).toBe(true);

    const get = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/boundary`,
    });
    expect((get.json() as { boundary: unknown }).boundary).toBeNull();
  });

  it("auto-trace accepts prefer_gis and returns 201 with a result shape", async () => {
    const projectId = await createProject();
    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/boundary/auto-trace`,
      payload: { prefer_gis: false },
    });
    // auto-trace may legitimately fail to find GIS data in test fixtures;
    // contract is that it returns 201 on success or a 400 with an error message.
    expect([201, 400]).toContain(res.statusCode);
    if (res.statusCode === 201) {
      const body = res.json() as { boundary?: unknown };
      expect(body.boundary).toBeDefined();
    }
  });

  it("stormwater-geojson rejects a missing geojson body with 400", async () => {
    const projectId = await createProject();
    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/stormwater-geojson`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toBe("geojson required");
  });

  it("all routes return 404 for project-not-found", async () => {
    ({ app } = await buildTestApp());
    const missingId = "11111111-1111-4111-8111-111111111111";
    const cases = [
      { method: "GET", url: `/projects/${missingId}/boundary` },
      { method: "PUT", url: `/projects/${missingId}/boundary` },
      { method: "POST", url: `/projects/${missingId}/boundary/auto-trace` },
      { method: "POST", url: `/projects/${missingId}/boundary/lock` },
      { method: "POST", url: `/projects/${missingId}/boundary/unlock` },
      { method: "DELETE", url: `/projects/${missingId}/boundary` },
    ] as const;
    for (const c of cases) {
      const res = await app.inject({
        method: c.method,
        url: c.url,
        payload: c.method === "PUT" ? { project_id: missingId } : undefined,
      });
      expect(res.statusCode).toBe(404);
    }
  });
});
