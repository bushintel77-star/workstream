import type { BomLine, RateCard, SpatialObject } from "@workstream/contracts";

export type BomWorkerRequest = {
  type: "expand";
  requestId: string;
  spatial_facts: SpatialObject[];
  rate_card?: RateCard[];
};

export type BomWorkerResponse = {
  type: "expand_result";
  requestId: string;
  lines: BomLine[];
  totals: {
    subtotal: number;
    gst: number;
    total: number;
  };
};

export type ExpandBomResult = {
  lines: BomLine[];
  totals: BomWorkerResponse["totals"];
};
