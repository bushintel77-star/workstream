import { itemFootprintMetres } from "@workstream/domain";
import { BY_TYPE, type StudioItem } from "../../studioCatalog";

export type SelectedItemReadout = {
  /** Short type name for the pill (e.g. "Bluestone"). */
  tag: string;
  /** Primary measurement string (area, length, or canopy diameter). */
  value: string;
};

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/**
 * SketchUp-style live readout for the selected symbol — reuses the same
 * footprint maths as the live measure ledger so the pill and the panel agree.
 */
export function describeSelectedItem(item: StudioItem): SelectedItemReadout {
  const def = BY_TYPE[item.t];
  const foot = itemFootprintMetres({
    wPx: def.w,
    hPx: def.h,
    scale: item.scale || 1,
    areaKind:
      def.area === "ellipse" ? "ellipse" : def.area === "rect" ? "rect" : "none",
    linear: Boolean(def.lin),
  });

  if (def.lin) {
    return { tag: def.tag, value: `${fmt(foot.perimeter_m)} m` };
  }
  if (def.canopyM || def.existing) {
    const canopy = (def.canopyM ?? 7) * (item.scale || 1);
    return { tag: def.tag, value: `⌀ ${fmt(canopy)} m` };
  }
  return { tag: def.tag, value: `${fmt(foot.area_m2)} m²` };
}
