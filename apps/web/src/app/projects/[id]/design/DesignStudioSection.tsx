import type { CatalogSymbol } from "@workstream/contracts";
import { DesignStudio } from "../../../../components/DesignStudio";
import type { DesignCanvas, RateCardItem } from "../../../../lib/api";
import section from "./designStudioSection.module.css";

type Props = {
  projectId: string;
  aerialUri: string;
  lotRing: [number, number][];
  symbols: CatalogSymbol[];
  rateCard: RateCardItem[];
  canvas: DesignCanvas | null;
};

export function DesignStudioSection({
  projectId,
  aerialUri,
  lotRing,
  symbols,
  rateCard,
  canvas,
}: Props) {
  return (
    <section id="design-studio" className={section.wrap} aria-label="Design studio">
      <DesignStudio
        projectId={projectId}
        aerialUri={aerialUri}
        lotRing={lotRing}
        symbols={symbols}
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
        rateCard={rateCard}
      />
    </section>
  );
}
