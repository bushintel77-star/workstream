"use client";

import type { CatalogSymbol } from "@workstream/contracts";
import { isTier1WrightsTerrace } from "@workstream/domain";
import { DesignStudio } from "../../../../components/DesignStudio";
import type { DesignCanvas, RateCardItem } from "../../../../lib/api";

type Props = {
  projectId: string;
  projectAddress: string;
  aerialUri: string;
  lotRing: [number, number][];
  symbols: CatalogSymbol[];
  rateCard: RateCardItem[];
  canvas: DesignCanvas | null;
  tier1?: boolean;
  surveyMetrics?: {
    garden_area_m2: number;
    lot_area_m2: number;
    house_area_m2: number;
    lat?: number | null;
    lng?: number | null;
  };
};

/** Single sketch surface for SiteCanvas — no nested desktop shell. */
export function DesignStudioClient({
  projectId,
  projectAddress,
  aerialUri,
  lotRing,
  symbols,
  rateCard,
  canvas,
  tier1: tier1Override,
  surveyMetrics,
}: Props) {
  const tier1 = tier1Override ?? isTier1WrightsTerrace(projectAddress);

  return (
    <DesignStudio
      projectId={projectId}
      projectAddress={projectAddress}
      aerialUri={aerialUri}
      lotRing={lotRing}
      symbols={symbols}
      rateCard={rateCard}
      tier1={tier1}
      initialPlacements={canvas?.placements ?? []}
      initialStrokes={
        canvas?.strokes?.map((st) => ({
          id: st.id,
          points: st.points,
          color: st.color,
          width_px: st.width_px,
        })) ?? []
      }
      initialIrrigationZones={canvas?.irrigation_zones ?? []}
      initialAnnotations={canvas?.annotations ?? []}
      surveyMetrics={surveyMetrics}
    />
  );
}
