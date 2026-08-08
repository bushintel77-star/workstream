import type { BomLine, OverlayProposal, RateCard } from "@workstream/contracts";
import { calculateLineTotal } from "./costing";

function rateFor(
  rates: RateCard[],
  ...candidates: string[]
): { sku: string | null; rate: number; label: string } {
  for (const c of candidates) {
    const hit = rates.find(
      (r) =>
        r.sku.toLowerCase() === c.toLowerCase() ||
        r.label.toLowerCase().includes(c.toLowerCase()),
    );
    if (hit) return { sku: hit.sku, rate: hit.rate, label: hit.label };
  }
  return { sku: null, rate: 45, label: candidates[0] ?? "Mitigation" };
}

/**
 * Schedule lines for accepted mitigation overlays (Live BOM).
 * TRP → fencing lm; drainage → allowance; engineer hold → fee note.
 */
export function buildAcceptedMitigationLines(
  overlays: OverlayProposal[],
  rates: RateCard[] = [],
): BomLine[] {
  const accepted = overlays.filter((o) => o.status === "accepted");
  const lines: BomLine[] = [];

  for (const ov of accepted) {
    if (ov.kind === "trp_ring") {
      const r = ov.radius_m ?? 3;
      const qty = Math.round(2 * Math.PI * r * 100) / 100;
      const rate = rateFor(rates, "TRP-TPZ", "tree protection", "fencing");
      lines.push({
        id: `mit-trp-${ov.id}`,
        tier: "secondary",
        sku: rate.sku,
        label: "Tree protection fencing / TPZ",
        unit: "lm",
        qty,
        rate: rate.rate,
        total: calculateLineTotal(qty, rate.rate),
        source_object_ids: ov.source_object_ids,
        notes: "Accepted mitigation — AS 4970 TPZ fence",
        is_provisional: true,
      });
      continue;
    }
    if (ov.kind === "drainage") {
      const rate = rateFor(rates, "DRAIN-ALLOW", "drainage", "ag drain");
      const qty = 1;
      lines.push({
        id: `mit-drain-${ov.id}`,
        tier: "secondary",
        sku: rate.sku,
        label: "Stormwater / drainage allowance",
        unit: "ea",
        qty,
        rate: rate.rate,
        total: calculateLineTotal(qty, rate.rate),
        source_object_ids: ov.source_object_ids,
        notes: "Accepted mitigation — impermeable surface threshold",
        is_provisional: true,
      });
      continue;
    }
    if (ov.kind === "engineer_hold") {
      const rate = rateFor(rates, "ENG-FEE", "engineer", "structural");
      const qty = 1;
      lines.push({
        id: `mit-eng-${ov.id}`,
        tier: "fee",
        sku: rate.sku,
        label: "Structural engineer hold",
        unit: "ea",
        qty,
        rate: Math.max(rate.rate, 850),
        total: calculateLineTotal(qty, Math.max(rate.rate, 850)),
        source_object_ids: ov.source_object_ids,
        notes: "Accepted mitigation — retaining >1.2 m",
        is_provisional: true,
      });
    }
  }

  return lines;
}
