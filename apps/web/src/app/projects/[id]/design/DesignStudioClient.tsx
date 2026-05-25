"use client";

import type { CatalogSymbol } from "@workstream/contracts";
import { useSearchParams } from "next/navigation";
import { DesignStudio } from "../../../../components/DesignStudio";
import type { DesignCanvas, RateCardItem } from "../../../../lib/api";
import { useMediaQuery } from "../../../../hooks/useMediaQuery";

type Props = {
  projectId: string;
  projectAddress: string;
  aerialUri: string;
  lotRing: [number, number][];
  symbols: CatalogSymbol[];
  rateCard: RateCardItem[];
  canvas: DesignCanvas | null;
  tier1?: boolean;
};

/** Picks desktop CAD shell at ≥960px or ?studio=desktop. */
export function DesignStudioClient({
  projectId,
  projectAddress,
  aerialUri,
  lotRing,
  symbols,
  rateCard,
  canvas,
  tier1 = false,
}: Props) {
  const wide = useMediaQuery("(min-width: 960px)");
  const params = useSearchParams();
  const shellLayout = wide || params.get("studio") === "desktop" ? "desktop" : "legacy";

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
      shellLayout={shellLayout}
    />
  );
}
