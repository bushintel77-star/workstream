import { describe, expect, it, vi } from "vitest";
import {
  buildHeroAerialUrl,
  buildHeroAerialUrlFor,
  HERO_IMAGE_H,
  HERO_IMAGE_W,
  HERO_PIN,
  heroBbox,
  heroBboxFor,
  heroPinLabel,
  loadHeroBoundary,
  pctToImagePx,
  projectLngLatToPct,
  ringCentroidPct,
} from "./landingGeo";

describe("heroBbox / aerial URL", () => {
  it("centres the pin and keeps the 2000x1200 aspect in metres", () => {
    const b = heroBbox();
    // Centre of the bbox is the pin.
    expect((b.west + b.east) / 2).toBeCloseTo(HERO_PIN.lng, 9);
    expect((b.south + b.north) / 2).toBeCloseTo(HERO_PIN.lat, 9);
    // Aspect at the hero latitude: lng-span * cos(lat) vs lat-span must
    // match 2000:1200 (5:3) so the export is never stretched.
    const mPerDegLng = 111_320 * Math.cos((HERO_PIN.lat * Math.PI) / 180);
    const widthM = (b.east - b.west) * mPerDegLng;
    const heightM = (b.north - b.south) * 111_320;
    expect(widthM / heightM).toBeCloseTo(2000 / 1200, 2);
    // Block scale — wide enough for shadowed neighbours, tight enough that
    // a ~2,100 m² estate lot reads clearly.
    expect(widthM).toBeGreaterThan(350);
    expect(widthM).toBeLessThan(600);
  });

  it("builds a valid Esri export URL", () => {
    const url = buildHeroAerialUrl();
    expect(url).toContain("services.arcgisonline.com");
    expect(url).toContain("/World_Imagery/MapServer/export");
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("size")).toBe("2000,1200");
    expect(params.get("format")).toBe("png32");
    expect(params.get("f")).toBe("image");
    expect(params.get("imageSR")).toBe("4326");
    const [w, s, e, n] = params.get("bbox")!.split(",").map(Number);
    expect(w).toBeLessThan(e);
    expect(s).toBeLessThan(n);
  });

  it("re-centres the frame on any pin", () => {
    const pin = { lat: -37.822, lng: 145.0 };
    const b = heroBboxFor(pin);
    expect((b.west + b.east) / 2).toBeCloseTo(pin.lng, 9);
    expect((b.south + b.north) / 2).toBeCloseTo(pin.lat, 9);
    // Same block span regardless of the pin.
    expect(b.east - b.west).toBeCloseTo(heroBbox().east - heroBbox().west, 12);
    expect(b.north - b.south).toBeCloseTo(heroBbox().north - heroBbox().south, 12);

    const params = new URLSearchParams(buildHeroAerialUrlFor(pin).split("?")[1]);
    const [w, s, e, n] = params.get("bbox")!.split(",").map(Number);
    expect(w).toBeCloseTo(b.west, 10);
    expect(s).toBeCloseTo(b.south, 10);
    expect(e).toBeCloseTo(b.east, 10);
    expect(n).toBeCloseTo(b.north, 10);
  });
});

describe("projection", () => {
  const bbox = heroBbox();

  it("projects pin to the frame centre", () => {
    const [x, y] = projectLngLatToPct(HERO_PIN.lng, HERO_PIN.lat, bbox);
    expect(x).toBeCloseTo(50, 6);
    expect(y).toBeCloseTo(50, 6);
  });

  it("is linear and monotonic", () => {
    const west = projectLngLatToPct(bbox.west, bbox.north, bbox);
    const east = projectLngLatToPct(bbox.east, bbox.south, bbox);
    expect(west).toEqual([0, 0]);
    expect(east).toEqual([100, 100]);
  });

  it("maps percent to image pixels", () => {
    expect(pctToImagePx(0, 0)).toEqual([0, 0]);
    expect(pctToImagePx(100, 100)).toEqual([HERO_IMAGE_W, HERO_IMAGE_H]);
    expect(pctToImagePx(50, 50)).toEqual([1000, 600]);
  });

  it("centroid averages the ring", () => {
    expect(ringCentroidPct([[0, 0], [10, 0], [10, 10], [0, 10]])).toEqual([
      5, 5,
    ]);
    expect(ringCentroidPct([])).toEqual([50, 50]);
  });
});

describe("loadHeroBoundary", () => {
  const ok = (body: unknown) =>
    ({ ok: true, json: async () => body }) as Response;

  it("projects a live feed into image pixels", async () => {
    const bbox = heroBbox();
    const fetchImpl = vi.fn(async () =>
      ok({
        polygon: {
          coordinates: [
            [
              [bbox.west + 0.0001, bbox.north - 0.0001],
              [bbox.east - 0.0001, bbox.north - 0.0001],
              [bbox.east - 0.0001, bbox.south + 0.0001],
              [bbox.west + 0.0001, bbox.south + 0.0001],
              [bbox.west + 0.0001, bbox.north - 0.0001],
            ],
          ],
        },
        building: null,
      }),
    );
    const out = await loadHeroBoundary(HERO_PIN, fetchImpl);
    expect(out).not.toBeNull();
    expect(out!.polygon).toHaveLength(5);
    const [x0, y0] = out!.polygon[0]!;
    expect(x0).toBeGreaterThan(0);
    expect(x0).toBeLessThan(HERO_IMAGE_W);
    expect(y0).toBeGreaterThan(0);
    expect(y0).toBeLessThan(HERO_IMAGE_H);
    expect(out!.building).toBeNull();
  });

  it("returns null when the feed is empty or fails", async () => {
    expect(
      await loadHeroBoundary(HERO_PIN, vi.fn(async () => ok({ polygon: null }))),
    ).toBeNull();
    expect(
      await loadHeroBoundary(
        HERO_PIN,
        vi.fn(async () => ({ ok: false, json: async () => ({}) }) as Response),
      ),
    ).toBeNull();
    expect(
      await loadHeroBoundary(HERO_PIN, vi.fn(async () => { throw new Error("down"); })),
    ).toBeNull();
  });
});

describe("heroPinLabel", () => {
  it("formats the Toorak pin as a DMS coordinate", () => {
    const label = heroPinLabel();
    expect(label).toMatch(/37°50′\d+(?:\.\d+)?″S/);
    expect(label).toMatch(/145°1′\d+(?:\.\d+)?″E/);
  });
});
