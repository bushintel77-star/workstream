/**
 * Establishment calendar — planting windows + watering schedule.
 *
 * Maps each species type (canopy/hedge/bed/feature/existing) to a Melbourne-
 * appropriate planting window and week-by-week establishment watering
 * schedule for the first two summers. Pure domain — no server imports.
 */

export type PlantCategory = "canopy" | "hedge" | "bed" | "feature" | "exist";

export type EstablishmentEntry = {
  species_code: string;
  species_name: string;
  common_name: string;
  count: number;
  category: PlantCategory;
  /** Recommended planting months (Melbourne). */
  plant_window: string;
  /** Weekly watering count for summer 1. */
  summer1_watering_per_week: number;
  /** Weekly watering count for summer 2. */
  summer2_watering_per_week: number;
  /** Establishment duration (weeks). */
  establishment_weeks: number;
  notes: string;
};

export type EstablishmentCalendar = {
  entries: EstablishmentEntry[];
  /** General establishment notes. */
  guidance: string;
};

export type PlantingInput = {
  species: string;
  common_name: string;
  count: number;
  /** Form factor from ZonePlanting.form — e.g. "40cm pot", "200L bag", "tube". */
  form: string;
};

/**
 * Classify a planting form/species into a category for watering purposes.
 * Canopy trees get deep infrequent watering; hedges get frequent shallow;
 * beds get moderate; feature trees get deep but less frequent.
 */
function classifyCategory(input: PlantingInput): PlantCategory {
  const form = input.form.toLowerCase();
  const species = input.species.toLowerCase();
  const common = input.common_name.toLowerCase();

  // Existing/retained trees
  if (form.includes("existing") || form.includes("retained") || form.includes("mature")) {
    return "exist";
  }

  // Pleached/topiary/specimen — always feature, even if species is normally canopy
  if (
    common.includes("pleached") || common.includes("topiary") ||
    common.includes("specimen") || common.includes("feature") ||
    form.includes("pleached") || form.includes("topiary")
  ) {
    return "feature";
  }

  // Large canopy trees — 200L bags, advanced stock, or known canopy species
  if (
    form.includes("200l") || form.includes("100l") ||
    form.includes("advanced") || form.includes("semi-advanced") ||
    species.includes("quercus") || species.includes("acer") ||
    species.includes("fraxinus") || species.includes("pyrus") ||
    species.includes("crenata") || species.includes("carpinus") ||
    common.includes("oak") || common.includes("ash") ||
    common.includes("birch") || common.includes("hornbeam")
  ) {
    return "canopy";
  }

  // Hedges — hedging species or small pot sizes with hedge common names
  if (
    form.includes("140mm") ||
    species.includes("ligustrum") || species.includes("photinia") ||
    species.includes("viburnum") || species.includes("westringia") ||
    species.includes("lomandra") ||
    common.includes("hedge") || common.includes("lily turf") ||
    common.includes("mat rush")
  ) {
    return "hedge";
  }

  // Feature/accent plants — medium pots (25L+)
  if (
    form.includes("25l") || form.includes("30l") || form.includes("45l")
  ) {
    return "feature";
  }

  // Default: bed/groundcover planting
  return "bed";
}

/** Planting windows for Melbourne (southern hemisphere temperate). */
const PLANT_WINDOWS: Record<PlantCategory, string> = {
  canopy: "Autumn–early winter (Apr–Jun) — root establishment before summer",
  hedge: "Autumn–spring (Mar–Oct) — avoid peak summer heat",
  bed: "Spring (Sep–Nov) — after last frost, before summer heat",
  feature: "Autumn (Apr–May) — mild conditions for advanced stock",
  exist: "N/A — existing tree, no planting required",
};

/** Watering frequency for first two summers by category. */
const WATERING: Record<PlantCategory, { s1: number; s2: number; weeks: number }> = {
  canopy: { s1: 2, s2: 1, weeks: 104 }, // 2 years
  hedge: { s1: 3, s2: 2, weeks: 78 }, // 18 months
  bed: { s1: 2, s2: 1, weeks: 52 }, // 1 year
  feature: { s1: 1, s2: 1, weeks: 104 }, // 2 years, deep soak
  exist: { s1: 0, s2: 0, weeks: 0 },
};

const NOTES: Record<PlantCategory, string> = {
  canopy: "Stake for first 2 years. Deep soak to encourage deep roots. Mulch 75mm clear of trunk.",
  hedge: "Trim late winter. Keep moist but not waterlogged. Feed spring + autumn with slow-release.",
  bed: "Mulch 75mm. Pinch tips to encourage bushiness. Replace failed plants within 12 weeks.",
  feature: "Stake year 1. Deep soak weekly in summer 1. Formative prune in winter.",
  exist: "No establishment watering — TPZ protection only. Do not change soil levels within TPZ.",
};

export function buildEstablishmentCalendar(
  plantings: PlantingInput[],
  opts?: { includeExisting?: boolean },
): EstablishmentCalendar {
  const includeExisting = opts?.includeExisting ?? false;
  const entries: EstablishmentEntry[] = [];

  for (const p of plantings) {
    const category = classifyCategory(p);
    if (category === "exist" && !includeExisting) continue;

    const watering = WATERING[category];
    entries.push({
      species_code: p.species.split(" ").map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 4) || "SP",
      species_name: p.species,
      common_name: p.common_name,
      count: p.count,
      category,
      plant_window: PLANT_WINDOWS[category],
      summer1_watering_per_week: watering.s1,
      summer2_watering_per_week: watering.s2,
      establishment_weeks: watering.weeks,
      notes: NOTES[category],
    });
  }

  const guidance = [
    "Establishment watering is critical for the first two summers.",
    "Water deeply and infrequently to encourage deep root growth — avoid daily light sprinkling.",
    "Apply 75mm organic mulch keeping clear of stems/trunks to retain moisture and suppress weeds.",
    "Monitor for stress during heatwaves — water early morning or evening, never in full sun.",
    "Replace any failed plants within the establishment period (typically 12 weeks for tube stock).",
  ].join(" ");

  return { entries, guidance };
}
