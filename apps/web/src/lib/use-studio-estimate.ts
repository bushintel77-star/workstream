"use client";

import { useEffect, useMemo, useState } from "react";
import {
  estimateStudioDrawing,
  type StudioEstimateReport,
} from "@workstream/domain";
import { estimateStudioInWorker } from "./studio-estimate-worker-client";
import type { StudioEstimateArgs } from "./studio-estimate-worker-types";

export type StudioEstimatePreview = {
  /** Latest settled report (sync seed, then worker). */
  estimate: StudioEstimateReport;
  /** True while worker recompute is in flight. */
  settling: boolean;
};

function argsKey(args: StudioEstimateArgs): string {
  const items = args.items
    .map(
      (i) =>
        `${i.id}:${i.t}:${i.x.toFixed(2)}:${i.y.toFixed(2)}:${i.scale.toFixed(3)}:${i.ghost ? 1 : 0}`,
    )
    .join("|");
  const boundary = args.boundary
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(";");
  const trenches = (args.constructionTrenches ?? [])
    .filter((t) => !t.ghost)
    .map(
      (t) =>
        `${t.id}:${t.kind}:${t.points.map((p) => `${p.x_pct.toFixed(3)},${p.y_pct.toFixed(3)}`).join(";")}`,
    )
    .join("/");
  return `${args.outdoorM2.toFixed(2)}|${boundary}|${items}|${args.accessConstrained ? 1 : 0}|${trenches}`;
}

/**
 * Main-thread seed for instant HUD, then Web Worker settle for precise BOM.
 * Matches Canvas-First skeletal pulse while geometry is dragged.
 */
export function useStudioEstimate(
  args: StudioEstimateArgs,
): StudioEstimatePreview {
  const key = useMemo(() => argsKey(args), [args]);
  const sync = useMemo(() => estimateStudioDrawing(args), [args]);
  const [estimate, setEstimate] = useState(sync);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const seedId = window.setTimeout(() => {
      if (cancelled) return;
      setEstimate(sync);
      setSettling(true);
    }, 0);
    void estimateStudioInWorker(args)
      .then((report) => {
        if (cancelled) return;
        setEstimate(report);
        setSettling(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEstimate(sync);
        setSettling(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(seedId);
    };
    // key captures geometry identity; sync is the seed for this key
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key drives refresh
  }, [key]);

  return { estimate, settling };
}
