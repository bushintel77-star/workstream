import { afterEach, describe, expect, it } from "vitest";
import { DesignCanvasSchema } from "@workstream/contracts";
import { buildTestApp } from "../test/build-app";

describe("API — design-canvas", () => {
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
        address: "8 Canvas Test St, Richmond VIC 3121",
        lat: -37.82,
        lng: 145.0,
      },
    });
    expect(res.statusCode).toBe(201);
    return (res.json() as { project: { id: string } }).project.id;
  }

  it("GET returns an empty canvas shell when none exists (no 404)", async () => {
    const projectId = await createProject();
    const res = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design-canvas`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      canvas: { placements: unknown[]; project_id: string; id: string | null };
      quote: unknown;
    };
    expect(body.canvas.placements).toEqual([]);
    expect(body.canvas.project_id).toBe(projectId);
    expect(body.quote).toBeNull();
  });

  it("PUT persists placements and GET round-trips them; body parses as DesignCanvas", async () => {
    const projectId = await createProject();
    const placeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const put = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/design-canvas`,
      payload: {
        placements: [
          {
            id: placeId,
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
    expect(put.statusCode).toBe(200);
    const putBody = put.json() as { canvas: unknown };
    const parsed = DesignCanvasSchema.safeParse(putBody.canvas);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.placements).toHaveLength(1);
    expect(parsed.data.placements[0]?.symbol_id).toBe("hornbeam-pleached");

    const get = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design-canvas`,
    });
    expect(get.statusCode).toBe(200);
    const getBody = get.json() as { canvas: { placements: unknown[] } };
    expect(getBody.canvas.placements).toHaveLength(1);
  });

  it("PUT rejects an invalid placement (bad x_pct) with 400", async () => {
    const projectId = await createProject();
    const put = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/design-canvas`,
      payload: {
        placements: [
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            symbol_id: "hornbeam-pleached",
            x_pct: 200, // out of 0..100
            y_pct: 30,
            rotation_deg: 0,
            scale: 1,
          },
        ],
      },
    });
    expect(put.statusCode).toBe(400);
    const body = put.json() as { error: string; issues: unknown[] };
    expect(body.error).toBe("Validation failed");
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it("GET / PUT on a missing project return 404", async () => {
    ({ app } = await buildTestApp());
    const missingId = "11111111-1111-4111-8111-111111111111";
    const get = await app.inject({
      method: "GET",
      url: `/projects/${missingId}/design-canvas`,
    });
    expect(get.statusCode).toBe(404);
    const put = await app.inject({
      method: "PUT",
      url: `/projects/${missingId}/design-canvas`,
      payload: { placements: [] },
    });
    expect(put.statusCode).toBe(404);
  });

  it("GET honours branch_id query and isolates branch tips from main", async () => {
    const projectId = await createProject();
    // Seed main with one placement.
    const mainPlace = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/design-canvas`,
      payload: {
        placements: [
          {
            id: mainPlace,
            symbol_id: "hornbeam-pleached",
            x_pct: 10,
            y_pct: 10,
            rotation_deg: 0,
            scale: 1,
          },
        ],
        construction_trenches: [],
      },
    });

    // Fork a branch.
    const fork = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/design-branches`,
      payload: { name: "Branch A" },
    });
    expect(fork.statusCode).toBe(201);
    const branchId = (fork.json() as { branch: { id: string } }).branch.id;

    // Write a second placement onto the branch tip.
    await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/design-canvas`,
      payload: {
        branch_id: branchId,
        placements: [
          {
            id: mainPlace,
            symbol_id: "hornbeam-pleached",
            x_pct: 10,
            y_pct: 10,
            rotation_deg: 0,
            scale: 1,
          },
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            symbol_id: "lomandra-mass",
            x_pct: 50,
            y_pct: 50,
            rotation_deg: 0,
            scale: 1,
          },
        ],
        construction_trenches: [],
      },
    });

    const mainTip = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design-canvas`,
    });
    expect(
      (mainTip.json() as { canvas: { placements: unknown[] } }).canvas
        .placements,
    ).toHaveLength(1);

    const branchTip = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design-canvas?branch_id=${branchId}`,
    });
    expect(branchTip.statusCode).toBe(200);
    expect(
      (branchTip.json() as { canvas: { placements: unknown[] } }).canvas
        .placements,
    ).toHaveLength(2);
  });
});
