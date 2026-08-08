import { describe, expect, it } from "vitest";
import { buildTestApp } from "../test/build-app";

describe("design branches VCS", () => {
  it("migrates canvas to main, branches, diffs, merges, abandons", async () => {
    const { app } = await buildTestApp();

    const created = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "12 Wrights Terrace, Prahran VIC 3181" },
    });
    expect(created.statusCode).toBe(201);
    const projectId = (created.json() as { project: { id: string } }).project.id;

    const placeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const putMain = await app.inject({
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
    expect(putMain.statusCode).toBe(200);

    const list = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design-branches`,
    });
    expect(list.statusCode).toBe(200);
    const branches = (list.json() as { branches: Array<{ id: string; name: string }> })
      .branches;
    expect(branches.some((b) => b.name === "main")).toBe(true);
    const mainId = branches.find((b) => b.name === "main")!.id;

    const fork = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/design-branches`,
      payload: { name: "Option — heavy planting" },
    });
    expect(fork.statusCode).toBe(201);
    const branchId = (fork.json() as { branch: { id: string } }).branch.id;

    const trenchId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const putFeature = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/design-canvas`,
      payload: {
        branch_id: branchId,
        placements: [
          {
            id: placeId,
            symbol_id: "hornbeam-pleached",
            x_pct: 20,
            y_pct: 30,
            rotation_deg: 0,
            scale: 1,
          },
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            symbol_id: "lomandra-mass",
            x_pct: 40,
            y_pct: 50,
            rotation_deg: 0,
            scale: 1,
          },
        ],
        construction_trenches: [
          {
            id: trenchId,
            name: "Irrig main",
            kind: "irrig_main",
            points: [
              { x_pct: 10, y_pct: 10 },
              { x_pct: 60, y_pct: 10 },
            ],
            depth_mm: 400,
            source: "auto",
          },
        ],
      },
    });
    expect(putFeature.statusCode).toBe(200);

    const mainTip = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design-canvas`,
    });
    expect(
      (mainTip.json() as { canvas: { placements: unknown[] } }).canvas.placements,
    ).toHaveLength(1);

    const branchTip = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design-canvas?branch_id=${branchId}`,
    });
    expect(
      (branchTip.json() as { canvas: { placements: unknown[] } }).canvas
        .placements,
    ).toHaveLength(2);

    const diff = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design-branches/${branchId}/diff`,
    });
    expect(diff.statusCode).toBe(200);
    const diffBody = diff.json() as {
      diff: { added: number; changes: unknown[] };
    };
    expect(diffBody.diff.added).toBeGreaterThan(0);

    const merge = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/design-branches/${branchId}/merge`,
      payload: {},
    });
    expect(merge.statusCode).toBe(200);

    const mainAfter = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design-canvas`,
    });
    const canvas = (
      mainAfter.json() as {
        canvas: {
          placements: unknown[];
          construction_trenches: unknown[];
        };
      }
    ).canvas;
    expect(canvas.placements).toHaveLength(2);
    expect(canvas.construction_trenches).toHaveLength(1);

    const abandonFork = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/design-branches`,
      payload: { name: "Scratch explore" },
    });
    const scratchId = (abandonFork.json() as { branch: { id: string } }).branch
      .id;
    const abandon = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/design-branches/${scratchId}/abandon`,
    });
    expect(abandon.statusCode).toBe(200);
    expect((abandon.json() as { branch: { status: string } }).branch.status).toBe(
      "abandoned",
    );

    const planting = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/schedules/planting`,
    });
    expect(planting.statusCode).toBe(200);
    expect(
      (planting.json() as { schedule: { rows: unknown[] } }).schedule.rows.length,
    ).toBeGreaterThan(0);

    const pack = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/documentation-packages`,
      payload: { title: "Issue pack" },
    });
    expect(pack.statusCode).toBe(201);
    const packId = (pack.json() as { package: { id: string } }).package.id;
    const issued = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/documentation-packages/${packId}/issue`,
      payload: {},
    });
    expect(issued.statusCode).toBe(200);
    const zip = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/documentation-packages/${packId}/zip`,
    });
    expect(zip.statusCode).toBe(200);
    expect(zip.headers["content-type"]).toContain("application/zip");

    void mainId;
    await app.close();
  });
});
