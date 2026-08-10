/**
 * Live/ingested supplier rate-sheet overlay — applies real trade prices
 * (read from an uploaded rate sheet, never fake/dev-canned data) onto the
 * rate card and onto already-costed quote lines, by exact SKU match only.
 * Everything that isn't matched keeps its existing rate card price — this
 * never invents a number for a SKU it hasn't actually seen.
 */

import type { LineItem, RateCard } from "@workstream/contracts";

export type SupplierOverlayPrice = {
  sku: string;
  rate: number;
  supplier_label: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const OVERLAY_HONESTY_APPLIED =
  "Live supplier rate sheet applied to matching SKUs — everything else is rate card.";
const OVERLAY_HONESTY_NONE =
  "Rate card only — no live supplier rate sheet matched.";

/**
 * Overlay live prices onto the rate card used for costing. Only rows whose
 * SKU exactly matches an ingested rate-sheet entry are replaced.
 */
export function overlayRateCardWithSupplierPrices(
  rates: RateCard[],
  overlay: SupplierOverlayPrice[],
): { rates: RateCard[]; applied: number; honesty: string } {
  if (overlay.length === 0) {
    return { rates, applied: 0, honesty: OVERLAY_HONESTY_NONE };
  }
  const bySku = new Map(overlay.map((o) => [o.sku, o] as const));
  let applied = 0;
  const next = rates.map((r) => {
    const hit = bySku.get(r.sku);
    if (!hit) return r;
    applied += 1;
    return { ...r, rate: round2(hit.rate) };
  });
  return {
    rates: next,
    applied,
    honesty: applied > 0 ? OVERLAY_HONESTY_APPLIED : OVERLAY_HONESTY_NONE,
  };
}

/**
 * Overlay live prices onto already-costed quote lines (used for the
 * supplier_order pack). Recomputes `total` for any overlaid line so the
 * order sheet's dollar figures stay consistent with the swapped rate.
 */
export function overlayQuoteLinesWithSupplierPrices(
  lines: LineItem[],
  overlay: SupplierOverlayPrice[],
): { lines: LineItem[]; applied: number; honesty: string } {
  if (overlay.length === 0) {
    return { lines, applied: 0, honesty: OVERLAY_HONESTY_NONE };
  }
  const bySku = new Map(overlay.map((o) => [o.sku, o] as const));
  let applied = 0;
  const next = lines.map((line) => {
    const hit = bySku.get(line.sku);
    if (!hit) return line;
    applied += 1;
    const rate = round2(hit.rate);
    return { ...line, rate, total: round2(rate * line.qty) };
  });
  return {
    lines: next,
    applied,
    honesty: applied > 0 ? OVERLAY_HONESTY_APPLIED : OVERLAY_HONESTY_NONE,
  };
}
