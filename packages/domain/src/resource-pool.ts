import type { LeftoverStock } from "@workstream/contracts";

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
