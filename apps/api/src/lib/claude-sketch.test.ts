import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formalizeSketchToCad } from "./claude";

/**
 * Regression: the heuristic formalize path must not be emptied by the
 * catalog allow-filter. The stroke classifier speaks the abstract studio
 * vocabulary (hedge/deck/lawn/canopy/…) which is not in the catalog id list.
 */
describe("formalizeSketchToCad (no vision key)", () => {
  let savedKey: string | undefined;

  beforeEach(() => {
    savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (savedKey != null) process.env.ANTHROPIC_API_KEY = savedKey;
  });

  it("returns heuristic suggestions even when symbol_ids has no abstract ids", async () => {
    const boundary = [
      { x: 20, y: 20 },
      { x: 80, y: 20 },
      { x: 80, y: 80 },
      { x: 20, y: 80 },
    ];
    const building = [
      { x: 35, y: 30 },
      { x: 65, y: 30 },
      { x: 65, y: 50 },
      { x: 35, y: 50 },
    ];
    const res = await formalizeSketchToCad({
      image_base64: "x", // < 32 chars → skips vision, exercises heuristic
      mime_type: "image/png",
      boundary,
      building,
      strokes: [
        {
          id: "deck",
          points: [
            { x: 40, y: 55 },
            { x: 60, y: 55 },
            { x: 60, y: 72 },
            { x: 40, y: 72 },
            { x: 41, y: 56 },
          ],
        },
        {
          id: "hedge",
          points: Array.from({ length: 12 }, (_, i) => ({
            x: 22 + i * 0.2,
            y: 25 + i * 4,
          })),
        },
      ],
      // Realistic catalog id list — deliberately excludes hedge/deck/etc.
      symbol_ids: ["lawn-turf", "timber-deck", "hedge-clip-formal"],
    });

    expect(res.source).toBe("heuristic");
    expect(res.suggestions.length).toBe(2);
    expect(res.suggestions.map((s) => s.symbol_id).sort()).toEqual([
      "deck",
      "hedge",
    ]);
  });
});
