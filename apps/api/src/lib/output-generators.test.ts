import { describe, expect, it } from "vitest";
import {
  buildEstablishmentCalendarDoc,
  buildHandoverPackDoc,
  buildQuote,
  buildSupplierOrderDoc,
} from "./output-generators";
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
    construction_trenches: [],
    annotations: [],
    image_layers: [],
    photo_elevations: [],
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

const argsWithPlantings = (): GeneratorArgs => ({
  ...baseArgs(),
  design: {
    ...baseArgs().design!,
    proposal: {
      ...baseArgs().design!.proposal,
      zones: [
        {
          id: "z1",
          name: "Rear garden",
          treatment: "Formal planting",
          plantings: [
            {
              species: "Quercus robur",
              common_name: "English oak",
              count: 2,
              form: "200L bag",
            },
            {
              species: "Lomandra longifolia",
              common_name: "Mat rush",
              count: 20,
              form: "140mm pot",
            },
          ],
          hardscape: [
            { item: "Bluestone paving", qty: 40, unit: "m2", sku: "PAV-BLUE" },
          ],
          lighting: [
            { fixture: "Garden spike light", count: 6, sku: "SL-01" },
          ],
          irrigation: [
            { item: "Drip line 16mm", qty: 50, unit: "m", sku: "DRIP-16" },
          ],
        },
      ],
    },
  },
});

describe("buildEstablishmentCalendarDoc", () => {
  it("generates calendar with planting schedule and care notes", () => {
    const md = buildEstablishmentCalendarDoc(argsWithPlantings());
    expect(md).toContain("# Establishment calendar");
    expect(md).toContain("Quercus robur");
    expect(md).toContain("Lomandra longifolia");
    expect(md).toContain("Plant window");
    expect(md).toContain("Summer 1");
    expect(md).toContain("Care notes");
    expect(md).toContain("Stake");
  });

  it("includes general guidance", () => {
    const md = buildEstablishmentCalendarDoc(argsWithPlantings());
    expect(md).toContain("## General guidance");
    expect(md).toContain("mulch");
  });

  it("handles empty plantings", () => {
    const md = buildEstablishmentCalendarDoc(baseArgs());
    expect(md).toContain("No plantings recorded");
  });
});

describe("buildHandoverPackDoc", () => {
  it("generates handover pack with all sections", () => {
    const md = buildHandoverPackDoc(argsWithPlantings());
    expect(md).toContain("# Maintenance & handover pack");
    expect(md).toContain("## Plant schedule");
    expect(md).toContain("## Irrigation");
    expect(md).toContain("## Lighting circuits");
    expect(md).toContain("## Materials");
    expect(md).toContain("## Warranty periods");
  });

  it("includes plant care notes", () => {
    const md = buildHandoverPackDoc(argsWithPlantings());
    expect(md).toContain("Quercus robur");
    expect(md).toContain("Watering");
    expect(md).toContain("Pruning");
  });

  it("includes irrigation items", () => {
    const md = buildHandoverPackDoc(argsWithPlantings());
    expect(md).toContain("Drip line 16mm");
    expect(md).toContain("DRIP-16");
  });

  it("includes lighting fixtures", () => {
    const md = buildHandoverPackDoc(argsWithPlantings());
    expect(md).toContain("Garden spike light");
    expect(md).toContain("SL-01");
  });

  it("includes warranty periods", () => {
    const md = buildHandoverPackDoc(argsWithPlantings());
    expect(md).toContain("Hardscape construction");
    expect(md).toContain("Plant material");
  });
});

describe("buildSupplierOrderDoc", () => {
  it("builds trade order / delivery request from firm quote lines", () => {
    const md = buildSupplierOrderDoc(baseArgs());
    expect(md).toContain("Supplier order / delivery request");
    expect(md).toContain("PAV-BLUE");
    expect(md).toContain("Delivery request");
    expect(md).toContain("live quote");
  });
});
