import { describe, expect, it } from "vitest";
import {
  displaySizeForAerial,
  fitWorldToStage,
  groundSpanMetres,
  groundSpanMetresAtZoom,
  parseMapboxStaticAerial,
  percentToLngLat,
  projectLngLatToPercent,
  resolveStaticMapView,
  widerMapboxStaticAerial,
  zoomForWiderCoverage,
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

  it("parses confirm-pin URLs with a Mapbox pin overlay", () => {
    const uri =
      "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/pin-l+c45c26(145.00807,-37.85403)/145.00807,-37.85403,20,0/800x480@2x?access_token=x";
    const view = parseMapboxStaticAerial(uri);
    expect(view).toEqual({
      lng: 145.00807,
      lat: -37.85403,
      zoom: 20,
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

  it("each zoom level down doubles the covered ground span", () => {
    const view = { lng: 144.96, lat: -37.81, zoom: 19, width: 800, height: 480 };
    const base = groundSpanMetres(view);
    const wider = groundSpanMetresAtZoom(view, 18);
    expect(wider.widthM).toBeCloseTo(base.widthM * 2, 5);
    expect(wider.heightM).toBeCloseTo(base.heightM * 2, 5);
  });

  it("zoomForWiderCoverage steps down whole levels to cover the factor", () => {
    const view = { lng: 144.96, lat: -37.81, zoom: 19, width: 800, height: 480 };
    expect(zoomForWiderCoverage(view, 1)).toBe(19);
    expect(zoomForWiderCoverage(view, 2)).toBe(18);
    expect(zoomForWiderCoverage(view, 3)).toBe(17);
    expect(zoomForWiderCoverage(view, 8)).toBe(16);
    // Clamped to the site-context floor.
    expect(zoomForWiderCoverage(view, 1000)).toBe(14);
  });

  it("widerMapboxStaticAerial lowers zoom to cover the target span", () => {
    const uri =
      "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/144.96,-37.81,19,0/800x480@2x?access_token=secret";
    const view = parseMapboxStaticAerial(uri)!;
    const span = groundSpanMetres(view);
    // Target 3× the board (the 3× ground extent) — needs 2 whole levels down.
    const wider = widerMapboxStaticAerial(uri, {
      widthM: span.widthM * 3,
      heightM: span.heightM * 3,
    });
    expect(wider).toContain("144.96,-37.81,17,0/800x480@2x");
    expect(wider).toContain("access_token=secret");
    expect(wider).not.toContain(",19,0/");
  });

  it("widerMapboxStaticAerial preserves the confirm-lot pin overlay", () => {
    const uri =
      "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/pin-l+c45c26(145.00807,-37.85403)/145.00807,-37.85403,20,0/800x480@2x?access_token=secret";
    const view = parseMapboxStaticAerial(uri)!;
    const span = groundSpanMetres(view);
    const wider = widerMapboxStaticAerial(uri, {
      widthM: span.widthM * 3,
      heightM: span.heightM * 3,
    });
    expect(wider).toContain("pin-l+c45c26(145.00807,-37.85403)/");
    expect(wider).toContain("145.00807,-37.85403,18,0/800x480@2x");
    expect(wider).toContain("access_token=secret");
  });

  it("widerMapboxStaticAerial returns the URI unchanged when not a Mapbox URL", () => {
    const placeholder =
      "https://placeholder.aerial/satellite/-37.85,144.96?z=19&w=800&h=480";
    expect(
      widerMapboxStaticAerial(placeholder, { widthM: 1, heightM: 1 }),
    ).toBe(placeholder);
  });
});
