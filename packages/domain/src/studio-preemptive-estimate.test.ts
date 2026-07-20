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

  it("authored drip zones supersede auto lawn irrigation in Advanced BOM", () => {
    const zoneId = "11111111-1111-4111-8111-111111111111";
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      scaleM: 100,
      irrigationZones: [
        {
          id: zoneId,
          name: "Rear lawn",
          kind: "drip",
          points: [
            { x_pct: 20, y_pct: 60 },
            { x_pct: 70, y_pct: 60 },
          ],
          emitter_spacing_cm: 30,
        },
      ],
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
    expect(labels.some((l) => /Drip — Rear lawn/i.test(l))).toBe(true);
    expect(labels.some((l) => /Irrigation zone install/i.test(l))).toBe(true);
    expect(labels.some((l) => /Preemptive drip/i.test(l))).toBe(false);
    expect(
      report.lines.some(
        (l) => l.id === `sec-irrig-lawn1` || /~2\.5/.test(l.notes ?? ""),
      ),
    ).toBe(false);
  });

  it("authored lighting zones supersede auto path lighting", () => {
    const zoneId = "22222222-2222-4222-8222-222222222222";
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      scaleM: 100,
      irrigationZones: [
        {
          id: zoneId,
          name: "Entry path",
          kind: "lighting",
          points: [
            { x_pct: 30, y_pct: 40 },
            { x_pct: 30, y_pct: 80 },
          ],
          fixture_spacing_m: 2.5,
        },
      ],
      items: [
        {
          id: "p1",
          t: "paving",
          x: 40,
          y: 50,
          scale: 1.2,
          areaKind: "rect",
          wPx: 110,
          hPx: 80,
        },
      ],
    });
    const labels = report.lines.map((l) => l.label);
    expect(labels.some((l) => /Lighting — Entry path/i.test(l))).toBe(true);
    expect(labels.some((l) => /Path lighting — spike/i.test(l))).toBe(false);
  });
});
