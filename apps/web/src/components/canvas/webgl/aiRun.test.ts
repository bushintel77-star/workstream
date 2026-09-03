import { describe, expect, it } from "vitest";
import {
  IDLE_RUN,
  RUN_STAGES,
  buildRunInputs,
  startRun,
  updateStageProgress,
  completeRun,
  setScrubPosition,
  markStale,
  REFUSAL_UNSPECIFIED_BED,
  REFUSAL_NO_GEOMETRY_WRITE,
  INDICATIVE_STAMP,
} from "./aiRun";

describe("aiRun — Phase S", () => {
  describe("S.1 — no free-text input", () => {
    it("buildRunInputs states each input with its count, not a description", () => {
      const inputs = buildRunInputs({
        placementCount: 12,
        featureCount: 8,
        materialCount: 5,
        speciesCount: 3,
        sunTime: "14:00",
        growthYear: 10,
      });
      expect(inputs).toHaveLength(5);
      expect(inputs[0]).toEqual({ kind: "geometry", label: "Geometry", count: 20 });
      expect(inputs[1]).toEqual({ kind: "materials", label: "Materials", count: 5 });
      expect(inputs[2]).toEqual({ kind: "species", label: "Species", count: 3 });
      expect(inputs[3]).toEqual({ kind: "sun", label: "Sun 14:00", count: 1 });
      expect(inputs[4]).toEqual({ kind: "growthYear", label: "Growth year 10", count: 1 });
    });

    it("inputs are optional (sun/growthYear)", () => {
      const inputs = buildRunInputs({
        placementCount: 0,
        featureCount: 0,
        materialCount: 0,
        speciesCount: 0,
      });
      expect(inputs).toHaveLength(3);
      expect(inputs.every((i) => i.count === 0)).toBe(true);
    });
  });

  describe("S.3 — staged progress with real completion", () => {
    it("startRun creates all stages at 0 progress", () => {
      const state = startRun([]);
      expect(state.status).toBe("running");
      expect(state.stages).toHaveLength(RUN_STAGES.length);
      expect(state.stages.every((s) => s.progress === 0)).toBe(true);
    });

    it("updateStageProgress advances the stage", () => {
      const state = startRun([]);
      const updated = updateStageProgress(state, 0, 0.5, 1000);
      expect(updated.stages[0]!.progress).toBe(0.5);
      expect(updated.stages[0]!.elapsedMs).toBe(1000);
    });

    it("a stage with no progress for >5s is stalled", () => {
      const state = startRun([]);
      const stalled = updateStageProgress(state, 0, 0, 6000);
      expect(stalled.stages[0]!.stalled).toBe(true);
    });

    it("completeRun sets all stages to 1 and status to complete", () => {
      const state = startRun([]);
      const complete = completeRun(state);
      expect(complete.status).toBe("complete");
      expect(complete.stages.every((s) => s.progress === 1)).toBe(true);
      expect(complete.scrubPosition).toBe(1);
    });
  });

  describe("S.5 — scrub at 0 leaves ink untouched", () => {
    it("setScrubPosition sets the position", () => {
      const state = startRun([]);
      const scrubbed = setScrubPosition(state, 0);
      expect(scrubbed.scrubPosition).toBe(0);
    });

    it("scrub is clamped 0-1", () => {
      const state = startRun([]);
      expect(setScrubPosition(state, -0.5).scrubPosition).toBe(0);
      expect(setScrubPosition(state, 1.5).scrubPosition).toBe(1);
    });
  });

  describe("S.6 — refusal 1: unspecified bed renders empty", () => {
    it("REFUSAL_UNSPECIFIED_BED is a non-empty string", () => {
      expect(REFUSAL_UNSPECIFIED_BED.length).toBeGreaterThan(0);
    });
  });

  describe("S.7 — refusal 2: cannot write geometry", () => {
    it("REFUSAL_NO_GEOMETRY_WRITE is a non-empty string", () => {
      expect(REFUSAL_NO_GEOMETRY_WRITE.length).toBeGreaterThan(0);
    });
  });

  describe("S.8 — indicative stamp", () => {
    it("INDICATIVE_STAMP is a non-empty string", () => {
      expect(INDICATIVE_STAMP).toContain("indicative");
      expect(INDICATIVE_STAMP).toContain("not a construction document");
    });
  });

  describe("S.9 — stale marking", () => {
    it("markStale sets stale=true with a reason", () => {
      const state = completeRun(startRun([]));
      const stale = markStale(state, "Bed B-03 was edited");
      expect(stale.stale).toBe(true);
      expect(stale.staleReason).toBe("Bed B-03 was edited");
    });
  });

  describe("IDLE_RUN", () => {
    it("starts idle with no stages", () => {
      expect(IDLE_RUN.status).toBe("idle");
      expect(IDLE_RUN.stages).toEqual([]);
      expect(IDLE_RUN.scrubPosition).toBe(0);
    });
  });
});
