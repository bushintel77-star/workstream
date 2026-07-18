import { describe, expect, it } from "vitest";
import { buildQuote } from "./output-generators";
import type { GeneratorArgs } from "./output-generators";

const baseArgs = (): GeneratorArgs => ({
  project: {
    id: "p1",
    owner_id: "dev-user",
    address: "12 Test St, Melbourne VIC",
    lat: -37.81,
    lng: 144.96,
    created_at: new Date().toISOString(),
    status: "outputs",
  },
  survey: {
    id: "s1",
    project_id: "p1",
    aerial_uri: "https://example.com/aerial.png",
    title_polygon: { type: "Polygon", coordinates: [[[0, 0]]] },
    house_polygon: { type: "Polygon", coordinates: [[[0, 0]]] },
    garden_polygon: { type: "Polygon", coordinates: [[[0, 0]]] },
    lot_area_m2: 600,
    house_area_m2: 200,
    garden_area_m2: 400,
    measurements: [],
  },
  design: {
    id: "d1",
    project_id: "p1",
    mode: "auto",
    proposal: {
      zones: [
        {
          id: "z1",
          name: "Rear garden",
          treatment: "Formal planting",
          plantings: [],
          hardscape: [],
          lighting: [],
          irrigation: [],
        },
      ],
      estimated_complexity: "standard",
    },
    gaps: [],
    rationale: "Test",
    version: 1,
  },
  designCanvas: {
    id: "dc1",
    project_id: "p1",
    placements: [
      {
        id: "pl1",
        symbol_id: "bluestone-paver",
        x_pct: 50,
        y_pct: 50,
        rotation_deg: 0,
        scale: 1,
      },
    ],
    strokes: [],
    irrigation_zones: [],
    annotations: [],
    features: [],
    updated_at: new Date().toISOString(),
  },
  catalogSymbols: [],
  rateCard: [
    {
      id: "rc1",
      owner_id: "dev-user",
      sku: "PAV-BLUE",
      label: "Bluestone paving",
      unit: "m²",
      rate: 120,
      category: "paving",
      effective_from: new Date().toISOString(),
    },
  ],
  costings: [
    {
      id: "c1",
      design_id: "d1",
      scenario: "standard",
      line_items: [
        {
          sku: "PAV-BLUE",
          label: "Bluestone paving",
          unit: "m²",
          qty: 40,
          rate: 120,
          total: 4800,
          is_provisional: false,
        },
      ],
      subtotal: 4800,
      gst: 480,
      total: 5280,
    },
  ],
  audit: null,
  tasks: [],
});

describe("buildQuote", () => {
  it("includes design studio site plan section when canvas has placements", () => {
    const md = buildQuote(baseArgs());
    expect(md).toContain("## Site plan (design studio)");
    expect(md).toContain("Bluestone paver");
    expect(md).toContain("PAV-BLUE");
  });

  it("matches quote markdown snapshot for stable sections", () => {
    const md = buildQuote(baseArgs());
    const normalised = md
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "TIMESTAMP")
      .replace(/Project [a-f0-9-]+/gi, "Project ID");
    expect(normalised).toMatchSnapshot();
  });
});
