import { plantPalette, rateCard } from "@construct/domain";
import type { PlantPalette, RateCard } from "./types";
import { SYSTEM_OWNER } from "./memory";

type PlantSeedRow = (typeof plantPalette)[number];
type RateSeedRow = (typeof rateCard)[number];

export function seedPlantPalette(): PlantPalette[] {
  return (plantPalette as PlantSeedRow[]).map((row) => ({
    id: crypto.randomUUID(),
    owner_id: SYSTEM_OWNER,
    species: row.species,
    common_name: row.common_name,
    mature_h_m: row.mature_h_m,
    mature_w_m: row.mature_w_m,
    category: row.category,
    form: row.form,
    use_description: row.use_description,
    climate_zones: row.climate_zones,
    curtis_approved: row.curtis_approved,
  }));
}

export function seedRateCard(): RateCard[] {
  const effectiveFrom = new Date().toISOString();
  return (rateCard as RateSeedRow[]).map((row) => ({
    id: crypto.randomUUID(),
    owner_id: SYSTEM_OWNER,
    category: row.category,
    sku: row.sku,
    label: row.label,
    unit: row.unit,
    rate: row.rate,
    notes: row.is_poa ? "POA" : row.notes,
    effective_from: effectiveFrom,
  }));
}
