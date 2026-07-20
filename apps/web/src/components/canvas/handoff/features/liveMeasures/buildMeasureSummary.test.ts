import { describe, expect, it } from "vitest";
import type { LiveMeasureRow } from "./buildLiveMeasures";
import { buildCanvasMeasureSummary } from "./buildMeasureSummary";

const siteRows: LiveMeasureRow[] = [
  {
    id: "lot",
    label: "Lot",
    value: "600 m²",
    group: "site",
    numeric: 600,
    unit: "m²",
  },
  {
    id: "building",
    label: "Existing house",
    value: "96.0 m²",
    group: "site",
    numeric: 96,
    unit: "m²",
  },
  {
    id: "outdoor",
    label: "Outdoor",
    value: "504 m²",
    group: "site",
    numeric: 504,
    unit: "m²",
  },
  {
    id: "perimeter",
    label: "Perimeter",
    value: "110 m",
    group: "site",
    numeric: 110,
    unit: "m",
  },
  {
    id: "coverage",
    label: "Coverage",
    value: "16%",
    group: "site",
    numeric: 16,
    unit: "%",
  },
];

describe("buildCanvasMeasureSummary", () => {
  it("prioritises title, existing house and outdoor area in Survey", () => {
    const summary = buildCanvasMeasureSummary({
      mode: "survey",
      rows: siteRows,
      acceptedItemCount: 0,
    });
    expect(summary.kicker).toBe("Site measures");
    expect(summary.items.map((item) => item.id)).toEqual([
      "lot",
      "building",
      "outdoor",
    ]);
  });

  it("marks an unavailable existing-house outline as not traced", () => {
    const summary = buildCanvasMeasureSummary({
      mode: "survey",
      rows: siteRows.map((row) =>
        row.id === "building" ? { ...row, numeric: 0, value: "0.00 m²" } : row,
      ),
      acceptedItemCount: 0,
    });
    expect(summary.items.find((item) => item.id === "building")?.value).toBe(
      "Not traced",
    );
  });

  it("switches priorities for Sketch and CAD progression", () => {
    const sketch = buildCanvasMeasureSummary({
      mode: "sketch",
      rows: siteRows,
      acceptedItemCount: 3,
    });
    const cad = buildCanvasMeasureSummary({
      mode: "cad",
      rows: siteRows,
      acceptedItemCount: 3,
    });
    expect(sketch.items.map((item) => item.id)).toEqual([
      "outdoor",
      "assets",
      "perimeter",
    ]);
    expect(cad.items.map((item) => item.id)).toEqual([
      "outdoor",
      "coverage",
      "assets",
    ]);
  });
});
