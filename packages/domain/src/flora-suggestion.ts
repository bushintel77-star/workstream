/**
 * Canvas-First AI Plant Suggestion — deterministic Curtis botanical solver.
 * Workflow 1: indicative shade + municipality + height envelope (no PostGIS).
 */

import type { CatalogSymbol, PlantSun } from "@workstream/contracts";
import { CURTIS_DESIGN_ASSETS } from "./catalog-assets";
import {
  preferredSunForAspect,
  soilTagFromCatalog,
  type AspectTag,
  type SoilTag,
} from "./planting-palette-filter";
import { detectMunicipality, type Municipality } from "./planning-context";
import { isBlocklisted } from "./plant-rules";

export type SolarExposureBand = "deep_shade" | "dappled" | "full_sun";

export type FloraStudioForm =
  | "canopy"
  | "feature"
  | "hedge"
  | "bed"
  | "lawn";

export type FloraCandidate = {
  symbolId: string;
  label: string;
  botanicalName: string;
  sun: PlantSun;
  matureHeightM: number;
  canopySpreadM: number;
  studioForm: FloraStudioForm;
  /** 0–1 rank score after filters. */
  score: number;
  /** Why this ranked (UI microcopy). */
  why: string;
  /** Mid-winter plant-now vs hold for spring (AU temperate). */
  plantWindow: "plant_now" | "spring_hold";
  seasonNote: string;
};

export type RankFloraInput = {
  address: string;
  /** Indicative direct sun hours at the click cell (0–12). */
  sunHours: number;
  /** Accepted canopy / exist trees within ~8% of click. */
  nearbyCanopyCount?: number;
  /** Max mature height allowed (m); omit for no ceiling. */
  maxHeightM?: number;
  /** Prefer matches for the armed Add tool form. */
  preferredForm?: FloraStudioForm;
  /** Soft soil tag filter (clay / loam / sand). */
  soil?: SoilTag;
  /** Soft aspect tag filter (N/E/S/W). */
  aspect?: AspectTag;
  /** Calendar month 1–12 (defaults to now). */
  month?: number;
  /** Optional catalog override (tests). */
  symbols?: CatalogSymbol[];
};

const FORM_BY_SYMBOL: Record<string, FloraStudioForm> = {
  "hornbeam-pleached": "hedge",
  "lomandra-mass": "bed",
  "agapanthus-drift": "bed",
  "box-ball": "feature",
  "olive-standard": "canopy",
  "liriope-edge": "bed",
  "lawn-turf": "lawn",
  "existing-tree-retain": "canopy",
  "tree-root-protection": "canopy",
};

/** Default height envelope (m) when arming a planting Add tool. */
export const FLORA_HEIGHT_BY_FORM: Record<FloraStudioForm, number> = {
  canopy: 8,
  feature: 5,
  hedge: 2.5,
  bed: 1.5,
  lawn: 0.5,
};

export function isFloraStudioForm(t: string): t is FloraStudioForm {
  return (
    t === "canopy" ||
    t === "feature" ||
    t === "hedge" ||
    t === "bed" ||
    t === "lawn"
  );
}

function exposureBand(
  sunHours: number,
  nearbyCanopy: number,
): SolarExposureBand {
  const adjusted = Math.max(0, sunHours - nearbyCanopy * 1.2);
  if (adjusted < 2) return "deep_shade";
  if (adjusted < 4.5) return "dappled";
  return "full_sun";
}

function bandToSun(band: SolarExposureBand): PlantSun[] {
  switch (band) {
    case "deep_shade":
      return ["shade", "partial"];
    case "dappled":
      return ["partial", "shade", "full"];
    case "full_sun":
      return ["full", "partial"];
  }
}

function sunScore(symSun: PlantSun | undefined, preferred: PlantSun[]): number {
  if (!symSun) return 0.45;
  const idx = preferred.indexOf(symSun);
  if (idx === 0) return 1;
  if (idx === 1) return 0.72;
  if (idx === 2) return 0.45;
  return 0.15;
}

function inferForm(sym: CatalogSymbol): FloraStudioForm {
  if (FORM_BY_SYMBOL[sym.id]) return FORM_BY_SYMBOL[sym.id]!;
  const h = sym.mature_height_m ?? 1;
  const key = `${sym.id} ${sym.label} ${sym.keywords?.join(" ") ?? ""}`.toLowerCase();
  if (/hedge|pleach|screen/.test(key)) return "hedge";
  if (/lawn|turf/.test(key)) return "lawn";
  if (/tree|olive|canopy|standard/.test(key) || h >= 3) return "canopy";
  if (/sphere|feature|specimen|buxus/.test(key)) return "feature";
  return "bed";
}

function styleBoost(municipality: Municipality, sym: CatalogSymbol): number {
  const key = `${sym.id} ${sym.label} ${sym.description ?? ""}`.toLowerCase();
  // Inner Melbourne heritage / Victorian → layered ornamental
  if (municipality === "stonnington" || municipality === "yarra") {
    if (/hornbeam|hydrangea|acer|box|buxus|pleach/.test(key)) return 0.12;
    if (/lomandra|native|olive/.test(key)) return 0.08;
  }
  return 0;
}

