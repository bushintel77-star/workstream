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

  it("accepted construction trenches land as excavate lm; ghosts ignored", () => {
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      scaleM: 100,
      items: [],
      constructionTrenches: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          name: "Irrig main",
          kind: "irrig_main",
          points: [
            { x_pct: 20, y_pct: 50 },
            { x_pct: 40, y_pct: 50 },
          ],
          depth_mm: 400,
          source: "auto",
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          name: "Ghost drain",
          kind: "drainage",
          points: [
            { x_pct: 10, y_pct: 10 },
            { x_pct: 90, y_pct: 10 },
          ],
          depth_mm: 450,
          source: "auto",
          ghost: true,
        },
      ],
    });
    const trench = report.lines.find((l) => l.id === "sec-trench-irrig_main");
    expect(trench).toBeTruthy();
    expect(trench!.unit).toBe("lm");
    expect(trench!.qty).toBeCloseTo(20, 0);
    expect(report.lines.some((l) => l.id === "sec-trench-drainage")).toBe(false);
  });

  it("traces boundary ring area + perimeter to the ground-truth source", () => {
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      boundaryAreaM2: 512,
      boundaryPerimeterM: 96.4,
      items: [],
    });
    const area = report.trace.find((t) => t.label === "Site area (boundary ring)");
    expect(area).toBeTruthy();
    expect(area!.qty).toBeCloseTo(512, 5);
    expect(area!.unit).toBe("m²");
    expect(area!.source).toBe("boundary");
    const perim = report.trace.find((t) => t.label === "Boundary perimeter");
    expect(perim?.qty).toBeCloseTo(96.4, 5);
    expect(perim?.source).toBe("boundary");
  });

  it("labels the site area indicative when the boundary ring is not closed", () => {
    const report = estimateStudioDrawing({
      outdoorM2: 0,
      boundary,
      boundaryAreaM2: null,
      items: [],
    });
    const area = report.trace.find((t) => t.label === "Site area (boundary ring)");
    expect(area?.source).toBe("indicative");
    expect(area?.qty).toBe(0);
  });

  it("traces asset counts to the placed item ids", () => {
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      items: [
        { id: "tree1", t: "canopy", x: 30, y: 30, scale: 1 },
        { id: "tree2", t: "feature", x: 60, y: 30, scale: 1 },
        { id: "bed1", t: "bed", x: 40, y: 60, scale: 1 },
        // Ghost items must not count.
        { id: "ghost1", t: "canopy", x: 80, y: 80, scale: 1, ghost: true },
      ],
    });
    const trees = report.trace.find((t) => t.label === "Trees");
    expect(trees?.qty).toBe(2);
    expect(trees?.source).toBe("item");
    expect(trees?.sourceIds.sort()).toEqual(["tree1", "tree2"]);
    const beds = report.trace.find((t) => t.label === "Planting beds");
    expect(beds?.qty).toBe(1);
    expect(beds?.sourceIds).toEqual(["bed1"]);
  });

  it("traces material volumes to cad quantities when hardscape is placed", () => {
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      boundaryAreaM2: 512,
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
    const hard = report.trace.find((t) => t.label === "Hardscape area");
    expect(hard?.source).toBe("cad_qty");
    expect(hard!.qty).toBeGreaterThan(0);
    expect(hard?.sourceIds).toContain("p1");
    const dig = report.trace.find((t) => t.label === "Excavation volume");
    expect(dig?.source).toBe("cad_qty");
    expect(dig!.qty).toBeGreaterThan(0);
  });
});
