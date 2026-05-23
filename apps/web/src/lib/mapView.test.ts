import { describe, expect, it } from "vitest";
import {
  parseMapboxStaticAerial,
  projectLngLatToPercent,
  resolveStaticMapView,
} from "./mapView";

describe("mapView", () => {
  it("projects image centre to ~50%,50%", () => {
    const uri =
      "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/144.9631,-37.8136,19,0/800x480?access_token=x";
    const view = parseMapboxStaticAerial(uri);
    expect(view).not.toBeNull();
    const [xPct, yPct] = projectLngLatToPercent(144.9631, -37.8136, view!);
    expect(xPct).toBeCloseTo(50, 0);
    expect(yPct).toBeCloseTo(50, 0);
  });

  it("resolveStaticMapView falls back to lot centroid", () => {
    const ring: [number, number][] = [
      [144.96, -37.81],
      [144.97, -37.81],
      [144.97, -37.82],
      [144.96, -37.82],
      [144.96, -37.81],
    ];
    const view = resolveStaticMapView("", ring);
    expect(view.lng).toBeCloseTo(144.965, 2);
    expect(view.lat).toBeCloseTo(-37.815, 2);
  });
});
