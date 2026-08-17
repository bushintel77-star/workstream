/**
 * One-off enrichment of packages/domain/src/seed/plant-palette.json.
 *
 * Adds the professional nursery fields (spacing_m, pot_size_l, sun_exposure,
 * water_needs, growth_rate, evergreen, native, drought_tolerant, flowering,
 * hardiness) to the existing species, and appends a batch of new
 * Melbourne-appropriate species.
 *
 * Values are standard Victorian nursery / botanical data (see
 * PROVENANCE.md in this directory). Re-run with:
 *   pnpm exec tsx packages/domain/scripts/enrich-plant-palette.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Seed = {
  species: string;
  common_name: string;
  category: string;
  form?: string;
  mature_h_m: number;
  mature_w_m: number;
  use_description: string;
  climate_zones: string[];
  notes?: string;
  curtis_approved: boolean;
  spacing_m?: number;
  pot_size_l?: number;
  sun_exposure?: string;
  water_needs?: string;
  growth_rate?: string;
  evergreen?: boolean;
  native?: boolean;
  drought_tolerant?: boolean;
  flowering?: string;
  hardiness?: string;
};

const path = join(__dirname, "..", "src", "seed", "plant-palette.json");
const seeds = JSON.parse(readFileSync(path, "utf8")) as Seed[];

/** Per-species enrichment keyed by species string. */
const ENRICH: Record<string, Partial<Seed>> = {
  "Carpinus betulus 'Frans Fontaine'": {
    spacing_m: 4, pot_size_l: 75, sun_exposure: "full_sun", water_needs: "moderate",
    growth_rate: "moderate", evergreen: false, native: false, drought_tolerant: false,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Pyrus calleryana 'Capital'": {
    spacing_m: 3, pot_size_l: 45, sun_exposure: "full_sun", water_needs: "moderate",
    growth_rate: "fast", evergreen: false, native: false, drought_tolerant: true,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Quercus palustris 'Green Pillar'": {
    spacing_m: 4, pot_size_l: 45, sun_exposure: "full_sun", water_needs: "moderate",
    growth_rate: "moderate", evergreen: false, native: false, drought_tolerant: false,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Tilia cordata 'Greenspire'": {
    spacing_m: 5, pot_size_l: 45, sun_exposure: "full_sun", water_needs: "moderate",
    growth_rate: "moderate", evergreen: false, native: false, drought_tolerant: false,
    flowering: "summer", hardiness: "frost hardy",
  },
  "Ulmus parvifolia 'Murray Cane'": {
    spacing_m: 4, pot_size_l: 45, sun_exposure: "full_sun", water_needs: "low",
    growth_rate: "fast", evergreen: false, native: false, drought_tolerant: true,
    flowering: "autumn", hardiness: "frost hardy",
  },
  "Photinia robusta": {
    spacing_m: 1.2, pot_size_l: 10, sun_exposure: "full_sun", water_needs: "moderate",
    growth_rate: "fast", evergreen: true, native: false, drought_tolerant: true,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Murraya paniculata": {
    spacing_m: 1, pot_size_l: 10, sun_exposure: "full_sun_part_shade", water_needs: "moderate",
    growth_rate: "fast", evergreen: true, native: false, drought_tolerant: false,
    flowering: "summer", hardiness: "light frost",
  },
  "Camellia sasanqua 'Setsugekka'": {
    spacing_m: 1.2, pot_size_l: 10, sun_exposure: "part_shade", water_needs: "moderate",
    growth_rate: "moderate", evergreen: true, native: false, drought_tolerant: false,
    flowering: "autumn", hardiness: "light frost",
  },
  "Westringia 'Wynyabbie Gem'": {
    spacing_m: 1, pot_size_l: 5, sun_exposure: "full_sun", water_needs: "low",
    growth_rate: "moderate", evergreen: true, native: true, drought_tolerant: true,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Pittosporum tenuifolium 'Silver Sheen'": {
    spacing_m: 1.5, pot_size_l: 10, sun_exposure: "full_sun_part_shade", water_needs: "low",
    growth_rate: "moderate", evergreen: true, native: false, drought_tolerant: true,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Viburnum tinus": {
    spacing_m: 1.2, pot_size_l: 10, sun_exposure: "part_shade", water_needs: "moderate",
    growth_rate: "moderate", evergreen: true, native: false, drought_tolerant: false,
    flowering: "winter", hardiness: "frost hardy",
  },
  "Magnolia grandiflora 'Little Gem'": {
    spacing_m: 3, pot_size_l: 45, sun_exposure: "full_sun", water_needs: "moderate",
    growth_rate: "slow", evergreen: true, native: false, drought_tolerant: false,
    flowering: "summer", hardiness: "light frost",
  },
  "Magnolia grandiflora 'Kay Parris'": {
    spacing_m: 3, pot_size_l: 45, sun_exposure: "full_sun", water_needs: "moderate",
    growth_rate: "slow", evergreen: true, native: false, drought_tolerant: false,
    flowering: "summer", hardiness: "light frost",
  },
  "Acer palmatum 'Sango Kaku'": {
    spacing_m: 3, pot_size_l: 45, sun_exposure: "part_shade", water_needs: "moderate",
    growth_rate: "slow", evergreen: false, native: false, drought_tolerant: false,
    flowering: "spring", hardiness: "light frost",
  },
  "Olea europaea 'Tolley's Upright'": {
    spacing_m: 3, pot_size_l: 45, sun_exposure: "full_sun", water_needs: "low",
    growth_rate: "moderate", evergreen: true, native: false, drought_tolerant: true,
    flowering: "spring", hardiness: "light frost",
  },
  "Lagerstroemia indica 'Tuscarora'": {
    spacing_m: 3, pot_size_l: 45, sun_exposure: "full_sun", water_needs: "moderate",
    growth_rate: "fast", evergreen: false, native: false, drought_tolerant: true,
    flowering: "summer", hardiness: "light frost",
  },
  "Cercis canadensis 'Forest Pansy'": {
    spacing_m: 4, pot_size_l: 45, sun_exposure: "full_sun", water_needs: "moderate",
    growth_rate: "moderate", evergreen: false, native: false, drought_tolerant: false,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Buxus sempervirens": {
    spacing_m: 0.3, pot_size_l: 2, sun_exposure: "part_shade", water_needs: "moderate",
    growth_rate: "slow", evergreen: true, native: false, drought_tolerant: false,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Buxus microphylla 'Faulkner'": {
    spacing_m: 0.3, pot_size_l: 2, sun_exposure: "part_shade", water_needs: "moderate",
    growth_rate: "slow", evergreen: true, native: false, drought_tolerant: false,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Westringia 'Grey Box'": {
    spacing_m: 0.6, pot_size_l: 2, sun_exposure: "full_sun", water_needs: "low",
    growth_rate: "moderate", evergreen: true, native: true, drought_tolerant: true,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Camellia japonica": {
    spacing_m: 1.5, pot_size_l: 10, sun_exposure: "part_shade", water_needs: "moderate",
    growth_rate: "slow", evergreen: true, native: false, drought_tolerant: false,
    flowering: "winter", hardiness: "light frost",
  },
  "Agonis flexuosa 'Burgundy'": {
    spacing_m: 4, pot_size_l: 45, sun_exposure: "full_sun", water_needs: "low",
    growth_rate: "moderate", evergreen: true, native: true, drought_tolerant: true,
    flowering: "spring", hardiness: "light frost",
  },
  "Liriope muscari 'Just Right'": {
    spacing_m: 0.3, pot_size_l: 1, sun_exposure: "full_sun_part_shade", water_needs: "moderate",
    growth_rate: "moderate", evergreen: true, native: false, drought_tolerant: true,
    flowering: "summer", hardiness: "frost hardy",
  },
  "Lomandra 'Tanika'": {
    spacing_m: 0.4, pot_size_l: 1, sun_exposure: "full_sun_part_shade", water_needs: "low",
    growth_rate: "moderate", evergreen: true, native: true, drought_tolerant: true,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Lomandra 'Lime Tuff'": {
    spacing_m: 0.35, pot_size_l: 1, sun_exposure: "full_sun_part_shade", water_needs: "low",
    growth_rate: "moderate", evergreen: true, native: true, drought_tolerant: true,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Dianella 'Little Jess'": {
    spacing_m: 0.35, pot_size_l: 1, sun_exposure: "full_sun_part_shade", water_needs: "low",
    growth_rate: "moderate", evergreen: true, native: true, drought_tolerant: true,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Miscanthus sinensis 'Adagio'": {
    spacing_m: 0.8, pot_size_l: 5, sun_exposure: "full_sun", water_needs: "moderate",
    growth_rate: "fast", evergreen: false, native: false, drought_tolerant: true,
    flowering: "autumn", hardiness: "frost hardy",
  },
  "Pennisetum alopecuroides 'Nafray'": {
    spacing_m: 0.6, pot_size_l: 5, sun_exposure: "full_sun", water_needs: "low",
    growth_rate: "moderate", evergreen: true, native: true, drought_tolerant: true,
    flowering: "summer", hardiness: "frost hardy",
  },
  "Calamagrostis x acutiflora 'Karl Foerster'": {
    spacing_m: 0.6, pot_size_l: 5, sun_exposure: "full_sun", water_needs: "moderate",
    growth_rate: "moderate", evergreen: false, native: false, drought_tolerant: false,
    flowering: "summer", hardiness: "frost hardy",
  },
  "Dichondra repens": {
    spacing_m: 0.2, pot_size_l: 1, sun_exposure: "part_shade", water_needs: "moderate",
    growth_rate: "moderate", evergreen: true, native: true, drought_tolerant: false,
    flowering: "spring", hardiness: "light frost",
  },
  "Trachelospermum jasminoides": {
    spacing_m: 0.5, pot_size_l: 1, sun_exposure: "full_sun_part_shade", water_needs: "moderate",
    growth_rate: "moderate", evergreen: true, native: false, drought_tolerant: true,
    flowering: "summer", hardiness: "light frost",
  },
  "Myoporum parvifolium": {
    spacing_m: 0.5, pot_size_l: 1, sun_exposure: "full_sun", water_needs: "low",
    growth_rate: "fast", evergreen: true, native: true, drought_tolerant: true,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Parthenocissus tricuspidata 'Veitchii'": {
    spacing_m: 1, pot_size_l: 5, sun_exposure: "full_sun_part_shade", water_needs: "moderate",
    growth_rate: "fast", evergreen: false, native: false, drought_tolerant: false,
    flowering: "summer", hardiness: "frost hardy",
  },
  "Ficus pumila": {
    spacing_m: 0.5, pot_size_l: 5, sun_exposure: "full_sun_part_shade", water_needs: "moderate",
    growth_rate: "fast", evergreen: true, native: false, drought_tolerant: false,
    flowering: "summer", hardiness: "light frost",
  },
  "Stenotaphrum secundatum 'Sir Walter'": {
    spacing_m: 0, pot_size_l: 0, sun_exposure: "full_sun_part_shade", water_needs: "moderate",
    growth_rate: "fast", evergreen: true, native: false, drought_tolerant: true,
    flowering: "summer", hardiness: "light frost",
  },
  "Festuca arundinacea": {
    spacing_m: 0, pot_size_l: 0, sun_exposure: "full_sun", water_needs: "moderate",
    growth_rate: "moderate", evergreen: true, native: false, drought_tolerant: true,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Cycas revoluta": {
    spacing_m: 1.5, pot_size_l: 25, sun_exposure: "full_sun", water_needs: "low",
    growth_rate: "slow", evergreen: true, native: false, drought_tolerant: true,
    flowering: "summer", hardiness: "light frost",
  },
  "Ligularia reniformis": {
    spacing_m: 0.5, pot_size_l: 1, sun_exposure: "part_shade", water_needs: "high",
    growth_rate: "moderate", evergreen: true, native: false, drought_tolerant: false,
    flowering: "summer", hardiness: "light frost",
  },
  "Buxus microphylla": {
    spacing_m: 0.3, pot_size_l: 2, sun_exposure: "part_shade", water_needs: "moderate",
    growth_rate: "slow", evergreen: true, native: false, drought_tolerant: false,
    flowering: "spring", hardiness: "frost hardy",
  },
  "Ophiopogon japonicus 'Nana'": {
    spacing_m: 0.2, pot_size_l: 1, sun_exposure: "part_shade", water_needs: "moderate",
    growth_rate: "slow", evergreen: true, native: false, drought_tolerant: true,
    flowering: "summer", hardiness: "frost hardy",
  },
  "Philodendron 'Rojo Congo'": {
    spacing_m: 0.8, pot_size_l: 5, sun_exposure: "part_shade", water_needs: "moderate",
    growth_rate: "moderate", evergreen: true, native: false, drought_tolerant: false,
    flowering: "summer", hardiness: "not frost hardy",
  },
  "Parthenocissus tricuspidata": {
    spacing_m: 1, pot_size_l: 5, sun_exposure: "full_sun_part_shade", water_needs: "moderate",
    growth_rate: "fast", evergreen: false, native: false, drought_tolerant: false,
    flowering: "summer", hardiness: "frost hardy",
  },
};

