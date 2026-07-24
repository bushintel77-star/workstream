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
import {
  CSS_TOKEN,
  mixOnCanvas,
  semanticForTheme,
} from "../../../../../../styles/colorTokens";

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
  const sem = semanticForTheme(night);
  const tone: SymbolTone = {
    night,
    ghost,
    stroke: night
      ? sem.plantingNewText
      : ink
        ? sem.textPrimary
        : sem.plantingNewStroke,
    fill: night
      ? mixOnCanvas(CSS_TOKEN.textPrimary, 6)
      : mixOnCanvas(CSS_TOKEN.plantingNewStroke, 14),
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
            stroke: night
              ? sem.plantingRetainText
              : sem.plantingRetainStroke,
            fill: "transparent",
          }}
        />
      );
    default:
      return null;
  }
});
