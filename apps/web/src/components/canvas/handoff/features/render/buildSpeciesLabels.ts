import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import { isSpeciesSymbolType } from "./symbols/SpeciesSymbol";
import type { LabelCandidate } from "./speciesLabels";

/**
 * Build LOD label candidates from plan items.
 * Mass beds collapse to one count label at the centroid.
 */
export function buildSpeciesLabelCandidates(
  items: StudioItem[],
): LabelCandidate[] {
  const plants = items.filter(
    (it) => !it.ghost && isSpeciesSymbolType(it.t),
  );
  const beds = plants.filter((it) => it.t === "bed");
  const others = plants.filter((it) => it.t !== "bed");
  const out: LabelCandidate[] = [];

  for (const it of others) {
    const d = BY_TYPE[it.t];
    const span = d.canopyM ?? d.heightM ?? Math.max(d.w, d.h) / 12;
    const metre = typeof span === "number" ? span : 4;
    out.push({
      id: it.id,
      xPct: it.x,
      yPct: it.y,
      text: `${d.name} · ${Math.round(metre * it.scale)}`,
      // screenPx filled by caller with ppm
      screenPx: metre * it.scale,
    });
  }

  if (beds.length > 0) {
    const cx = beds.reduce((s, b) => s + b.x, 0) / beds.length;
    const cy = beds.reduce((s, b) => s + b.y, 0) / beds.length;
    const d = BY_TYPE.bed;
    const spanM = Math.max(d.w, d.h) / 14;
    out.push({
      id: `mass:${beds.map((b) => b.id).sort().join("+")}`,
      xPct: cx,
      yPct: cy,
      text: `${d.name} · ${beds.length}`,
      screenPx: spanM,
    });
  }

  return out;
}

/** Convert canopy-metres candidates to screen px using ppm. */
export function withScreenPx(
  candidates: LabelCandidate[],
  ppm: number,
): LabelCandidate[] {
  return candidates.map((c) => ({
    ...c,
    screenPx: c.screenPx * ppm,
  }));
}
