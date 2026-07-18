import { describe, expect, it } from "vitest";
import {
  displaySizeForAerial,
  fitWorldToStage,
  parseMapboxStaticAerial,
  percentToLngLat,
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

  it("round-trips percent ↔ lng/lat at image centre", () => {
    const view = {
      lng: 144.9631,
      lat: -37.8136,
      zoom: 19,
      width: 800,
      height: 480,
    };
    const [lng, lat] = percentToLngLat(50, 50, view);
    expect(lng).toBeCloseTo(144.9631, 4);
    expect(lat).toBeCloseTo(-37.8136, 4);
  });

  it("fits world into stage with padding", () => {
    // width limit (1000-100)/800 = 1.125; height (800-100)/480 ≈ 1.458 → min 1.125
    const fit = fitWorldToStage(1000, 800, 800, 480, 50);
    expect(fit.scale).toBeCloseTo(900 / 800, 5);
    expect(fit.tx).toBeCloseTo((1000 - 800 * fit.scale) / 2, 5);
    expect(fit.ty).toBeCloseTo((800 - 480 * fit.scale) / 2, 5);
  });

  it("parses Mapbox @2x static URLs", () => {
    const uri =
      "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/144.96,-37.81,19,0/800x480@2x?access_token=x";
    const view = parseMapboxStaticAerial(uri);
    expect(view).toEqual({
      lng: 144.96,
      lat: -37.81,
      zoom: 19,
      width: 800,
      height: 480,
    });
  });

  it("preserves aerial aspect in display size", () => {
    const landscape = displaySizeForAerial(1600, 960, 960);
    expect(landscape.width).toBe(960);
    expect(landscape.height).toBe(576);
    const portrait = displaySizeForAerial(480, 800, 960);
    expect(portrait.height).toBe(960);
    expect(portrait.width).toBe(576);
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
