/**
 * Live existing-tree readout for the sticky Trees card.
 * Existing / protected trees are `t === "exist"` and not AI ghosts. When any
 * carry an authored DBH we flag indicative AS 4970-2025 NRZ.
 */

import { nrzRadiusFromDbhM } from "@workstream/domain";
import type { StudioItem } from "../../studioCatalog";

export type ExistTree = {
  id: string;
  x: number;
  y: number;
  dbhM: number | null;
  /** Indicative AS 4970-2025 NRZ radius (m) when DBH is known. */
  tpzRadiusM: number | null;
};

export type TreesLiveMeta = {
  count: number;
  /** Existing trees with an authored DBH — drive NRZ rings. */
  tpzCount: number;
  trees: ExistTree[];
  /** One-line face copy (no emoji — icon sits beside). */
  face: string;
  detail: string;
};

function tpzRadiusM(dbhM: number): number {
  return nrzRadiusFromDbhM(dbhM);
}

export function selectExistTrees(items: StudioItem[]): ExistTree[] {
  return items
    .filter((i) => i.t === "exist" && !i.ghost)
    .map((i) => {
      const dbhM =
        i.dbhM != null && Number.isFinite(i.dbhM) && i.dbhM > 0 ? i.dbhM : null;
      return {
        id: i.id,
        x: i.x,
        y: i.y,
        dbhM,
        tpzRadiusM: dbhM != null ? tpzRadiusM(dbhM) : null,
      };
    });
}

export function buildTreesLiveMeta(args: {
  items: StudioItem[];
}): TreesLiveMeta {
  const trees = selectExistTrees(args.items);
  const count = trees.length;
  const tpzCount = trees.filter((t) => t.dbhM != null).length;

  const face = `Trees · ${count}`;
  const detail =
    count === 0
      ? "No survey trees · Exist tool"
      : tpzCount > 0
        ? `${tpzCount} NRZ · AS 4970-2025`
        : "No DBH · survey to set NRZ";

  return { count, tpzCount, trees, face, detail };
}
