import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { DesignBoardReportResponseSchema } from "@workstream/contracts";
import { buildTestApp } from "../test/build-app";

const OWNER = "dev-user";

const AERIAL =
  "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/144.993,-37.849,18,0/800x600";

/**
 * A board with the artefacts the report reasons over: a pleached hornbeam that
 * carries a mature spread, turf, an existing tree with a measured trunk, a
 * drainage trench with nothing located under it, and a drip zone.
 */
async function seedBoard(
  store: Awaited<ReturnType<typeof buildTestApp>>["store"],
  app: Awaited<ReturnType<typeof buildTestApp>>["app"],
) {
  const create = await app.inject({
    method: "POST",
    url: "/projects/",
    payload: {
      address: "36 Wrights Terrace, Prahran VIC 3181",
      lat: -37.849,
      lng: 144.993,
    },
  });
  const projectId = (create.json() as { project: { id: string } }).project.id;

  await store.upsertSurvey(OWNER, projectId, {
    aerial_uri: AERIAL,
    title_polygon: { type: "Polygon", coordinates: [[]] },
    house_polygon: { type: "Polygon", coordinates: [[]] },
    garden_polygon: { type: "Polygon", coordinates: [[]] },
    lot_area_m2: 500,
    house_area_m2: 200,
    garden_area_m2: 300,
    measurements: [],
  });

  await store.upsertDesignCanvas(OWNER, projectId, {
    placements: [
      {
        id: randomUUID(),
        symbol_id: "hornbeam-pleached",
        x_pct: 28,
        y_pct: 62,
        rotation_deg: 0,
        scale: 1,
      },
      {
        id: randomUUID(),
        symbol_id: "lawn-turf",
        x_pct: 55,
        y_pct: 40,
        rotation_deg: 0,
        scale: 1,
      },
      {
        id: randomUUID(),
        symbol_id: "existing-tree-retain",
        x_pct: 70,
        y_pct: 30,
        rotation_deg: 0,
        scale: 1,
        label: "exist:dbh=0.45",
      },
    ],
    strokes: [],
    irrigation_zones: [
      {
        id: randomUUID(),
        name: "Front beds",
        kind: "drip",
        points: [
          { x_pct: 10, y_pct: 50 },
          { x_pct: 50, y_pct: 50 },
        ],
        emitter_spacing_cm: 40,
        emitter_flow_lph: 2,
      },
    ],
    construction_trenches: [
      {
        id: randomUUID(),
        name: "Rear drainage",
        kind: "drainage",
        depth_mm: 450,
        source: "traced",
        points: [
          { x_pct: 20, y_pct: 20 },
          { x_pct: 80, y_pct: 80 },
        ],
      },
    ],
    site_frame: {
      boundary: [
        { x_pct: 10, y_pct: 10 },
        { x_pct: 90, y_pct: 10 },
        { x_pct: 90, y_pct: 90 },
        { x_pct: 10, y_pct: 90 },
      ],
      building: [],
      easements: [],
      services: [],
      levels: [],
      drainage_runs: [],
      byda_assets: [],
      keyless_overlays: [],
      building_source: "traced",
    },
  });

  return projectId;
}

describe("GET /projects/:id/design/board-report", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>["app"];
  let store: Awaited<ReturnType<typeof buildTestApp>>["store"];

  afterEach(async () => {
    if (app) await app.close();
  });

  it("reads sustainability metrics off the saved board", async () => {
    ({ app, store } = await buildTestApp());
    const projectId = await seedBoard(store, app);

    const res = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design/board-report`,
    });

    expect(res.statusCode).toBe(200);
    const parsed = DesignBoardReportResponseSchema.safeParse(res.json());
    expect(parsed.success).toBe(true);
    const { sustainability } = parsed.data!;

    expect(sustainability.assessed).toBe(6);
    expect(sustainability.measured).toBeGreaterThan(0);
    // Canopy and irrigation are drawn on this board, so both are measurable.
    const canopy = sustainability.metrics.find((m) => m.id === "canopy-cover");
    expect(canopy!.status).not.toBe("absent");
    expect(canopy!.value).toBeGreaterThan(0);
    const water = sustainability.metrics.find((m) => m.id === "irrigation-demand");
    expect(water!.status).toBe("measured");
    expect(water!.model).toBeTruthy();
    // No spot levels were authored — reported absent, never as a flat site.
    const fall = sustainability.metrics.find((m) => m.id === "site-fall");
    expect(fall!.status).toBe("absent");
    expect(fall!.value).toBeNull();

    for (const m of sustainability.metrics) {
      expect(m.sites_credit.length).toBeGreaterThan(0);
      expect(m.sdg.length).toBeGreaterThan(0);
      expect(m.basis).toBeTruthy();
    }
  });

  it("prompts the notices this board's content implies", async () => {
    ({ app, store } = await buildTestApp());
    const projectId = await seedBoard(store, app);

    const res = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design/board-report`,
    });
    const { disclaimers } = DesignBoardReportResponseSchema.parse(res.json());
    const kinds = disclaimers.map((d) => d.kind);

    // Mature spread drawn, ground that gets dug, and a measured existing trunk.
    expect(kinds).toContain("maturity");
    expect(kinds).toContain("design_intent");
    expect(kinds).toContain("subsurface");
    expect(kinds).toContain("tpo");

    const subsurface = disclaimers.find((d) => d.kind === "subsurface")!;
    expect(subsurface.required).toBe(true);
    expect(subsurface.statement).toContain("No located asset has been recorded");

    for (const d of disclaimers) {
      expect(d.cites.length).toBeGreaterThan(0);
      expect(d.trigger.length).toBeGreaterThan(0);
      expect(d.basis).toBeTruthy();
    }
  });

  it("is deterministic across calls", async () => {
    ({ app, store } = await buildTestApp());
    const projectId = await seedBoard(store, app);

    const first = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design/board-report`,
    });
    const second = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design/board-report`,
    });
    expect(second.json()).toEqual(first.json());
  });

  it("names gaps and disclaims nothing on an empty board", async () => {
    ({ app, store } = await buildTestApp());
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "9 Bare Board St, Richmond VIC 3121" },
    });
    const projectId = (create.json() as { project: { id: string } }).project.id;

    const res = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design/board-report`,
    });

    expect(res.statusCode).toBe(200);
    const body = DesignBoardReportResponseSchema.parse(res.json());
    expect(body.disclaimers).toEqual([]);
    expect(body.sustainability.measured).toBe(0);
    expect(body.gaps).toContain("no planting placed");
  });

  it("404s for a project the caller does not own", async () => {
    ({ app } = await buildTestApp());
    const res = await app.inject({
      method: "GET",
      url: `/projects/${randomUUID()}/design/board-report`,
    });
    expect(res.statusCode).toBe(404);
  });
});
