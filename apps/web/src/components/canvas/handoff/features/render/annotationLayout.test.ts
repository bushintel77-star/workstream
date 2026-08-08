import { describe, expect, it } from "vitest";
import { clampNotePos, defaultNotePos } from "./annotationLayout";

describe("annotationLayout", () => {
  const box = [
    { x: 20, y: 20 },
    { x: 80, y: 20 },
    { x: 80, y: 80 },
    { x: 20, y: 80 },
  ];

  it("pushes notes outside the title boundary + pad", () => {
    const p = clampNotePos({ x: 50, y: 50 }, box);
    expect(p.x < 16 || p.x > 84 || p.y < 16 || p.y > 84).toBe(true);
  });

  it("keeps already-marginal notes", () => {
    const p = clampNotePos({ x: 8, y: 12 }, box);
    expect(p).toEqual({ x: 8, y: 12 });
  });

  it("defaults near the anchor", () => {
    const p = defaultNotePos(40, 50, box);
    expect(p.x).toBeGreaterThanOrEqual(4);
    expect(p.y).toBeGreaterThanOrEqual(4);
  });
});
