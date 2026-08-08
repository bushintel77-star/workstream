import {
  itemFootprintRingM,
  localMToPct,
} from "@workstream/domain";
import { BY_TYPE, type StudioItem } from "../studioCatalog";
import { buildSiteSchedule, closedExcludeRings } from "./polygon";
import type { PctPoint, SiteSchedule } from "./types";

/**
 * Rings that permanently consume the lot for the workable "Canvas Canvas":
 * easements, closed service corridors, and existing (non-proposed) structures.
 * Proposed paving/deck stay on the canvas — they do not shrink outdoor area.
 */
export function buildWorkableExcludeRings(args: {
  easements: PctPoint[][];
  services: PctPoint[][];
  items: StudioItem[];
  scaleM: number;
  boardAspect?: number;
}): PctPoint[][] {
  const aspect = args.boardAspect ?? 1;
  const fromPolys = closedExcludeRings([
    ...args.easements,
    ...args.services,
  ]);

  const fromExisting = args.items
    .filter((i) => !i.ghost && i.t === "exist")
    .map((i) => {
      const d = BY_TYPE[i.t];
      const ringM = itemFootprintRingM({
        x_pct: i.x,
        y_pct: i.y,
        wPx: d.w,
        hPx: d.h,
        scale: i.scale,
        scaleM: args.scaleM,
        boardAspect: aspect,
      });
      return ringM.map(([xM, yM]) => {
        const p = localMToPct(xM, yM, args.scaleM, aspect);
        return { x: p.x_pct, y: p.y_pct };
      });
    });

  return [...fromPolys, ...fromExisting];
}

/** Full site schedule with Turf workable outdoor (local metres origin). */
export function buildWorkableSiteSchedule(args: {
  boundary: PctPoint[];
  building: PctPoint[];
  easements: PctPoint[][];
  services: PctPoint[][];
  items: StudioItem[];
  scaleM: number;
  boardAspect?: number;
}): SiteSchedule {
  const exclude = buildWorkableExcludeRings({
    easements: args.easements,
    services: args.services,
    items: args.items,
    scaleM: args.scaleM,
    boardAspect: args.boardAspect,
  });
  return buildSiteSchedule(
    args.boundary,
    args.building,
    args.scaleM,
    args.boardAspect ?? 1,
    exclude,
  );
}
