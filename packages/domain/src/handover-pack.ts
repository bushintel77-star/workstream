/**
 * Maintenance & handover pack — plant care notes, irrigation, lighting,
 * materials, and warranty periods assembled from design data.
 *
 * Pure domain — no server imports.
 */

import { buildEstablishmentCalendar, type PlantCategory } from "./establishment-calendar";

export type HandoverPlantEntry = {
  species: string;
  common_name: string;
  count: number;
  category: PlantCategory;
  care_notes: string;
  watering: string;
  pruning: string;
};

export type HandoverIrrigationItem = {
  item: string;
  qty: number;
  unit: string;
  sku?: string;
};

export type HandoverLightingEntry = {
  fixture: string;
  count: number;
  sku?: string;
};

export type HandoverMaterial = {
  item: string;
  sku?: string;
  supplier: string;
};

export type HandoverWarranty = {
  item: string;
  period: string;
};

export type HandoverPack = {
  plants: HandoverPlantEntry[];
  irrigation: HandoverIrrigationItem[];
  lighting: HandoverLightingEntry[];
  materials: HandoverMaterial[];
  warranty_periods: HandoverWarranty[];
};

export type HandoverPackInput = {
  plantings: Array<{
    species: string;
    common_name: string;
    count: number;
    form: string;
  }>;
  irrigation: Array<{
    item: string;
    qty: number;
    unit: string;
    sku?: string;
  }>;
  lighting: Array<{
    fixture: string;
    count: number;
    sku?: string;
  }>;
  materials: Array<{
    item: string;
    sku?: string;
    supplier: string;
  }>;
};

const CARE_NOTES: Record<PlantCategory, { watering: string; pruning: string; care: string }> = {
  canopy: {
    watering: "Deep soak 2x/week summer 1, 1x/week summer 2",
    pruning: "Formative prune in winter — remove crossing branches only",
    care: "Stake for first 2 years. Mulch 75mm clear of trunk. Monitor for stress in heatwaves.",
  },
  hedge: {
    watering: "Keep moist 3x/week summer 1, 2x/week summer 2",
    pruning: "Trim late winter to shape. Light tip prune through growing season.",
    care: "Feed spring + autumn with slow-release. Keep mulched. Replace failures within 12 weeks.",
  },
  bed: {
    watering: "2x/week summer 1, 1x/week summer 2",
    pruning: "Deadhead regularly. Cut back hard in late winter.",
    care: "Mulch 75mm. Pinch tips to encourage bushiness. Replace failed plants within 12 weeks.",
  },
  feature: {
    watering: "Deep soak weekly summer 1 and 2",
    pruning: "Formative prune in winter. Minimal — preserve pleached/form shape.",
    care: "Stake year 1. Keep mulched. Monitor for pest/disease on stressed specimens.",
  },
  exist: {
    watering: "N/A — established tree",
    pruning: "Crown lift only if required. Engage arborist for any major work.",
    care: "TPZ protection only. Do not change soil levels within TPZ. No storage over root zone.",
  },
};

const DEFAULT_WARRANTIES: HandoverWarranty[] = [
  { item: "Hardscape construction (paving, decking, walls)", period: "5 years structural" },
  { item: "Drainage and irrigation systems", period: "2 years" },
  { item: "Lighting fixtures and transformers", period: "2 years (manufacturer)" },
  { item: "Plant material", period: "12 weeks from planting (establishment period)" },
  { item: "Lawn/turf", period: "6 weeks from laying" },
];

export function buildHandoverPack(input: HandoverPackInput): HandoverPack {
  const calendar = buildEstablishmentCalendar(input.plantings, {
    includeExisting: true,
  });

  const plants: HandoverPlantEntry[] = calendar.entries.map((e) => {
    const notes = CARE_NOTES[e.category];
    return {
      species: e.species_name,
      common_name: e.common_name,
      count: e.count,
      category: e.category,
      care_notes: notes.care,
      watering: notes.watering,
      pruning: notes.pruning,
    };
  });

  return {
    plants,
    irrigation: input.irrigation.map((ir) => ({
      item: ir.item,
      qty: ir.qty,
      unit: ir.unit,
      sku: ir.sku,
    })),
    lighting: input.lighting.map((l) => ({
      fixture: l.fixture,
      count: l.count,
      sku: l.sku,
    })),
    materials: input.materials.map((m) => ({
      item: m.item,
      sku: m.sku,
      supplier: m.supplier,
    })),
    warranty_periods: DEFAULT_WARRANTIES,
  };
}
