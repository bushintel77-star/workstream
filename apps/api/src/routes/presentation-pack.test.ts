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
      supplier_uri: string | null;
      checklist: Array<{
        id: string;
        status: string;
        uri: string | null;
        reason?: string | null;
      }>;
    };
    const sun = body.checklist.find((c) => c.id === "sun-cast");
    const elev = body.checklist.find((c) => c.id === "elevations");
    const freeze = body.checklist.find((c) => c.id === "freeze");
    const supplier = body.checklist.find((c) => c.id === "supplier");
    expect(sun?.status).toBe("ready");
    expect(sun?.uri).toBe(`/projects/${projectId}?mode=cad&shade=1`);
    expect(elev?.status).toBe("ready");
    expect(elev?.uri).toBe(`/projects/${projectId}?mode=elevation`);
    expect(freeze?.status).toBe("ready");
    expect(freeze?.uri).toBe(`/projects/${projectId}?mode=cad&branches=1`);
    expect(supplier?.status).toBe("skipped");
    expect(supplier?.uri).toBeNull();
    expect(supplier?.reason).toMatch(/No live quote \/ BOM lines/i);
    expect(body.supplier_uri).toBeNull();
  });

  it("generates supplier order from live costing lines (PDF §4.9)", async () => {
    ctx = await buildTestApp();
    const { app, store } = ctx;
    const ownerId = "dev-user";

    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: {
        address: "14 Supplier Pack St, Melbourne VIC 3000",
        lat: -37.81,
        lng: 144.96,
      },
    });
    expect([200, 201]).toContain(create.statusCode);
    const projectId = (create.json() as { project: { id: string } }).project
      .id;

    const design = await store.upsertDesign(ownerId, projectId, {
      mode: "auto",
      proposal: {
        zones: [
          {
            id: "z1",
            name: "Rear",
            treatment: "Planting",
            plantings: [],
            hardscape: [],
            lighting: [],
            irrigation: [],
          },
        ],
        estimated_complexity: "standard",
      },
      gaps: [],
      rationale: "Test supplier pack",
    });
    await store.upsertCosting(ownerId, projectId, design.id, {
      scenario: "standard",
      line_items: [
        {
          sku: "PLT-HORN",
          label: "Pleached hornbeam",
          unit: "ea",
          qty: 4,
          rate: 120,
          total: 480,
          is_provisional: false,
        },
      ],
      subtotal: 480,
      gst: 48,
      total: 528,
    });

    const pack = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/presentation-pack`,
      payload: {},
    });
    expect(pack.statusCode).toBe(200);
    const body = pack.json() as {
      supplier_uri: string | null;
      checklist: Array<{
        id: string;
        status: string;
        uri: string | null;
      }>;
    };
    const supplier = body.checklist.find((c) => c.id === "supplier");
    expect(supplier?.status).toBe("generated");
    expect(body.supplier_uri).toMatch(/\/outputs\/.+\.html$/);
    expect(supplier?.uri).toBe(body.supplier_uri);
  });
});
