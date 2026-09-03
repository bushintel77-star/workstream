import { describe, expect, it } from "vitest";
import {
  serializeStroke,
  captureSourceInk,
  verifyByteIdentical,
  revertPromotion,
  registerSourceInk,
  unregisterSourceInk,
  getSourceInk,
  type SourceInkRegistry,
} from "./promotionRevert";
import type { StrokePoint, PromotedObject } from "./strokePromotion";

function makeStroke(): StrokePoint[] {
  return [
    { x: 10, y: 10, pressure: 0.5 },
    { x: 20, y: 10, pressure: 0.7 },
    { x: 20, y: 20, pressure: 0.8 },
    { x: 10, y: 20, pressure: 0.6 },
    { x: 10, y: 10, pressure: 0.5 },
  ];
}

function makePromotedObject(id: string, sourceStrokeId: string): PromotedObject {
  return {
    id,
    name: "Planting bed",
    vertices: [
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 20, y: 20 },
      { x: 10, y: 20 },
    ],
    plane: "GRD",
    sourceStrokeId,
    areaM2: 9,
    perimeterM: 12,
  };
}

describe("promotionRevert — Phase M.10", () => {
  describe("serializeStroke", () => {
    it("produces a stable JSON string", () => {
      const s1 = serializeStroke(makeStroke());
      const s2 = serializeStroke(makeStroke());
      expect(s1).toBe(s2);
    });

    it("normalizes floating point to 6 decimals", () => {
      const a = serializeStroke([{ x: 10.123456789, y: 20 }]);
      const b = serializeStroke([{ x: 10.123457, y: 20 }]);
      expect(a).toBe(b);
    });

    it("excludes undefined pressure", () => {
      const withPressure = serializeStroke([{ x: 0, y: 0, pressure: 0.5 }]);
      const withoutPressure = serializeStroke([{ x: 0, y: 0 }]);
      expect(withPressure).not.toBe(withoutPressure);
    });
  });

  describe("captureSourceInk", () => {
    it("captures the stroke points and serialized form", () => {
      const stroke = makeStroke();
      const snapshot = captureSourceInk("stroke-1", stroke, "obj-1");
      expect(snapshot.strokeId).toBe("stroke-1");
      expect(snapshot.promotedObjectId).toBe("obj-1");
      expect(snapshot.points).toEqual(stroke);
      expect(snapshot.serialized).toBe(serializeStroke(stroke));
    });

    it("stores a copy of the points (not a reference)", () => {
      const stroke = makeStroke();
      const snapshot = captureSourceInk("stroke-1", stroke, "obj-1");
      // Mutate the original
      stroke[0]!.x = 999;
      // Snapshot should be unaffected
      expect(snapshot.points[0]!.x).toBe(10);
    });
  });

  describe("verifyByteIdentical", () => {
    it("returns true for identical strokes", () => {
      const stroke = makeStroke();
      const snapshot = captureSourceInk("stroke-1", stroke, "obj-1");
      expect(verifyByteIdentical(snapshot, makeStroke())).toBe(true);
    });

    it("returns false for modified strokes", () => {
      const stroke = makeStroke();
      const snapshot = captureSourceInk("stroke-1", stroke, "obj-1");
      const modified = makeStroke();
      modified[0]!.x = 999;
      expect(verifyByteIdentical(snapshot, modified)).toBe(false);
    });

    it("returns false for different length strokes", () => {
      const stroke = makeStroke();
      const snapshot = captureSourceInk("stroke-1", stroke, "obj-1");
      const shorter = makeStroke().slice(0, 3);
      expect(verifyByteIdentical(snapshot, shorter)).toBe(false);
    });
  });

  describe("revertPromotion", () => {
    it("returns the restored stroke and removed object id", () => {
      const stroke = makeStroke();
      const snapshot = captureSourceInk("stroke-1", stroke, "obj-1");
      const obj = makePromotedObject("obj-1", "stroke-1");
      const result = revertPromotion(snapshot, obj);
      expect(result.strokeId).toBe("stroke-1");
      expect(result.removedObjectId).toBe("obj-1");
      expect(result.points).toEqual(stroke);
    });

    it("throws on id mismatch", () => {
      const stroke = makeStroke();
      const snapshot = captureSourceInk("stroke-1", stroke, "obj-1");
      const wrongObj = makePromotedObject("obj-2", "stroke-1");
      expect(() => revertPromotion(snapshot, wrongObj)).toThrow();
    });

    it("restored points are byte-identical to original", () => {
      const stroke = makeStroke();
      const snapshot = captureSourceInk("stroke-1", stroke, "obj-1");
      const obj = makePromotedObject("obj-1", "stroke-1");
      const result = revertPromotion(snapshot, obj);
      expect(serializeStroke(result.points)).toBe(snapshot.serialized);
    });
  });

  describe("registry", () => {
    it("registers and retrieves snapshots", () => {
      const registry: SourceInkRegistry = new Map();
      const snapshot = captureSourceInk("stroke-1", makeStroke(), "obj-1");
      const next = registerSourceInk(registry, snapshot);
      expect(getSourceInk(next, "obj-1")).toBe(snapshot);
    });

    it("unregisters snapshots", () => {
      const registry: SourceInkRegistry = new Map();
      const snapshot = captureSourceInk("stroke-1", makeStroke(), "obj-1");
      const withSnapshot = registerSourceInk(registry, snapshot);
      const withoutSnapshot = unregisterSourceInk(withSnapshot, "obj-1");
      expect(getSourceInk(withoutSnapshot, "obj-1")).toBeUndefined();
    });

    it("does not mutate the original registry", () => {
      const registry: SourceInkRegistry = new Map();
      const snapshot = captureSourceInk("stroke-1", makeStroke(), "obj-1");
      registerSourceInk(registry, snapshot);
      expect(registry.size).toBe(0);
    });
  });
});
