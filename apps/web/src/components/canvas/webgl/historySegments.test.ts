import { describe, expect, it } from "vitest";
import type { LandscapeFeature } from "@workstream/contracts";
import {
  SEGMENT_COLOR,
  SEGMENT_LABEL,
  activityAt,
  activityBetween,
  buildHistorySegments,
  type ActivitySegment,
  type HistorySnapshotSlice,
} from "./historySegments";

const EMPTY: HistorySnapshotSlice = {
  placements: [],
  strokes: [],
  photoElevations: [],
  features: [],
  constructionTrenches: [],
  irrigationZones: [],
  canvases: [],
  setbackLines: [],
  buildingFootprints: [],
};

const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id-${i}` }));

function feature(id: string, layer: LandscapeFeature["metadata"]["layer"]) {
  return { id, metadata: { layer } } as LandscapeFeature;
}

/** Apply n edits of one activity on top of a snapshot, returning each state. */
function run(
  from: HistorySnapshotSlice,
  activity: ActivitySegment,
  count: number,
): HistorySnapshotSlice[] {
  const out: HistorySnapshotSlice[] = [];
  let cur = from;
  for (let i = 0; i < count; i++) {
    switch (activity) {
      case "survey":
        cur = { ...cur, canvases: ids(cur.canvases.length + 1) };
        break;
      case "grading":
        cur = {
          ...cur,
          constructionTrenches: ids(cur.constructionTrenches.length + 1),
        };
        break;
      case "paving":
        cur = {
          ...cur,
          features: [
            ...cur.features,
            feature(`f-${cur.features.length}`, "hardscape"),
          ],
        };
        break;
      case "planting":
        cur = { ...cur, placements: ids(cur.placements.length + 1) };
        break;
      case "markup":
        cur = { ...cur, strokes: ids(cur.strokes.length + 1) };
        break;
    }
    out.push(cur);
  }
  return out;
}

describe("historySegments — Phase P", () => {
  describe("activityBetween", () => {
    it("names a survey edit", () => {
      expect(activityBetween(EMPTY, { ...EMPTY, canvases: ids(1) })).toBe("survey");
      expect(activityBetween(EMPTY, { ...EMPTY, setbackLines: ids(1) })).toBe("survey");
      expect(activityBetween(EMPTY, { ...EMPTY, buildingFootprints: ids(1) })).toBe(
        "survey",
      );
      expect(activityBetween(EMPTY, { ...EMPTY, photoElevations: ids(1) })).toBe(
        "survey",
      );
    });

    it("names a grading edit", () => {
      expect(
        activityBetween(EMPTY, { ...EMPTY, constructionTrenches: ids(1) }),
      ).toBe("grading");
      expect(activityBetween(EMPTY, { ...EMPTY, irrigationZones: ids(1) })).toBe(
        "grading",
      );
    });

    it("splits features by layer", () => {
      expect(
        activityBetween(EMPTY, { ...EMPTY, features: [feature("a", "hardscape")] }),
      ).toBe("paving");
      expect(
        activityBetween(EMPTY, { ...EMPTY, features: [feature("a", "structure")] }),
      ).toBe("paving");
      expect(
        activityBetween(EMPTY, {
          ...EMPTY,
          features: [feature("a", "softscape_beds")],
        }),
      ).toBe("planting");
    });

    it("names a planting edit", () => {
      expect(activityBetween(EMPTY, { ...EMPTY, placements: ids(1) })).toBe(
        "planting",
      );
    });

    it("falls back to markup", () => {
      expect(activityBetween(EMPTY, { ...EMPTY, strokes: ids(1) })).toBe("markup");
      expect(activityBetween(EMPTY, EMPTY)).toBe("markup");
    });

    it("reads a removal, not just an addition", () => {
      const withPaving = { ...EMPTY, features: [feature("a", "hardscape")] };
      expect(activityBetween(withPaving, EMPTY)).toBe("paving");
    });

    it("prefers the more specific slice when two change together", () => {
      const after = { ...EMPTY, constructionTrenches: ids(1), strokes: ids(1) };
      expect(activityBetween(EMPTY, after)).toBe("grading");
    });
  });

  describe("buildHistorySegments", () => {
    it("is empty for no steps", () => {
      expect(buildHistorySegments([])).toEqual([]);
    });

    it("merges a run of one activity into one band", () => {
      const steps = [EMPTY, ...run(EMPTY, "grading", 5)];
      const segs = buildHistorySegments(steps);
      expect(segs).toHaveLength(1);
      expect(segs[0]!.activity).toBe("grading");
      expect(segs[0]!.steps).toBe(6);
    });

    it("covers every step exactly once", () => {
      const a = run(EMPTY, "survey", 3);
      const b = run(a[a.length - 1]!, "planting", 4);
      const c = run(b[b.length - 1]!, "markup", 2);
      const steps = [EMPTY, ...a, ...b, ...c];
      const segs = buildHistorySegments(steps);
      expect(segs.reduce((n, s) => n + s.steps, 0)).toBe(steps.length);
      let expected = 0;
      for (const seg of segs) {
        expect(seg.startIdx).toBe(expected);
        expected += seg.steps;
      }
    });

    it("draws a band per activity change, in order", () => {
      const a = run(EMPTY, "survey", 2);
      const b = run(a[a.length - 1]!, "grading", 3);
      const c = run(b[b.length - 1]!, "planting", 1);
      const segs = buildHistorySegments([EMPTY, ...a, ...b, ...c]);
      expect(segs.map((s) => s.activity)).toEqual([
        "survey",
        "grading",
        "planting",
      ]);
      expect(segs.map((s) => s.steps)).toEqual([3, 3, 1]);
    });

    it("does not invent bands for activities that never happened", () => {
      const steps = [EMPTY, ...run(EMPTY, "planting", 4)];
      const activities = new Set(buildHistorySegments(steps).map((s) => s.activity));
      expect(activities.has("paving")).toBe(false);
      expect(activities.has("survey")).toBe(false);
    });

    it("band widths are proportional to real step counts", () => {
      const a = run(EMPTY, "grading", 9);
      const b = run(a[a.length - 1]!, "markup", 1);
      const segs = buildHistorySegments([EMPTY, ...a, ...b]);
      const total = segs.reduce((n, s) => n + s.steps, 0);
      const grading = segs.find((s) => s.activity === "grading")!;
      expect(grading.steps / total).toBeGreaterThan(0.8);
    });
  });

  describe("activityAt", () => {
    const segs = buildHistorySegments([
      EMPTY,
      ...run(EMPTY, "survey", 2),
      ...run({ ...EMPTY, canvases: ids(2) }, "planting", 2),
    ]);

    it("reports the activity covering an index", () => {
      expect(activityAt(segs, 0)).toBe("survey");
      expect(activityAt(segs, segs[0]!.steps)).toBe("planting");
    });

    it("returns null off the track", () => {
      expect(activityAt(segs, -1)).toBeNull();
      expect(activityAt(segs, 999)).toBeNull();
    });
  });

  describe("presentation tables", () => {
    it("every activity has a label and a colour token", () => {
      const all: ActivitySegment[] = [
        "survey",
        "grading",
        "paving",
        "planting",
        "markup",
      ];
      for (const a of all) {
        expect(SEGMENT_LABEL[a].length).toBeGreaterThan(0);
        expect(SEGMENT_COLOR[a]).toMatch(/^var\(--/);
      }
    });
  });
});