function seasonality(
  month: number,
  form: FloraStudioForm,
): Pick<FloraCandidate, "plantWindow" | "seasonNote"> {
  // AU temperate: mid-winter (Jun–Aug) good for deciduous structure; tender hold
  const winter = month >= 6 && month <= 8;
  if (winter && (form === "canopy" || form === "hedge" || form === "feature")) {
    return {
      plantWindow: "plant_now",
      seasonNote: "Winter plant window — structure sets before spring flush",
    };
  }
  if (winter && form === "bed") {
    return {
      plantWindow: "spring_hold",
      seasonNote: "Hold mass planting for spring — soil still cold",
    };
  }
  return {
    plantWindow: "plant_now",
    seasonNote: "In-season for temperate Melbourne planting",
  };
}

/**
 * Rank top Curtis planting matches for a canvas click — deterministic filter after
 * environmental aggregation. Returns at most 3 candidates.
 */
export function rankCurtisFloraCandidates(
  input: RankFloraInput,
): FloraCandidate[] {
  const month = input.month ?? new Date().getMonth() + 1;
  const municipality = detectMunicipality(input.address);
  const nearby = input.nearbyCanopyCount ?? 0;
  const band = exposureBand(input.sunHours, nearby);
  const preferredSun = bandToSun(band);
  const maxH = input.maxHeightM ?? 12;
  const symbols = (input.symbols ?? CURTIS_DESIGN_ASSETS).filter(
    (s) => s.category === "planting",
  );

  const ranked: FloraCandidate[] = [];

  const soil = input.soil ?? "any";
  const aspect = input.aspect ?? "any";
  const aspectSun = preferredSunForAspect(aspect);
  const preferredMerged = aspectSun
    ? [...new Set([...aspectSun, ...preferredSun])]
    : preferredSun;

  for (const sym of symbols) {
    const botanical = sym.botanical_name ?? sym.label;
    if (isBlocklisted(botanical)) continue;
    // Soft gate: known blocklist only; house palette JSON may lag catalog ids
    const height = sym.mature_height_m ?? 1.5;
    if (height > maxH + 0.05) continue;

    if (soil !== "any") {
      const tags = soilTagFromCatalog(sym.soil);
      if (!tags.includes("any") && !tags.includes(soil)) continue;
    }

    const form = inferForm(sym);
    const season = seasonality(month, form);
    const sun = sunScore(sym.sun, preferredMerged);
    const waterBonus = sym.water === "low" ? 0.06 : 0;
    const formBonus =
      input.preferredForm && form === input.preferredForm ? 0.22 : 0;
    const score = Math.min(
      1,
      sun * 0.7 +
        styleBoost(municipality, sym) +
        waterBonus +
        formBonus +
        (season.plantWindow === "plant_now" ? 0.08 : 0) +
        (form === "bed" && band !== "full_sun" ? 0.04 : 0),
    );

    const bandLabel =
      band === "deep_shade"
        ? "Deep shade"
        : band === "dappled"
          ? "Dappled light"
          : "Full sun";

    ranked.push({
      symbolId: sym.id,
      label: sym.label,
      botanicalName: botanical,
      sun: sym.sun ?? preferredSun[0]!,
      matureHeightM: height,
      canopySpreadM: sym.default_width_m ?? Math.max(1, height * 0.6),
      studioForm: form,
      score,
      why: `${bandLabel} · ≤${maxH} m · ${municipality === "unknown" ? "temperate VIC" : municipality}`,
      ...season,
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  if (input.preferredForm) {
    const preferred = ranked.filter((c) => c.studioForm === input.preferredForm);
    if (preferred.length >= 1) {
      const rest = ranked.filter((c) => c.studioForm !== input.preferredForm);
      return [...preferred, ...rest].slice(0, 3);
    }
  }
  return ranked.slice(0, 3);
}

/** Sample indicative sun hours for a %-coord click on an 8×8 shade grid. */
export function sunHoursAtPct(
  xPct: number,
  yPct: number,
  cells: Array<{ col: number; row: number; sunHours: number }>,
  gridSize = 8,
): number {
  const col = Math.min(
    gridSize - 1,
    Math.max(0, Math.floor((xPct / 100) * gridSize)),
  );
  const row = Math.min(
    gridSize - 1,
    Math.max(0, Math.floor((yPct / 100) * gridSize)),
  );
  const cell = cells.find((c) => c.col === col && c.row === row);
  return cell?.sunHours ?? 6;
}

/** Lot-mean sun hours when no probe point is available. */
export function meanSunHours(
  cells: Array<{ sunHours: number }>,
): number {
  if (cells.length === 0) return 6;
  return cells.reduce((s, c) => s + c.sunHours, 0) / cells.length;
}

export function countNearbyCanopy(
  xPct: number,
  yPct: number,
  items: Array<{ t: string; x: number; y: number; ghost?: boolean }>,
  radiusPct = 8,
): number {
  return items.filter((i) => {
    if (i.ghost) return false;
    if (i.t !== "canopy" && i.t !== "exist" && i.t !== "feature") return false;
    return Math.hypot(i.x - xPct, i.y - yPct) <= radiusPct;
  }).length;
}
