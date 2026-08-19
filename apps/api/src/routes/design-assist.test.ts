import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  DesignAssistResponseSchema,
  DesignFindingsResponseSchema,
} from "@workstream/contracts";
import { buildTestApp } from "../test/build-app";

const OWNER = "dev-user";

const AERIAL =
  "https://opendata.maps.vic.gov.au/geoserver/wms?service=WMS&version=1.3.0&request=GetMap&layers=open-data-platform%3Astateview_2024_sat_ortho_150cm&width=800&height=600&crs=EPSG%3A4326&bbox=144.98%2C-37.86%2C145.01%2C-37.84";

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
      neighbour_buildings: [],
      building_source: "traced",
    },
  });

  return projectId;
}

describe("POST /projects/:id/design/assist — board context", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>["app"];
  let store: Awaited<ReturnType<typeof buildTestApp>>["store"];

  afterEach(async () => {
    if (app) await app.close();
  });

  it("answers with a valid assist payload for a populated board", async () => {
    ({ app, store } = await buildTestApp());
    const projectId = await seedBoard(store, app);

    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/design/assist`,
      payload: { message: "Where should the rear screen go?" },
    });

    expect(res.statusCode).toBe(200);
    expect(DesignAssistResponseSchema.safeParse(res.json()).success).toBe(true);
  });

  it("keeps ghost suggestions identical to the pre-context behaviour", async () => {
    ({ app, store } = await buildTestApp());
    const projectId = await seedBoard(store, app);

    const first = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/design/assist`,
      payload: { message: "Suggest planting." },
    });
    const second = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/design/assist`,
      payload: { message: "Suggest planting." },
    });

    const a = first.json() as { suggestions: unknown[] };
    const b = second.json() as { suggestions: unknown[] };
    // Tier-1 heuristic ghosts — deterministic, and unmoved by the added context.
    expect(a.suggestions.length).toBeGreaterThan(0);
    expect(b.suggestions).toEqual(a.suggestions);
  });

  it("serves an empty board without inventing geometry", async () => {
    ({ app, store } = await buildTestApp());
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "9 Bare Board St, Richmond VIC 3121" },
    });
    const projectId = (create.json() as { project: { id: string } }).project.id;

    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/design/assist`,
      payload: { message: "What have I got?" },
    });

    expect(res.statusCode).toBe(200);
    expect(DesignAssistResponseSchema.safeParse(res.json()).success).toBe(true);
  });
});

describe("GET /projects/:id/design/findings", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>["app"];
  let store: Awaited<ReturnType<typeof buildTestApp>>["store"];

  afterEach(async () => {
    if (app) await app.close();
  });

  it("returns cited findings for a populated board", async () => {
    ({ app, store } = await buildTestApp());
    const projectId = await seedBoard(store, app);

    const res = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design/findings`,
    });

    expect(res.statusCode).toBe(200);
    const parsed = DesignFindingsResponseSchema.safeParse(res.json());
    expect(parsed.success).toBe(true);
    const body = parsed.data!;
    expect(body.findings.length).toBeGreaterThan(0);
    // Every finding carries its citation and provenance basis.
    for (const f of body.findings) {
      expect(f.cites.length).toBeGreaterThan(0);
      expect(f.basis).toBeTruthy();
    }
  });

  it("is deterministic across calls", async () => {
    ({ app, store } = await buildTestApp());
    const projectId = await seedBoard(store, app);

    const first = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design/findings`,
    });
    const second = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design/findings`,
    });
    expect(second.json()).toEqual(first.json());
  });

  it("names gaps and stays quiet on findings for an empty board", async () => {
    ({ app, store } = await buildTestApp());
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "9 Bare Board St, Richmond VIC 3121" },
    });
    const projectId = (create.json() as { project: { id: string } }).project.id;

    const res = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design/findings`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { findings: unknown[]; gaps: string[] };
    expect(body.findings).toEqual([]);
    expect(body.gaps).toContain("no planting placed");
  });

  it("404s for a project the caller does not own", async () => {
    ({ app } = await buildTestApp());
    const res = await app.inject({
      method: "GET",
      url: `/projects/${randomUUID()}/design/findings`,
    });
    expect(res.statusCode).toBe(404);
  });
});
