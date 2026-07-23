"use client";

import { memo } from "react";
import type { StudioItemType } from "../../../studioCatalog";
import {
  CanopyTreeSymbol,
  ExistingTreeSymbol,
  FeatureCycasSymbol,
  HedgeSymbol,
  MassPlantingSymbol,
  PleachedHornbeamSymbol,
  type SymbolTone,
} from "./speciesSymbols";

const PLANT_TYPES = new Set<StudioItemType>([
  "canopy",
  "feature",
  "hedge",
  "bed",
  "exist",
]);

export function isSpeciesSymbolType(t: StudioItemType): boolean {
  return PLANT_TYPES.has(t);
}

/**
 * Presentation species symbol — memoised per item id + visual props.
 * Pleached uses canopy when label/tag hints at pleaching; otherwise lobed canopy.
 */
export const SpeciesSymbol = memo(function SpeciesSymbol({
  type,
  itemId,
  night,
  ghost,
  ink,
  label,
}: {
  type: StudioItemType;
  itemId: string;
  night: boolean;
  ghost: boolean;
  ink: boolean;
  label?: string;
}) {
  const tone: SymbolTone = {
    night,
    ghost,
    stroke: night
      ? "rgba(236,239,244,0.82)"
      : ink
        ? "#5A4650"
        : "#5F7A50",
    fill: night ? "rgba(236,239,244,0.06)" : "rgba(122,150,112,0.14)",
  };

  const pleached =
    type === "canopy" &&
    Boolean(label && /pleach/i.test(label));

  switch (type) {
    case "canopy":
      return pleached ? (
        <PleachedHornbeamSymbol itemId={itemId} tone={tone} />
      ) : (
        <CanopyTreeSymbol itemId={itemId} tone={tone} />
      );
    case "feature":
      return <FeatureCycasSymbol itemId={itemId} tone={tone} />;
    case "hedge":
      return <HedgeSymbol itemId={itemId} tone={tone} />;
    case "bed":
      return <MassPlantingSymbol itemId={itemId} tone={tone} />;
    case "exist":
      return (
        <ExistingTreeSymbol
          itemId={itemId}
          tone={{
            ...tone,
            stroke: night ? "rgba(236,239,244,0.55)" : "#5A4650",
            fill: "transparent",
          }}
        />
      );
    default:
      return null;
  }
});
