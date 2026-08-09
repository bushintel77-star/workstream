import { afterEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../test/build-app";

describe("POST /projects/:id/presentation-pack", () => {
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;

  afterEach(async () => {
    await ctx?.app.close();
  });

  it("returns canvas-native sun-cast + elevation deep links (PDF §4.9)", async () => {
    ctx = await buildTestApp();
    const { app } = ctx;

    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: {
        address: "12 Pack Link St, Melbourne VIC 3000",
        lat: -37.81,
        lng: 144.96,
      },
    });
    expect([200, 201]).toContain(create.statusCode);
    const projectId = (create.json() as { project: { id: string } }).project
      .id;

    const pack = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/presentation-pack`,
      payload: {},
    });
    expect(pack.statusCode).toBe(200);
    const body = pack.json() as {
      checklist: Array<{ id: string; status: string; uri: string | null }>;
    };
    const sun = body.checklist.find((c) => c.id === "sun-cast");
    const elev = body.checklist.find((c) => c.id === "elevations");
    const freeze = body.checklist.find((c) => c.id === "freeze");
    expect(sun?.status).toBe("ready");
    expect(sun?.uri).toBe(`/projects/${projectId}?mode=cad&shade=1`);
    expect(elev?.status).toBe("ready");
    expect(elev?.uri).toBe(`/projects/${projectId}?mode=elevation`);
    expect(freeze?.status).toBe("ready");
    expect(freeze?.uri).toBe(`/projects/${projectId}?mode=cad&branches=1`);
  });
});
