import { describe, expect, it } from "vitest";
import { estimateStudioDrawing } from "./studio-preemptive-estimate";

const boundary = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
];

describe("estimateStudioDrawing", () => {
  it("expands paving into excavation, CR6, bedding, joint, edge, labour", () => {
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      items: [
        {
          id: "p1",
          t: "paving",
          x: 50,
          y: 50,
          scale: 1.2,
          areaKind: "rect",
          wPx: 110,
          hPx: 80,
        },
      ],
    });
    const labels = report.lines.map((l) => l.label);
    expect(labels.some((l) => /paving/i.test(l))).toBe(true);
    expect(labels.some((l) => /excavation/i.test(l))).toBe(true);
    expect(labels.some((l) => /CR6|crushed/i.test(l))).toBe(true);
    expect(labels.some((l) => /bedding/i.test(l))).toBe(true);
    expect(labels.some((l) => /joint/i.test(l))).toBe(true);
    expect(labels.some((l) => /edge/i.test(l))).toBe(true);
    expect(labels.some((l) => /lighting/i.test(l))).toBe(true);
    // Edge restraint = rect perimeter: 2 × ((110×1.2)/40 + (80×1.2)/40)
    const edge = report.lines.find((l) => /edge restraint/i.test(l.label));
    expect(edge?.qty).toBeCloseTo(2 * (3.3 + 2.4), 5);
    expect(report.totalInclGst).toBeGreaterThan(report.materialsExGst);
    expect(report.tipperLoads).toBeGreaterThanOrEqual(1);
  });

  it("expands lawn into drip irrigation secondaries", () => {
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      items: [
        {
          id: "lawn1",
          t: "lawn",
          x: 50,
          y: 60,
          scale: 1.5,
          areaKind: "rect",
          wPx: 130,
          hPx: 95,
        },
      ],
    });
    const labels = report.lines.map((l) => l.label);
    expect(labels.some((l) => /drip irrigation/i.test(l))).toBe(true);
    expect(labels.some((l) => /emitters/i.test(l))).toBe(true);
  });

  it("foreshadows drainage when hardscape exceeds threshold without drain", () => {
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      items: [
        {
          id: "p1",
          t: "paving",
          x: 50,
          y: 50,
          scale: 2.5,
          areaKind: "rect",
          wPx: 200,
          hPx: 160,
        },
      ],
    });
    expect(report.horizon.some((h) => h.kind === "drainage")).toBe(true);
  });

  it("does not foreshadow drainage when french drain already placed", () => {
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      items: [
        {
          id: "p1",
          t: "paving",
          x: 50,
          y: 50,
          scale: 2.5,
          areaKind: "rect",
          wPx: 200,
          hPx: 160,
        },
        {
          id: "d1",
          t: "frenchdrain",
          x: 50,
          y: 58,
          scale: 1,
        },
      ],
    });
    expect(report.horizon.some((h) => h.kind === "drainage")).toBe(false);
  });
});
