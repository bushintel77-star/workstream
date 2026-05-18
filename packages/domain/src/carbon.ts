/**
 * Embodied carbon per Construct rate-card SKU.
 *
 * Values are kg CO2e per supply unit, sourced from the EPiC database
 * (epicdatabase.com.au) and ICE v3 where AU-specific data is missing.
 * Numbers are indicative for client-facing carbon reporting — not certified
 * environmental product declarations. For tendered EPDs replace these with
 * supplier-supplied figures.
 */

export type CarbonCoefficient = {
  sku: string;
  kg_co2e_per_unit: number;
  unit: string; // matches rate card's unit
  source: "EPiC" | "ICE_v3" | "supplier_estimate" | "stub";
};

const COEFFICIENTS: Record<string, CarbonCoefficient> = {
  // Hard materials
  "PAV-BLUE-SAWN": { sku: "PAV-BLUE-SAWN", kg_co2e_per_unit: 22, unit: "m2", source: "EPiC" },
  "PAV-BLUE-FLAME": { sku: "PAV-BLUE-FLAME", kg_co2e_per_unit: 25, unit: "m2", source: "EPiC" },
  "PAV-BLUE-COBB": { sku: "PAV-BLUE-COBB", kg_co2e_per_unit: 35, unit: "m2", source: "EPiC" },
  "PAV-GRAN": { sku: "PAV-GRAN", kg_co2e_per_unit: 30, unit: "m2", source: "EPiC" },
  "PAV-TRAV": { sku: "PAV-TRAV", kg_co2e_per_unit: 28, unit: "m2", source: "EPiC" },
  "CONC-EDGE": { sku: "CONC-EDGE", kg_co2e_per_unit: 22, unit: "lm", source: "EPiC" },
  "CONC-PAD": { sku: "CONC-PAD", kg_co2e_per_unit: 60, unit: "m2", source: "EPiC" },
  "COR-PNL": { sku: "COR-PNL", kg_co2e_per_unit: 95, unit: "lm", source: "ICE_v3" },
  "COR-EDGE": { sku: "COR-EDGE", kg_co2e_per_unit: 12, unit: "lm", source: "ICE_v3" },
  "WALL-BLUE": { sku: "WALL-BLUE", kg_co2e_per_unit: 110, unit: "m2", source: "EPiC" },
  "WALL-RNDR": { sku: "WALL-RNDR", kg_co2e_per_unit: 140, unit: "lm", source: "EPiC" },
  "TIM-DECK-SUP": { sku: "TIM-DECK-SUP", kg_co2e_per_unit: -8, unit: "m2", source: "EPiC" }, // negative: biogenic
  "TIM-BATT-ARAB": { sku: "TIM-BATT-ARAB", kg_co2e_per_unit: 4, unit: "lm", source: "EPiC" },

  // Soft materials
  "SOIL-TOP": { sku: "SOIL-TOP", kg_co2e_per_unit: 12, unit: "m3", source: "EPiC" },
  "SOIL-COMP": { sku: "SOIL-COMP", kg_co2e_per_unit: -45, unit: "m3", source: "EPiC" }, // negative: sequestration
  "MULCH-PINE": { sku: "MULCH-PINE", kg_co2e_per_unit: -22, unit: "m3", source: "EPiC" },
  "MULCH-SUGAR": { sku: "MULCH-SUGAR", kg_co2e_per_unit: -1.4, unit: "bale", source: "EPiC" },
  "ROCK-DRAIN": { sku: "ROCK-DRAIN", kg_co2e_per_unit: 18, unit: "m3", source: "EPiC" },

  // Plants (rough biogenic uptake per established plant, lifecycle)
  "PLT-140": { sku: "PLT-140", kg_co2e_per_unit: -0.6, unit: "ea", source: "stub" },
  "PLT-200": { sku: "PLT-200", kg_co2e_per_unit: -1.2, unit: "ea", source: "stub" },
  "PLT-300": { sku: "PLT-300", kg_co2e_per_unit: -3, unit: "ea", source: "stub" },
  "PLT-400": { sku: "PLT-400", kg_co2e_per_unit: -8, unit: "ea", source: "stub" },
  "PLT-100L": { sku: "PLT-100L", kg_co2e_per_unit: -25, unit: "ea", source: "stub" },
  "PLT-200L": { sku: "PLT-200L", kg_co2e_per_unit: -55, unit: "ea", source: "stub" },
  "PLT-400L": { sku: "PLT-400L", kg_co2e_per_unit: -120, unit: "ea", source: "stub" },
};

export function coefficientFor(sku: string): CarbonCoefficient | null {
  return COEFFICIENTS[sku] ?? null;
}

/**
 * Sum embodied carbon across a list of (sku, quantity) pairs. Returns a
 * breakdown plus the net total in kg CO2e. Items with no coefficient on
 * file are returned in `unknown_skus` so the UI can surface them.
 */
export function totalEmbodiedCarbon(
  lineItems: Array<{ sku: string; qty: number }>,
): {
  net_kg_co2e: number;
  emitting_kg_co2e: number;
  sequestering_kg_co2e: number;
  per_sku: Array<{ sku: string; qty: number; kg_co2e: number; source: CarbonCoefficient["source"] }>;
  unknown_skus: string[];
} {
  let emitting = 0;
  let sequestering = 0;
  const per_sku: Array<{ sku: string; qty: number; kg_co2e: number; source: CarbonCoefficient["source"] }> = [];
  const unknown: string[] = [];

  for (const li of lineItems) {
    const coef = COEFFICIENTS[li.sku];
    if (!coef) {
      if (!unknown.includes(li.sku)) unknown.push(li.sku);
      continue;
    }
    const kg = coef.kg_co2e_per_unit * li.qty;
    if (kg >= 0) emitting += kg;
    else sequestering += kg; // negative
    per_sku.push({ sku: li.sku, qty: li.qty, kg_co2e: kg, source: coef.source });
  }

  return {
    net_kg_co2e: Math.round((emitting + sequestering) * 10) / 10,
    emitting_kg_co2e: Math.round(emitting * 10) / 10,
    sequestering_kg_co2e: Math.round(sequestering * 10) / 10,
    per_sku,
    unknown_skus: unknown,
  };
}
