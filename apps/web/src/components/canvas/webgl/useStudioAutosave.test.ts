import { describe, expect, it } from "vitest";
import { buildPersistKey, type StudioAutosaveDoc } from "./useStudioAutosave";

/**
 * Tests for the autosave content fingerprint. The fingerprint is the dirty-
 * tracking key — if it doesn't change when a meaningful field changes, the
 * save won't fire and operator work is lost.
 */
describe("buildPersistKey", () => {
  const baseStroke = {
    id: "stroke-1",
    points: [{ x_pct: 10, y_pct: 20 }, { x_pct: 30, y_pct: 40 }],
    color: "#ff2ef6",
    width_px: 2.5,
  };

  it("is stable when nothing changes", () => {
    const doc: StudioAutosaveDoc = { placements: [], strokes: [baseStroke] };
    expect(buildPersistKey(doc)).toBe(buildPersistKey(doc));
  });

  it("changes when a stroke's extrude_height_m changes", () => {
    const without: StudioAutosaveDoc = {
      placements: [],
      strokes: [baseStroke],
    };
    const withExtrude: StudioAutosaveDoc = {
      placements: [],
      strokes: [{ ...baseStroke, extrude_height_m: 1.5 }],
    };
    const tallerExtrude: StudioAutosaveDoc = {
      placements: [],
      strokes: [{ ...baseStroke, extrude_height_m: 2.5 }],
    };
    // All three must be distinct — otherwise extrude commits won't persist.
    const a = buildPersistKey(without);
    const b = buildPersistKey(withExtrude);
    const c = buildPersistKey(tallerExtrude);
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });

  it("changes when a stroke's point array changes", () => {
    const original: StudioAutosaveDoc = {
      placements: [],
      strokes: [baseStroke],
    };
    const moved: StudioAutosaveDoc = {
      placements: [],
      strokes: [
        { ...baseStroke, points: [{ x_pct: 11, y_pct: 20 }, { x_pct: 30, y_pct: 40 }] },
      ],
    };
    expect(buildPersistKey(original)).not.toBe(buildPersistKey(moved));
  });

  it("ignores sub-decimal point jitter (rounds to 1 decimal)", () => {
    // 10.01 and 10.04 both round to 10.0 → no spurious save.
    const a: StudioAutosaveDoc = {
      placements: [],
      strokes: [{ ...baseStroke, points: [{ x_pct: 10.01, y_pct: 20 }, { x_pct: 30, y_pct: 40 }] }],
    };
    const b: StudioAutosaveDoc = {
      placements: [],
      strokes: [{ ...baseStroke, points: [{ x_pct: 10.04, y_pct: 20 }, { x_pct: 30, y_pct: 40 }] }],
    };
    expect(buildPersistKey(a)).toBe(buildPersistKey(b));
  });

  it("changes when stroke count changes", () => {
    const one: StudioAutosaveDoc = { placements: [], strokes: [baseStroke] };
    const two: StudioAutosaveDoc = {
      placements: [],
      strokes: [baseStroke, { ...baseStroke, id: "stroke-2" }],
    };
    expect(buildPersistKey(one)).not.toBe(buildPersistKey(two));
  });
});
