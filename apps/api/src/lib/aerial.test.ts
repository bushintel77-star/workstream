import { describe, expect, it } from "vitest";
import { aerialImageUrl, aerialImageUrlForRing } from "./aerial";

describe("aerialImageUrlForRing (StateView ortho WMS)", () => {
  it("builds a keyless WMS GetMap fitted to the title bbox", () => {
    const uri = aerialImageUrlForRing([
      [145.0186, -37.8495],
      [145.0192, -37.8495],
      [145.0192, -37.8499],
      [145.0186, -37.8499],
      [145.0186, -37.8495],
    ]);

    expect(uri).not.toBeNull();
    expect(uri).toContain("opendata.maps.vic.gov.au/geoserver/wms");
    expect(uri).toContain("request=GetMap");
    expect(uri).toContain("layers=open-data-platform%3Astateview_2024_sat_ortho_150cm");
    expect(uri).toContain("crs=EPSG%3A4326");
    // Bbox must cover the ring with margin.
    const bbox = decodeURIComponent(uri!.split("bbox=")[1]?.split("&")[0] ?? "");
    const [minLng, minLat, maxLng, maxLat] = bbox.split(",").map(Number);
    expect(minLng).toBeLessThan(145.0186);
    expect(maxLng).toBeGreaterThan(145.0192);
    expect(minLat).toBeLessThan(-37.8499);
    expect(maxLat).toBeGreaterThan(-37.8495);
  });

  it("returns null for an unusable title ring", () => {
    expect(aerialImageUrlForRing([])).toBeNull();
  });
});

describe("aerialImageUrl (point-centred WMS)", () => {
  it("builds a point-centred GetMap with zoom semantics", () => {
    const near = aerialImageUrl(-37.8497, 145.0189, 800, 480, 20);
    const far = aerialImageUrl(-37.8497, 145.0189, 800, 480, 17);

    expect(near).toContain("request=GetMap");
    const nearBbox = decodeURIComponent(near.split("bbox=")[1]?.split("&")[0] ?? "");
    const farBbox = decodeURIComponent(far.split("bbox=")[1]?.split("&")[0] ?? "");
    const nearSpan = nearBbox.split(",").map(Number);
    const farSpan = farBbox.split(",").map(Number);
    // zoom 20 (lot) must be tighter than zoom 17 (neighbourhood).
    expect(nearSpan[2] - nearSpan[0]).toBeLessThan(farSpan[2] - farSpan[0]);
  });
});
