/// <reference lib="webworker" />

import {
  bomTotals,
  DEFAULT_SITE_MULTIPLIERS,
  expandPreemptiveBom,
} from "@workstream/domain";
import type {
  BomWorkerRequest,
  BomWorkerResponse,
} from "../lib/bom-worker-types";

/**
 * Off-main-thread BOM expand. Domain BOM helpers are pure (no Node APIs).
 */
const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<BomWorkerRequest>) => {
  const msg = event.data;
  if (!msg || msg.type !== "expand") return;

  const lines = expandPreemptiveBom(
    msg.spatial_facts,
    msg.rate_card ?? [],
    DEFAULT_SITE_MULTIPLIERS,
  );
  const totals = bomTotals(lines);
  const response: BomWorkerResponse = {
    type: "expand_result",
    requestId: msg.requestId,
    lines,
    totals,
  };
  ctx.postMessage(response);
};

export {};