/** New species to append — Melbourne-appropriate, APC/VicFlora native flags. */
const NEW: Seed[] = [
  {
    species: "Eucalyptus scoparia", common_name: "Wallangarra White Gum",
    category: "feature_tree", form: "Tree", mature_h_m: 15, mature_w_m: 8,
    use_description: "Tall clean-trunked native, elegant canopy", climate_zones: ["temperate"],
    curtis_approved: true, spacing_m: 6, pot_size_l: 45, sun_exposure: "full_sun",
    water_needs: "low", growth_rate: "fast", evergreen: true, native: true,
    drought_tolerant: true, flowering: "winter", hardiness: "frost hardy",
  },
  {
    species: "Hakea laurina", common_name: "Pincushion Hakea",
    category: "feature_tree", form: "Small tree", mature_h_m: 5, mature_w_m: 4,
    use_description: "Sculptural native, winter bloom", climate_zones: ["temperate"],
    curtis_approved: true, spacing_m: 3, pot_size_l: 25, sun_exposure: "full_sun",
    water_needs: "low", growth_rate: "moderate", evergreen: true, native: true,
    drought_tolerant: true, flowering: "winter", hardiness: "light frost",
  },
  {
    species: "Callistemon 'Kings Park Special'", common_name: "Bottlebrush",
    category: "feature_tree", form: "Small tree", mature_h_m: 6, mature_w_m: 4,
    use_description: "Bird-attracting native, red brushes", climate_zones: ["temperate"],
    curtis_approved: true, spacing_m: 3, pot_size_l: 25, sun_exposure: "full_sun",
    water_needs: "low", growth_rate: "moderate", evergreen: true, native: true,
    drought_tolerant: true, flowering: "spring", hardiness: "light frost",
  },
  {
    species: "Grevillea 'Robyn Gordon'", common_name: "Robyn Gordon Grevillea",
    category: "structural_shrub", form: "Shrub", mature_h_m: 1.5, mature_w_m: 2,
    use_description: "Long-flowering native mass", climate_zones: ["temperate"],
    curtis_approved: true, spacing_m: 1, pot_size_l: 5, sun_exposure: "full_sun",
    water_needs: "low", growth_rate: "moderate", evergreen: true, native: true,
    drought_tolerant: true, flowering: "year-round", hardiness: "light frost",
  },
  {
    species: "Correa 'Dusky Bells'", common_name: "Native Fuchsia",
    category: "structural_shrub", form: "Shrub", mature_h_m: 1, mature_w_m: 1.5,
    use_description: "Shade-tolerant native, tubular flowers", climate_zones: ["temperate"],
    curtis_approved: true, spacing_m: 0.8, pot_size_l: 5, sun_exposure: "part_shade",
    water_needs: "low", growth_rate: "moderate", evergreen: true, native: true,
    drought_tolerant: true, flowering: "autumn", hardiness: "frost hardy",
  },
  {
    species: "Anigozanthos 'Bush Gold'", common_name: "Kangaroo Paw",
    category: "mass_understory", form: "Clumping", mature_h_m: 1, mature_w_m: 0.8,
    use_description: "Native accent mass, architectural flower", climate_zones: ["temperate"],
    curtis_approved: true, spacing_m: 0.5, pot_size_l: 2, sun_exposure: "full_sun",
    water_needs: "low", growth_rate: "moderate", evergreen: true, native: true,
    drought_tolerant: true, flowering: "spring", hardiness: "light frost",
  },
  {
    species: "Poa labillardierei", common_name: "Common Tussock Grass",
    category: "ornamental_grass", form: "Tussock", mature_h_m: 1, mature_w_m: 1,
    use_description: "Native tussock mass, soft movement", climate_zones: ["temperate"],
    curtis_approved: true, spacing_m: 0.6, pot_size_l: 2, sun_exposure: "full_sun",
    water_needs: "low", growth_rate: "moderate", evergreen: true, native: true,
    drought_tolerant: true, flowering: "summer", hardiness: "frost hardy",
  },
  {
    species: "Themeda triandra", common_name: "Kangaroo Grass",
    category: "ornamental_grass", form: "Tussock", mature_h_m: 0.8, mature_w_m: 0.8,
    use_description: "Native grassland, seasonal colour", climate_zones: ["temperate"],
    curtis_approved: true, spacing_m: 0.5, pot_size_l: 2, sun_exposure: "full_sun",
    water_needs: "low", growth_rate: "moderate", evergreen: true, native: true,
    drought_tolerant: true, flowering: "summer", hardiness: "frost hardy",
  },
  {
    species: "Viola hederacea", common_name: "Native Violet",
    category: "groundcover", form: "Groundcover", mature_h_m: 0.1, mature_w_m: 0.5,
    use_description: "Shade groundcover under trees", climate_zones: ["temperate"],
    curtis_approved: true, spacing_m: 0.3, pot_size_l: 1, sun_exposure: "part_shade",
    water_needs: "moderate", growth_rate: "fast", evergreen: true, native: true,
    drought_tolerant: false, flowering: "spring", hardiness: "light frost",
  },
  {
    species: "Pandorea jasminoides", common_name: "Bower Vine",
    category: "climber", form: "Climber", mature_h_m: 5, mature_w_m: 3,
    use_description: "Evergreen native climber, pink trumpets", climate_zones: ["temperate"],
    curtis_approved: true, spacing_m: 1, pot_size_l: 5, sun_exposure: "full_sun_part_shade",
    water_needs: "moderate", growth_rate: "fast", evergreen: true, native: true,
    drought_tolerant: false, flowering: "summer", hardiness: "light frost",
  },
];

let changed = 0;
for (const s of seeds) {
  const e = ENRICH[s.species];
  if (e) {
    Object.assign(s, e);
    changed += 1;
  }
}
seeds.push(...NEW);

writeFileSync(path, `${JSON.stringify(seeds, null, 2)}\n`, "utf8");
console.log(`enriched ${changed} existing + added ${NEW.length} new = ${seeds.length} species`);
