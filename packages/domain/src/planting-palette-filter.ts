/**
 * Planting palette filter — shade cell + soil / aspect tags (Workflow 1).
 * Soft filter for kit library; Flora Ring ranking stays the hard intelligence.
 */

import type { CatalogSymbol, PlantSun } from "@workstream/contracts";

export type SoilTag = "clay" | "loam" | "sand" | "any";
export type AspectTag = "N" | "E" | "S" | "W" | "any";

export type PlantingPaletteFilter = {
  /** Indicative sun hours at the summon / click cell (0–12). */
  sunHours: number;
  soil: SoilTag;
  aspect: AspectTag;
};

const SOIL_NEEDLES: Record<Exclude<SoilTag, "any">, RegExp> = {
  clay: /clay/,
  loam: /loam|well-?drained|well drained/,
  sand: /sand|free-?drain/,
};

/** Map shade hours → preferred PlantSun order (best first). */
export function preferredSunForHours(sunHours: number): PlantSun[] {
  if (sunHours < 2) return ["shade", "partial"];
  if (sunHours < 4.5) return ["partial", "shade", "full"];
  return ["full", "partial"];
}

/** Aspect → preferred sun (south face ≈ fuller sun in AU temperate). */
export function preferredSunForAspect(aspect: AspectTag): PlantSun[] | null {
  switch (aspect) {
    case "S":
      return ["full", "partial"];
    case "N":
      return ["shade", "partial"];
    case "E":
    case "W":
      return ["partial", "full", "shade"];
    default:
      return null;
  }
}

export function soilTagFromCatalog(soil: string | undefined): SoilTag[] {
  if (!soil) return ["any"];
  const s = soil.toLowerCase();
  const tags: SoilTag[] = [];
  for (const [tag, re] of Object.entries(SOIL_NEEDLES) as Array<
    [Exclude<SoilTag, "any">, RegExp]
  >) {
    if (re.test(s)) tags.push(tag);
  }
  return tags.length ? tags : ["any"];
}

function sunOk(symSun: PlantSun | undefined, preferred: PlantSun[]): boolean {
  if (!symSun) return true;
  return preferred.includes(symSun);
}

/**
 * Soft-filter planting catalog symbols for the kit palette.
 * Non-planting symbols pass through unchanged.
 */
export function filterPlantingPalette(
  symbols: CatalogSymbol[],
  filter: PlantingPaletteFilter,
): CatalogSymbol[] {
  const byShade = preferredSunForHours(filter.sunHours);
  const byAspect = preferredSunForAspect(filter.aspect);
  const preferred = byAspect
    ? [...new Set([...byAspect, ...byShade])]
    : byShade;

  return symbols.filter((sym) => {
    if (sym.category !== "planting") return true;
    if (!sunOk(sym.sun, preferred)) return false;
    if (filter.soil === "any") return true;
    const tags = soilTagFromCatalog(sym.soil);
    if (tags.includes("any")) return true;
    return tags.includes(filter.soil);
  });
}

export const SOIL_TAG_LABELS: Record<SoilTag, string> = {
  any: "Any soil",
  clay: "Clay",
  loam: "Loam",
  sand: "Sand",
};

export const ASPECT_TAG_LABELS: Record<AspectTag, string> = {
  any: "Any aspect",
  N: "N face",
  E: "E face",
  S: "S face",
  W: "W face",
};
