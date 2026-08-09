import { describe, expect, it } from "vitest";
import { recognizeStroke } from "./stroke-recognize";

describe("recognizeStroke", () => {
  it("classifies closed loop as bed", () => {
    const r = recognizeStroke({
      id: "00000000-0000-4000-8000-000000000001",
      points: [
        { x_pct: 10, y_pct: 10 },
        { x_pct: 30, y_pct: 10 },
        { x_pct: 30, y_pct: 30 },
        { x_pct: 10, y_pct: 30 },
        { x_pct: 11, y_pct: 11 },
      ],
      color: "#ff2ef6",
      width_px: 2,
    });
    expect(r?.kind).toBe("bed");
  });

  it("classifies thin straight as ditch", () => {
    const r = recognizeStroke({
      id: "00000000-0000-4000-8000-000000000002",
      points: [
        { x_pct: 10, y_pct: 50 },
        { x_pct: 20, y_pct: 50.2 },
        { x_pct: 40, y_pct: 50 },
      ],
      color: "#ff2ef6",
      width_px: 2,
    });
    expect(r?.kind).toBe("ditch");
  });

  it("classifies thick short as wall", () => {
    const r = recognizeStroke({
      id: "00000000-0000-4000-8000-000000000003",
      points: [
        { x_pct: 20, y_pct: 20 },
        { x_pct: 28, y_pct: 20.1 },
      ],
      color: "#ff2ef6",
      width_px: 5,
    });
    expect(r?.kind).toBe("wall");
  });
});
