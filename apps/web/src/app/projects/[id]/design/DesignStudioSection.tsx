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
};

export function DesignStudioSection({
  projectId,
  projectAddress,
  aerialUri,
  lotRing,
  symbols,
  rateCard,
  canvas,
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
      />
    </section>
  );
}
