"use client";

import { useEffect, useMemo, useState } from "react";
import type { RateCard, SpatialObject } from "@workstream/contracts";
import { expandBomInWorker } from "./bom-worker-client";
import type { MutationHudSnapshot } from "./canvas-mutation-bus";

export type LiveBomPreview = {
  /** Precise total from worker (incl. GST), when available. */
  workerTotal: number | null;
  /** True while worker expand is in flight. */
  workerPending: boolean;
  /** Show skeletal pulse during optimistic / pending precise. */
  skeletal: boolean;
};

function factsKey(facts: SpatialObject[] | undefined): string {
  if (!facts?.length) return "";
  return facts
    .map(
      (f) =>
        `${f.id}:${f.layer}:${f.area_m2}:${f.length_m}:${f.volume_m3 ?? 0}:${f.count}`,
    )
    .join("|");
}

/**
 * Local financial preview via BOM web worker, coordinated with mutation bus.
 * MUTATING ? optimistic + skeletal; worker settle clears skeletal.
 */
export function useLiveBomPreview(
  spatialFacts: SpatialObject[] | undefined,
  mutationHud: MutationHudSnapshot,
  rateCard?: RateCard[],
): LiveBomPreview {
  const [workerTotal, setWorkerTotal] = useState<number | null>(null);
  const [workerPending, setWorkerPending] = useState(false);

  const mutating = mutationHud.phase === "MUTATING";
  const awaitingPrecise =
    mutationHud.phase === "RESOLVED" && mutationHud.pendingPrecise;
  const key = useMemo(() => factsKey(spatialFacts), [spatialFacts]);

  useEffect(() => {
    if (!key || (!mutating && !awaitingPrecise)) return;

    let cancelled = false;
    setWorkerPending(true);
    void expandBomInWorker(spatialFacts ?? [], rateCard)
      .then((result) => {
        if (cancelled) return;
        setWorkerTotal(result.totals.total);
        setWorkerPending(false);
      })
      .catch(() => {
        if (cancelled) return;
        setWorkerPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key, mutating, awaitingPrecise, spatialFacts, rateCard]);

  const skeletal = mutating || awaitingPrecise || workerPending;

  return { workerTotal, workerPending, skeletal };
}
