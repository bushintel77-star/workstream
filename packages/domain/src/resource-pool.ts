import type { BomLine, LeftoverStock } from "@workstream/contracts";

export type LeftoverProposalInput = {
  label: string;
  unit: string;
  qty: number;
  tier?: string;
};

export type LeftoverProposal = {
  orderQty: number;
  usedQty: number;
  sku: string;
  label: string;
  unit: string;
};

const SKIP_TIERS = new Set(["labour", "logistics", "fee"]);

function skuFromLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return (slug || "material").toUpperCase();
}

function shortLabel(label: string): string {
  return label.replace(/\s+[—-]\s+.+$/u, "").trim() || label;
}

/**
 * Workflow-1 pack sizes for Instant Planner leftover auto-register (PDF §4.6).
 * No catalog pack_size yet — ceil bulk stone/base/mulch/sand lines only.
 */
export function packSizeForMaterial(label: string, unit: string): number | null {
  const u = unit.toLowerCase().replace("³", "3");
  const l = label.toLowerCase();
  if (u === "t" || u === "tonne" || u === "tonnes") {
    if (/rock|stone|gravel|mulch|sand|base|bluestone|crushed/.test(l)) {
      return 1;
    }
  }
  if (u === "m3") {
    if (/mulch|soil|sand|bedding|compost/.test(l)) {
      return 1;
    }
  }
  return null;
}

/**
 * Propose leftover registrations from estimate / BOM material lines after a
 * commercial pack order (ceil to pack, register excess ≥ 0.05).
 */
export function proposeLeftoversFromEstimateLines(
  lines: LeftoverProposalInput[],
): LeftoverProposal[] {
  const out: LeftoverProposal[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (line.tier && SKIP_TIERS.has(line.tier)) continue;
    if (!(line.qty > 0)) continue;
    const pack = packSizeForMaterial(line.label, line.unit);
    if (pack == null) continue;
    const usedQty = Math.round(line.qty * 1000) / 1000;
    const orderQty = Math.ceil(usedQty / pack - 1e-9) * pack;
    if (orderQty - usedQty < 0.05) continue;
    const sku = skuFromLabel(line.label);
    if (seen.has(sku)) continue;
    seen.add(sku);
    const unitNorm = line.unit.toLowerCase() === "m3" ? "m³" : line.unit;
    out.push({
      orderQty: Math.round(orderQty * 1000) / 1000,
      usedQty,
      sku,
      label: shortLabel(line.label),
      unit: unitNorm,
    });
  }
  return out;
}

/** Register pack excess when ordered qty exceeds job need. */
export function registerLeftover(args: {
  orderQty: number;
  usedQty: number;
  sku: string;
  label: string;
  unit?: string;
  sourceProjectId?: string;
  ownerId?: string;
  idFactory?: () => string;
  now?: string;
}): LeftoverStock | null {
  const excess = args.orderQty - args.usedQty;
  if (excess < 0.05) return null;
  return {
    id: (args.idFactory ?? (() => crypto.randomUUID()))(),
    owner_id: args.ownerId ?? "dev-user",
    sku: args.sku,
    label: args.label,
    qty: Math.round(excess * 1000) / 1000,
    unit: args.unit ?? "t",
    source_project_id: args.sourceProjectId,
    created_at: args.now ?? new Date().toISOString(),
  };
}

export function matchLeftoversToNeed(
  leftovers: LeftoverStock[],
  needSku: string,
  needQty: number,
): LeftoverStock | null {
  if (needQty <= 0) return null;
  const matches = leftovers
    .filter((l) => l.sku === needSku && l.qty > 0)
    .sort((a, b) => b.qty - a.qty);
  const hit = matches.find((l) => l.qty + 1e-9 >= needQty * 0.25);
  return hit ?? null;
}

export type LeftoverBomMatch = {
  leftover: LeftoverStock;
  bom_line: BomLine;
  cover_qty: number;
};

/**
 * Match workspace leftovers against primary/secondary BOM material lines.
 * Prefers exact SKU, then label token overlap (stone / mulch / pave).
 */
export function matchLeftoversToBom(
  leftovers: LeftoverStock[],
  liveBom: BomLine[],
): LeftoverBomMatch | null {
  if (leftovers.length === 0 || liveBom.length === 0) return null;
  const materialLines = liveBom.filter(
    (l) =>
      (l.tier === "primary" || l.tier === "secondary") &&
      l.qty > 0 &&
      l.unit !== "hr" &&
      l.unit !== "hour",
  );
  for (const line of materialLines) {
    if (line.sku) {
      const hit = matchLeftoversToNeed(leftovers, line.sku, line.qty);
      if (hit) {
        return {
          leftover: hit,
          bom_line: line,
          cover_qty: Math.min(hit.qty, line.qty),
        };
      }
    }
    const label = line.label.toLowerCase();
    const fuzzy = leftovers.find((l) => {
      if (l.qty <= 0) return false;
      const ll = l.label.toLowerCase();
      const sku = l.sku.toLowerCase();
      return (
        (label.includes("stone") && (ll.includes("stone") || sku.includes("stone"))) ||
        (label.includes("mulch") && (ll.includes("mulch") || sku.includes("mulch"))) ||
        (label.includes("pav") &&
          (ll.includes("pav") || sku.includes("pave") || sku.includes("stone")))
      );
    });
    if (fuzzy) {
      return {
        leftover: fuzzy,
        bom_line: line,
        cover_qty: Math.min(fuzzy.qty, line.qty),
      };
    }
  }
  return null;
}
