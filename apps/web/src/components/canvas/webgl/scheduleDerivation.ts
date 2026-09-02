import {
  boardWidthScale,
  buildLightingSchedule,
  buildPlantingSchedule,
  buildTrenchSchedule,
  getCatalogSymbol,
  TRANSFORMER_LOAD_FRACTION,
} from "@workstream/domain";
import type {
  CatalogPlacement,
  ConstructionTrench,
  IrrigationZone,
} from "@workstream/contracts";

/**
 * Schedule sheet derivation — every number is derived from board geometry
 * (placements, trenches, zones). Nothing here stores a value: the sheet is a
 * pure view, exactly as spec §9 (derived, never persisted, read-only).
 */

export type ScheduleTab = "planting" | "hardscape" | "services";

export interface PlantingSheetRow {
  code: string;
  name: string;
  pot: string;
  spread: number | null;
  qty: number;
}

export interface HardscapeSheetRow {
  code: string;
  name: string;
  spread: number | null;
  qty: number;
}

export interface TrenchSheetRow {
  name: string;
  kind: string;
  lengthM: number;
  depthBand: string;
  source: string;
}

export interface LightingSheetRow {
  label: string;
  count: number;
  watts: number;
  designVa: number;
  gauge: string;
  runM: number;
}

export interface DerivedScheduleSheet {
  planting: { rows: PlantingSheetRow[]; honesty: string };
  hardscape: { rows: HardscapeSheetRow[]; honesty: string };
  services: {
    trenches: TrenchSheetRow[];
    lighting: LightingSheetRow[];
    transformer: {
      designVa: number;
      capacityVa: number;
      overloaded: boolean;
    } | null;
    /** Honesty footers travel per section (trench vs lighting). */
    trenchHonesty: string;
    lightingHonesty: string;
    /** Footer for the tab: trench honesty when dig runs exist, else LV. */
    honesty: string;
  };
  totals: {
    softscapeCount: number;
    hardscapeCount: number;
    canopyLabel: string;
    objectCount: number;
  };
}

export const HARDSCAPE_HONESTY =
  "Indicative hardscape schedule from board placements — confirm set-out and quantities on site.";

export function deriveScheduleSheet(input: {
  placements: CatalogPlacement[];
  trenches: ConstructionTrench[];
  irrigationZones: IrrigationZone[];
  scaleM: number;
  canopy?: { provided: number; required: number } | null;
}): DerivedScheduleSheet {
  const planting = buildPlantingSchedule({ placements: input.placements });
  const trench = buildTrenchSchedule(
    { construction_trenches: input.trenches },
    boardWidthScale(input.scaleM),
  );
  const lighting = buildLightingSchedule(
    {
      placements: input.placements,
      irrigation_zones: input.irrigationZones,
      construction_trenches: input.trenches,
    },
    undefined,
    boardWidthScale(input.scaleM),
  );

  const plantingRows: PlantingSheetRow[] = planting.rows.map((r) => ({
    code: r.rate_card_sku ?? r.symbol_id.toUpperCase(),
    name: r.species,
    pot: r.pot_size_l != null ? `${r.pot_size_l} L` : r.pot_form,
    spread: r.spacing_m,
    qty: r.count,
  }));

  // Hardscape = paved materials placed on the board, grouped per symbol.
  const bySymbol = new Map<string, CatalogPlacement[]>();
  for (const p of input.placements) {
    if (getCatalogSymbol(p.symbol_id)?.category !== "paving") continue;
    const list = bySymbol.get(p.symbol_id);
    if (list) list.push(p);
    else bySymbol.set(p.symbol_id, [p]);
  }
  const hardscapeRows: HardscapeSheetRow[] = [...bySymbol.entries()]
    .map(([id, list]) => {
      const sym = getCatalogSymbol(id);
      return {
        code: id.toUpperCase(),
        name: sym?.label ?? id,
        spread: sym?.default_width_m ?? null,
        qty: list.length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en-AU"));

  const trenchRows: TrenchSheetRow[] = trench.rows.map((r) => ({
    name: r.name,
    kind: r.kind,
    lengthM: r.length_m,
    depthBand: r.depth_band,
    source: r.source,
  }));
  const lightingRows: LightingSheetRow[] = lighting.rows.map((r) => ({
    label: r.label,
    count: r.count,
    watts: r.watts_each,
    designVa: r.design_va,
    gauge: r.suggested_gauge,
    runM: r.run_length_m,
  }));
  const transformer =
    lighting.rows.length > 0
      ? {
          designVa: lighting.aggregate_design_va,
          capacityVa: lighting.transformer_va,
          // The one number allowed to turn red (spec 9.4 / domain lv-lighting).
          overloaded:
            lighting.aggregate_design_va >
            lighting.transformer_va * TRANSFORMER_LOAD_FRACTION,
        }
      : null;

  const softscapeCount = plantingRows.reduce((sum, r) => sum + r.qty, 0);
  const hardscapeCount = hardscapeRows.reduce((sum, r) => sum + r.qty, 0);
  const canopyLabel = input.canopy
    ? `${input.canopy.provided}/${input.canopy.required}`
    : "—";

  return {
    planting: { rows: plantingRows, honesty: planting.honesty },
    hardscape: { rows: hardscapeRows, honesty: HARDSCAPE_HONESTY },
    services: {
      trenches: trenchRows,
      lighting: lightingRows,
      transformer,
      trenchHonesty: trench.honesty,
      lightingHonesty: lighting.honesty,
      honesty: trenchRows.length > 0 ? trench.honesty : lighting.honesty,
    },
    totals: {
      softscapeCount,
      hardscapeCount,
      canopyLabel,
      objectCount: input.placements.length + input.trenches.length,
    },
  };
}
