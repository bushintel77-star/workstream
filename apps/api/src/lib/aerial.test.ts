import { describe, expect, it } from "vitest";
import { aerialImageUrl, aerialImageUrlForRing, stateViewAerialImageUrlForRing } from "./aerial";

describe("aerialImageUrlForRing (Esri World Imagery export)", () => {
  it("builds a keyless Esri export fitted to the title bbox", () => {
    const uri = aerialImageUrlForRing([
      [145.0186, -37.8495],
      [145.0192, -37.8495],
      [145.0192, -37.8499],
      [145.0186, -37.8499],
      [145.0186, -37.8495],
    ]);

    expect(uri).not.toBeNull();
    expect(uri).toContain("services.arcgisonline.com");
    expect(uri).toContain("World_Imagery/MapServer/export");
    expect(uri).toContain("f=image");
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

describe("aerialImageUrl (point-centred Esri export)", () => {
  it("zoom 20 (lot) is tighter than zoom 17 (neighbourhood)", () => {
    const near = aerialImageUrl(-37.8497, 145.0189, 800, 480, 20);
    const far = aerialImageUrl(-37.8497, 145.0189, 800, 480, 17);
    const nearSpan = decodeURIComponent(near.split("bbox=")[1].split("&")[0]).split(",").map(Number);
    const farSpan = decodeURIComponent(far.split("bbox=")[1].split("&")[0]).split(",").map(Number);
    expect(nearSpan[2] - nearSpan[0]).toBeLessThan(farSpan[2] - farSpan[0]);
  });
});

describe("stateViewAerialImageUrlForRing (Victorian fallback)", () => {
  it("builds the keyless StateView WMS GetMap", () => {
    const uri = stateViewAerialImageUrlForRing([
      [145.0186, -37.8495],
      [145.0192, -37.8495],
      [145.0192, -37.8499],
      [145.0186, -37.8499],
      [145.0186, -37.8495],
    ]);
    expect(uri).toContain("opendata.maps.vic.gov.au/geoserver/wms");
    expect(uri).toContain("stateview_2024_sat_ortho_150cm");
    expect(uri).toContain("request=GetMap");
  });
});
