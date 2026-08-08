import { urbanTreesToExistGhosts } from "@workstream/domain";
import type { StudioItem } from "../studioCatalog";
import { aiItemPrefix, mergeAiProposals } from "./studioAiEngine";
import type { StudioSnapshot } from "./studioTypes";
import type { CanvasMetresTransform } from "../geometry/geoToPct";
import { applyCanvasMetresTransform } from "../geometry/geoToPct";

export type UrbanTreeCanvasIn = {
  x: number;
  y: number;
  canopy_radius_m?: number | null;
  height_m?: number | null;
  label?: string | null;
};

/** Merge Vicmap urban tree points into exist ghosts (HITL review). */
export function mergeUrbanTreeGhosts(args: {
  snap: StudioSnapshot;
  trees: UrbanTreeCanvasIn[];
  transform: CanvasMetresTransform;
  boardWidthM: number;
  idn: number;
}): { snap: StudioSnapshot; idn: number; count: number } {
  if (args.trees.length === 0) {
    return { snap: args.snap, idn: args.idn, count: 0 };
  }
  const placements = urbanTreesToExistGhosts({
    trees: args.trees,
    boardWidthM: args.boardWidthM,
    toPct: (pt) => {
      const mapped = applyCanvasMetresTransform([pt], args.transform);
      return mapped[0] ?? { x: 50, y: 50 };
    },
  });
  const prefix = aiItemPrefix("vicmap_tree");
  const items: StudioItem[] = placements.map((p) => ({
    id: `${prefix}${crypto.randomUUID()}`,
    t: "exist" as const,
    x: p.x_pct,
    y: p.y_pct,
    rot: 0,
    scale: p.scale,
    ghost: true,
    why: p.reason,
    conf: p.confidence,
    stale: false,
    // First-class provenance — survives acceptance so every render surface
    // (plan, elevation, fit sheet, share) reads "Vicmap urban tree" not a
    // bare "Existing tree".
    source: "vicmap_tree" as const,
    // Persist the Vicmap LiDAR height so the elevation board draws the same
    // metres the plan tooltip reads. resolveItemHeightM treats an authored
    // exist-tree height as actual (not placement-scaled).
    ...(p.heightM != null && p.heightM > 0 ? { heightM: p.heightM } : {}),
  }));
  return {
    snap: {
      ...args.snap,
      items: mergeAiProposals(args.snap, items, ["vicmap_tree"]),
    },
    idn: args.idn + items.length,
    count: items.length,
  };
}
