/**
 * Architectural title block — Vicmap cadastral labels for the selected address.
 * Never invents CT / volume-folio numbers; only surfaces real parcel refs or honest fallbacks.
 */

import { detectMunicipality, type Municipality } from "./planning-context";

export type VicmapParcelAttrs = {
  /** Persistent feature id (PROP_PFI / PROPV_PFI). */
  pfi?: string | null;
  /** Council property number when present. */
  propNum?: string | null;
  /** Standard Parcel Identifier when present on the feature. */
  spi?: string | null;
  /** Vicmap LGA code (e.g. 363). */
  lgaCode?: string | null;
  /** Lot area from parcel geometry (m²). */
  lotAreaM2?: number | null;
  /**
   * Horizontal Positional Uncertainty (metres) when Vicmap supplies it.
   * Never invent — null when the attribute is absent.
   */
  hpuM?: number | null;
};

export type ArchitecturalTitleBlockInput = {
  address: string;
  /** Live Vicmap property_view attributes when fetch succeeded. */
  parcel?: VicmapParcelAttrs | null;
  /** Survey areas when a survey exists for the project. */
  survey?: {
    lot_area_m2?: number | null;
    garden_area_m2?: number | null;
    house_area_m2?: number | null;
  } | null;
  /** True when Vicmap WFS is enabled and returned a hit. */
  vicmapHit?: boolean;
};

export type ArchitecturalTitleBlock = {
  address: string;
  sourceKind: "vicmap" | "survey" | "indicative";
  sourceLabel: string;
  lotAreaM2: number | null;
  gardenAreaM2: number | null;
  houseAreaM2: number | null;
  councilLabel: string | null;
  municipality: Municipality;
  /** SPI preferred, else PFI — never a fabricated CT. */
  parcelRef: string | null;
  propNum: string | null;
  /** Compact header line e.g. "Vicmap · SPI 3\\LP… · Stonnington · 412 m²". */
  metaLine: string;
  /** Fit-sheet notes body opener. */
  notesLine: string;
  /** Vicmap HPU (m) when present — for honesty chip; null otherwise. */
  hpuM: number | null;
};

const LGA_NAMES: Record<string, string> = {
  "363": "Stonnington",
  "373": "Yarra",
  "318": "Melbourne",
  "343": "Port Phillip",
  "311": "Boroondara",
  "341": "Glen Eira",
  "361": "Bayside",
  "308": "Maribyrnong",
  "327": "Moonee Valley",
  "349": "Darebin",
  "357": "Moreland",
  "376": "Whitehorse",
};

function municipalityLabel(m: Municipality): string | null {
  if (m === "stonnington") return "City of Stonnington";
  if (m === "yarra") return "City of Yarra";
  return null;
}

function councilFromParcel(
  lgaCode: string | null | undefined,
  address: string,
): { councilLabel: string | null; municipality: Municipality } {
  const municipality = detectMunicipality(address);
  if (lgaCode && LGA_NAMES[lgaCode]) {
    return {
      councilLabel: `City of ${LGA_NAMES[lgaCode]}`,
      municipality:
        LGA_NAMES[lgaCode] === "Stonnington"
          ? "stonnington"
          : LGA_NAMES[lgaCode] === "Yarra"
            ? "yarra"
            : municipality,
    };
  }
  return {
    councilLabel: municipalityLabel(municipality),
    municipality,
  };
}

/**
 * Build Fit sheet / header title-block copy for the selected address.
 */
export function buildArchitecturalTitleBlock(
  input: ArchitecturalTitleBlockInput,
): ArchitecturalTitleBlock {
  const address = input.address.trim() || "Address pending";
  const parcel = input.parcel ?? null;
  const survey = input.survey ?? null;

  const lotAreaM2 =
    parcel?.lotAreaM2 && parcel.lotAreaM2 > 0
      ? Math.round(parcel.lotAreaM2)
      : survey?.lot_area_m2 && survey.lot_area_m2 > 0
        ? Math.round(survey.lot_area_m2)
        : null;
  const gardenAreaM2 =
    survey?.garden_area_m2 && survey.garden_area_m2 > 0
      ? Math.round(survey.garden_area_m2)
      : null;
  const houseAreaM2 =
    survey?.house_area_m2 && survey.house_area_m2 > 0
      ? Math.round(survey.house_area_m2)
      : null;

  const { councilLabel, municipality } = councilFromParcel(
    parcel?.lgaCode,
    address,
  );

  const spi = parcel?.spi?.trim() || null;
  const pfi = parcel?.pfi?.trim() || null;
  const propNum = parcel?.propNum?.trim() || null;
  const parcelRef = spi || pfi;

  const vicmapHit = Boolean(input.vicmapHit && (parcelRef || lotAreaM2));
  const sourceKind: ArchitecturalTitleBlock["sourceKind"] = vicmapHit
    ? "vicmap"
    : survey?.lot_area_m2
      ? "survey"
      : "indicative";

  const sourceLabel =
    sourceKind === "vicmap"
      ? "Vicmap Property · Land Vic"
      : sourceKind === "survey"
        ? "Survey parcel · confirm on title"
        : "Indicative parcel · confirm Vicmap / title";

  const hpuM =
    parcel?.hpuM != null && Number.isFinite(parcel.hpuM) && parcel.hpuM > 0
      ? parcel.hpuM
      : null;

  const parts: string[] = [];
  if (sourceKind === "vicmap") parts.push("Vicmap");
  else if (sourceKind === "survey") parts.push("Survey");
  else parts.push("Indicative");
  if (spi) parts.push(`SPI ${spi}`);
  else if (pfi) parts.push(`PFI ${pfi}`);
  if (propNum) parts.push(`Prop ${propNum}`);
  if (councilLabel) parts.push(councilLabel.replace(/^City of /, ""));
  if (lotAreaM2 != null) parts.push(`${lotAreaM2.toLocaleString("en-AU")} m²`);
  if (hpuM != null) {
    parts.push(`HPU ±${hpuM.toFixed(1)} m`);
  }

  const hpuNote =
    hpuM != null
      ? ` Boundary accuracy ±${hpuM.toFixed(1)} m (Vicmap HPU) — confirm on site.`
      : "";

  const notesLine =
    sourceKind === "vicmap"
      ? `${sourceLabel}${parcelRef ? ` · ${spi ? "SPI" : "PFI"} ${parcelRef}` : ""}${councilLabel ? ` · ${councilLabel}` : ""}. Dimensions in metres — working drawing, indicative only, not for construction.${hpuNote}`
      : `${sourceLabel}. Dimensions in metres — working drawing, indicative only, not for construction. Confirm on site / title / locate.`;

  return {
    address,
    sourceKind,
    sourceLabel,
    lotAreaM2,
    gardenAreaM2,
    houseAreaM2,
    councilLabel,
    municipality,
    parcelRef,
    propNum,
    metaLine: parts.join(" · "),
    notesLine,
    hpuM,
  };
}
