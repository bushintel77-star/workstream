import { describe, expect, it } from "vitest";
import {
  groundSpanMetres,
  parseStaticAerial,
  percentToLngLat,
  projectLngLatToPercent,
  widerStaticAerial,
} from "./mapView";

const WMS = (bbox: string, w = 800, h = 480) =>
  `https://opendata.maps.vic.gov.au/geoserver/wms?service=WMS&version=1.3.0&request=GetMap&layers=open-data-platform%3Astateview_2024_sat_ortho_150cm&styles=&format=image%2Fpng&transparent=false&width=${w}&height=${h}&crs=EPSG%3A4326&bbox=${encodeURIComponent(bbox)}`;

describe("parseStaticAerial (StateView WMS)", () => {
  it("parses a WMS GetMap URI into its bbox view", () => {
    const view = parseStaticAerial(WMS("144.99,-37.84,145.01,-37.82"));
    expect(view).not.toBeNull();
    expect(view!.minLng).toBeCloseTo(144.99);
    expect(view!.maxLat).toBeCloseTo(-37.82);
    expect(view!.width).toBe(800);
    expect(view!.height).toBe(480);
  });

  it("returns null for non-WMS URIs (placeholder / retired Mapbox)", () => {
    expect(parseStaticAerial("https://placeholder.aerial/satellite/-37,145?z=19")).toBeNull();
    expect(
      parseStaticAerial("https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/145,-37,19,0/800x480"),
    ).toBeNull();
  });
});

describe("projection round-trip", () => {
  it("projects north-up and inverts exactly", () => {
    const view = parseStaticAerial(WMS("144.99,-37.84,145.01,-37.82"))!;
    const [x, y] = projectLngLatToPercent(145.0, -37.83, view);
    expect(x).toBeCloseTo(50, 6);
    expect(y).toBeCloseTo(50, 6);
    const [lng, lat] = percentToLngLat(x, y, view);
    expect(lng).toBeCloseTo(145.0, 9);
    expect(lat).toBeCloseTo(-37.83, 9);
  });

  it("north-up: the max latitude edge sits at the top (y=0)", () => {
    const view = parseStaticAerial(WMS("144.99,-37.84,145.01,-37.82"))!;
    expect(projectLngLatToPercent(145.0, -37.82, view)[1]).toBeCloseTo(0, 6);
    expect(projectLngLatToPercent(145.0, -37.84, view)[1]).toBeCloseTo(100, 6);
  });
});

describe("groundSpanMetres", () => {
  it("derives metre span from the bbox (no zoom math)", () => {
    const view = parseStaticAerial(WMS("144.99,-37.84,145.01,-37.82"))!;
    const span = groundSpanMetres(view);
    // 0.02° lng ≈ 1.76 km at lat -37.83; 0.02° lat ≈ 2.23 km.
    expect(span.widthM).toBeGreaterThan(1700);
    expect(span.widthM).toBeLessThan(1800);
    expect(span.heightM).toBeGreaterThan(2200);
    expect(span.heightM).toBeLessThan(2250);
  });
});

describe("widerStaticAerial", () => {
  it("widens the bbox to cover the target span", () => {
    const uri = WMS("144.99,-37.84,145.01,-37.82");
    const view = parseStaticAerial(uri)!;
    const span = groundSpanMetres(view);
    const wider = widerStaticAerial(uri, {
      widthM: span.widthM * 3,
      heightM: span.heightM * 3,
    });
    const wView = parseStaticAerial(wider)!;
    expect(wView.maxLng - wView.minLng).toBeGreaterThan(
      (view.maxLng - view.minLng) * 2.5,
    );
  });

  it("returns the URI unchanged when it is not a WMS ortho URI", () => {
    const placeholder = "https://placeholder.aerial/satellite/-37,145?z=19";
    expect(widerStaticAerial(placeholder, { widthM: 1, heightM: 1 })).toBe(
      placeholder,
    );
  });
});
