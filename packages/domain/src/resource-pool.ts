import type { BomLine, LeftoverStock } from "@workstream/contracts";

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
