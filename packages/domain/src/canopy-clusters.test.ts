import { describe, expect, it } from "vitest";
import { detectCanopyClustersFromImageData } from "./canopy-clusters";

function solidImage(
  w: number,
  h: number,
  rgba: [number, number, number, number],
): { width: number; height: number; data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = rgba[0];
    data[i * 4 + 1] = rgba[1];
    data[i * 4 + 2] = rgba[2];
    data[i * 4 + 3] = rgba[3];
  }
  return { width: w, height: h, data };
}

describe("detectCanopyClustersFromImageData", () => {
  it("returns empty for non-green imagery", () => {
    const img = solidImage(48, 48, [180, 120, 100, 255]);
    expect(detectCanopyClustersFromImageData(img)).toEqual([]);
  });

  it("detects a green canopy cluster", () => {
    const img = solidImage(48, 48, [40, 40, 40, 255]);
    // Paint a green block in the upper-left quarter
    for (let y = 2; y < 18; y++) {
      for (let x = 2; x < 18; x++) {
        const i = (y * 48 + x) * 4;
        img.data[i] = 40;
        img.data[i + 1] = 140;
        img.data[i + 2] = 50;
      }
    }
    const ghosts = detectCanopyClustersFromImageData(img, { gridSize: 12 });
    expect(ghosts.length).toBeGreaterThanOrEqual(1);
    expect(ghosts[0]!.symbol_id).toBe("existing-tree-retain");
    expect(ghosts[0]!.reason).toMatch(/canopy/i);
    expect(ghosts[0]!.x_pct).toBeLessThan(50);
    expect(ghosts[0]!.y_pct).toBeLessThan(50);
  });
});
