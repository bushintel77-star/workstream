import type {
  CadDocument,
  CatalogSymbol,
  DesignCanvas,
  ProjectOrchestrationWorld,
  RateCard,
  Survey,
} from "@workstream/contracts";
import {
  bomTotals,
  expandPreemptiveBom,
  siteMultipliersFromSurvey,
} from "./preemptive-bom";
import { buildAcceptedMitigationLines } from "./mitigation-bom";
import { assessPreemptiveRisks } from "./preemptive-risk";
import {
  mergeSpatialFacts,
  spatialFactsFromCad,
  spatialFactsFromCanvas,
  spatialFingerprint,
} from "./spatial-facts";

export function buildOrchestrationWorld(args: {
  projectId: string;
  canvas: DesignCanvas | null | undefined;
  cad: CadDocument | null | undefined;
  symbols: CatalogSymbol[];
  rates: RateCard[];
  survey?: Survey | null;
  dismissedOverlayIds?: Iterable<string>;
  acceptedOverlayIds?: Iterable<string>;
  now?: string;
}): ProjectOrchestrationWorld {
  const dismissed = new Set(args.dismissedOverlayIds ?? []);
  const accepted = new Set(args.acceptedOverlayIds ?? []);
  const canvasFacts = spatialFactsFromCanvas(
    args.canvas,
    args.symbols,
    args.survey,
  );
  const cadFacts = spatialFactsFromCad(args.cad);
  const spatial_facts = mergeSpatialFacts(canvasFacts, cadFacts);
  const fingerprint = spatialFingerprint(spatial_facts);
  const multipliers = siteMultipliersFromSurvey(args.survey?.garden_area_m2);
  const baseBom = expandPreemptiveBom(spatial_facts, args.rates, multipliers);
  const { risks, overlays: rawOverlays } = assessPreemptiveRisks(
    spatial_facts,
    dismissed,
  );
  const overlays = rawOverlays.map((o) =>
    accepted.has(o.id) ? { ...o, status: "accepted" as const } : o,
  );
  const mitigation = buildAcceptedMitigationLines(overlays, args.rates);
  const mitIds = new Set(mitigation.map((l) => l.id));
  const live_bom = [
    ...baseBom.filter((l) => !mitIds.has(l.id)),
    ...mitigation,
  ];
  const { subtotal, gst, total } = bomTotals(live_bom);

  return {
    project_id: args.projectId,
    fingerprint,
    stale: false,
    running: false,
    updated_at: args.now ?? new Date().toISOString(),
    multipliers,
    spatial_facts,
    live_bom,
    bom_subtotal: subtotal,
    bom_gst: Math.round(gst * 100) / 100,
    bom_total: Math.round(total * 100) / 100,
    risks,
    overlays,
  };
}
