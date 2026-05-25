import type { CatalogSymbol } from "@workstream/contracts";
import type { DesignCanvas, RateCardItem } from "../../../../lib/api";
import { DesignStudioClient } from "./DesignStudioClient";
import section from "./designStudioSection.module.css";

type Props = {
  projectId: string;
  projectAddress: string;
  aerialUri: string;
  lotRing: [number, number][];
  symbols: CatalogSymbol[];
  rateCard: RateCardItem[];
  canvas: DesignCanvas | null;
  surveyMetrics?: {
    garden_area_m2: number;
    lot_area_m2: number;
    house_area_m2: number;
    lat?: number | null;
    lng?: number | null;
  };
};

export function DesignStudioSection({
  projectId,
  projectAddress,
  aerialUri,
  lotRing,
  symbols,
  rateCard,
  canvas,
  surveyMetrics,
}: Props) {
  return (
    <section id="design-studio" className={section.wrap} aria-label="Design studio">
      <DesignStudioClient
        projectId={projectId}
        projectAddress={projectAddress}
        aerialUri={aerialUri}
        lotRing={lotRing}
        symbols={symbols}
        rateCard={rateCard}
        canvas={canvas}
        surveyMetrics={surveyMetrics}
      />
    </section>
  );
}
