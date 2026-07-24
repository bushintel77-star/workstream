import { describe, expect, it, vi } from "vitest";
import { ingestStormwaterGeoJson } from "./stormwater-ingest";

describe("ingestStormwaterGeoJson", () => {
  it("projects LineString features into canvas metres", async () => {
    const store = {
      getProject: vi.fn(async () => ({
        id: "p1",
        lat: -37.85,
        lng: 145.01,
      })),
      getSiteBoundary: vi.fn(async () => ({
        geo_reference: {
          canvas_origin_geo: { lng: 145.01, lat: -37.85 },
        },
      })),
    };

    const result = await ingestStormwaterGeoJson(
      store as never,
      "owner",
      "p1",
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                [145.01, -37.85],
                [145.0105, -37.8505],
              ],
            },
          },
        ],
      },
    );

    expect(result.source).toBe("traced");
    expect(result.lines_canvas).toHaveLength(1);
    expect(result.lines_canvas[0]!.points.length).toBeGreaterThanOrEqual(2);
  });

  it("returns empty when no line geometries present", async () => {
    const store = {
      getProject: vi.fn(async () => ({
        id: "p1",
        lat: -37.85,
        lng: 145.01,
      })),
      getSiteBoundary: vi.fn(async () => null),
    };

    const result = await ingestStormwaterGeoJson(
      store as never,
      "owner",
      "p1",
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: [145.01, -37.85] },
          },
        ],
      },
    );
    expect(result.lines_canvas).toEqual([]);
  });
});
