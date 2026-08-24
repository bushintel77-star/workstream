/**
 * Trade supplier price feeds.
 *
 * None of the AU trade suppliers (Bunnings Trade, Boral, Holcim, Andersons,
 * Australian Native Landscapes, Online Plants AU, Speciality Trees) publish a
 * documented public price API. Real integrations need either:
 *   - A signed trade account + an adapter they approve (not ToS-breaking scrapers), or
 *   - Periodic email/PDF → JSON rate-sheet ingestion (ops drop files here).
 *
 * Honest modes:
 *   - `dev_fallback` — canned DEV rows (default).
 *   - `live` — only when SUPPLIERS_LIVE=true AND a per-supplier JSON sheet
 *     loads from SUPPLIERS_RATE_SHEET_DIR. Never claims live for canned rows.
 *
 * Sheet file: `{SUPPLIERS_RATE_SHEET_DIR}/{supplierId}.json`
 * Shape: `{ "fetched_at"?: iso, "prices": SupplierPrice[] }` or bare `SupplierPrice[]`.
 */

import { promises as fs } from "node:fs";
import { containedPath } from "./safe-path";

export type SupplierId =
  | "bunnings"
  | "boral"
  | "holcim"
  | "andersons"
  | "anl"
  | "online_plants_au"
  | "speciality_trees";

export type SupplierPrice = {
  sku: string;
  label: string;
  unit: string;
  rate: number; // AUD ex GST
  in_stock: boolean | null;
  source_url: string | null;
};

export type SupplierPriceList = {
  supplier: SupplierId;
  supplier_label: string;
  fetched_at: string;
  mode: "live" | "dev_fallback";
  /** How the list was resolved — never "live" for canned DEV. */
  feed: "rate_sheet" | "dev_canned";
  honesty: string;
  prices: SupplierPrice[];
};

const SUPPLIER_LABEL: Record<SupplierId, string> = {
  bunnings: "Bunnings Trade",
  boral: "Boral",
  holcim: "Holcim",
  andersons: "Anderson's Soils & Mulches",
  anl: "Australian Native Landscapes",
  online_plants_au: "Online Plants AU",
  speciality_trees: "Speciality Trees",
};

const DEV: Record<SupplierId, SupplierPrice[]> = {
  bunnings: [
    { sku: "BUN-CEM-20", label: "GP cement 20kg bag", unit: "ea", rate: 9.5, in_stock: true, source_url: null },
    { sku: "BUN-SAND-20", label: "Bedding sand 20kg", unit: "ea", rate: 7.95, in_stock: true, source_url: null },
    { sku: "BUN-MESH-F62", label: "F62 reinforcing mesh sheet", unit: "ea", rate: 78, in_stock: true, source_url: null },
  ],
  boral: [
    { sku: "BOR-32MPA-PUMP", label: "32 MPa concrete, pumped, ≥4m³", unit: "m3", rate: 365, in_stock: true, source_url: null },
    { sku: "BOR-25MPA", label: "25 MPa concrete, free-discharge", unit: "m3", rate: 285, in_stock: true, source_url: null },
  ],
  holcim: [
    { sku: "HOL-32MPA", label: "32 MPa concrete, free-discharge", unit: "m3", rate: 330, in_stock: true, source_url: null },
    { sku: "HOL-AGG-20", label: "20mm aggregate", unit: "t", rate: 78, in_stock: true, source_url: null },
  ],
  andersons: [
    { sku: "AND-TOP-BLEND", label: "Premium garden mix", unit: "m3", rate: 92, in_stock: true, source_url: null },
    { sku: "AND-MULCH-PINE", label: "Pine bark mulch, fine", unit: "m3", rate: 72, in_stock: true, source_url: null },
    { sku: "AND-COMPOST", label: "Mushroom compost", unit: "m3", rate: 88, in_stock: true, source_url: null },
  ],
  anl: [
    { sku: "ANL-DECO-BLU", label: "Bluestone deco 7mm", unit: "m3", rate: 145, in_stock: true, source_url: null },
    { sku: "ANL-SOIL-NAT", label: "Native garden mix", unit: "m3", rate: 88, in_stock: false, source_url: null },
  ],
  online_plants_au: [
    { sku: "OPL-LIR-140", label: "Liriope 'Just Right' 140mm", unit: "ea", rate: 8.75, in_stock: true, source_url: null },
    { sku: "OPL-LOM-TAN-140", label: "Lomandra Tanika 140mm", unit: "ea", rate: 10.5, in_stock: true, source_url: null },
    { sku: "OPL-BUX-200", label: "Buxus sempervirens 200mm", unit: "ea", rate: 22, in_stock: false, source_url: null },
  ],
  speciality_trees: [
    { sku: "SPT-CARP-PL24", label: "Carpinus 'Frans Fontaine' pleached 2.4m 100L", unit: "ea", rate: 480, in_stock: true, source_url: null },
    { sku: "SPT-PYR-CAP-100", label: "Pyrus 'Capital' 100L", unit: "ea", rate: 320, in_stock: true, source_url: null },
    { sku: "SPT-MAG-LG-100", label: "Magnolia 'Little Gem' 100L", unit: "ea", rate: 280, in_stock: false, source_url: null },
  ],
};

const DEV_HONESTY =
  "Dev-fallback canned Melbourne trade rates — not a live supplier feed. Set SUPPLIERS_LIVE=true and drop JSON sheets in SUPPLIERS_RATE_SHEET_DIR to go live.";

const LIVE_HONESTY =
  "Configured supplier rate sheet (SUPPLIERS_RATE_SHEET_DIR) — confirm with trade account before tender.";

export const ALL_SUPPLIERS: SupplierId[] = [
  "bunnings",
  "boral",
  "holcim",
  "andersons",
  "anl",
  "online_plants_au",
  "speciality_trees",
];

/** Gate: attempt rate-sheet adapters. Alone never makes canned rows "live". */
export function isSuppliersLiveEnabled(): boolean {
  return process.env.SUPPLIERS_LIVE === "true";
}

/** @deprecated Prefer isSuppliersLiveEnabled — name kept for older call sites. */
export function isSuppliersLive(): boolean {
  return isSuppliersLiveEnabled();
}

export function suppliersRateSheetDir(): string | null {
  const raw = process.env.SUPPLIERS_RATE_SHEET_DIR?.trim();
  return raw ? raw : null;
}

function isPriceRow(v: unknown): v is SupplierPrice {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.sku === "string" &&
    typeof o.label === "string" &&
    typeof o.unit === "string" &&
    typeof o.rate === "number" &&
    Number.isFinite(o.rate) &&
    o.rate >= 0 &&
    (o.in_stock === null || typeof o.in_stock === "boolean") &&
    (o.source_url === null || typeof o.source_url === "string")
  );
}

function parseSheetJson(
  raw: unknown,
): { prices: SupplierPrice[]; fetched_at: string | null } | null {
  if (Array.isArray(raw)) {
    const prices = raw.filter(isPriceRow);
    return prices.length > 0 ? { prices, fetched_at: null } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.prices)) return null;
  const prices = o.prices.filter(isPriceRow);
  if (prices.length === 0) return null;
  const fetched_at =
    typeof o.fetched_at === "string" && o.fetched_at.trim()
      ? o.fetched_at
      : null;
  return { prices, fetched_at };
}

export async function loadSupplierRateSheet(
  supplier: SupplierId,
  dir: string = suppliersRateSheetDir() ?? "",
): Promise<{ prices: SupplierPrice[]; fetched_at: string } | null> {
  if (!dir) return null;
  /* supplier is enum-checked by callers, but this function is the choke
   * point for the filesystem read — a doctored id must never escape the
   * configured rate-sheet dir. */
  const file = containedPath(dir, `${supplier}.json`);
  if (!file) return null;
  try {
    const text = await fs.readFile(file, "utf8");
    const parsed = parseSheetJson(JSON.parse(text) as unknown);
    if (!parsed) return null;
    return {
      prices: parsed.prices,
      fetched_at: parsed.fetched_at ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function cannedList(supplier: SupplierId): SupplierPriceList {
  return {
    supplier,
    supplier_label: SUPPLIER_LABEL[supplier],
    fetched_at: new Date().toISOString(),
    mode: "dev_fallback",
    feed: "dev_canned",
    honesty: DEV_HONESTY,
    prices: DEV[supplier],
  };
}

export async function fetchPrices(
  supplier: SupplierId,
): Promise<SupplierPriceList> {
  if (isSuppliersLiveEnabled()) {
    const sheet = await loadSupplierRateSheet(supplier);
    if (sheet) {
      return {
        supplier,
        supplier_label: SUPPLIER_LABEL[supplier],
        fetched_at: sheet.fetched_at,
        mode: "live",
        feed: "rate_sheet",
        honesty: LIVE_HONESTY,
        prices: sheet.prices,
      };
    }
  }
  // SUPPLIERS_LIVE alone must not flip mode — that lied when adapters were stubs.
  return cannedList(supplier);
}

/** Flatten live sheets for SKU overlay into costing / supplier_order. */
export async function collectLiveSupplierOverlayPrices(): Promise<{
  prices: Array<{ sku: string; rate: number; supplier_label: string }>;
  liveSuppliers: SupplierId[];
}> {
  if (!isSuppliersLiveEnabled() || !suppliersRateSheetDir()) {
    return { prices: [], liveSuppliers: [] };
  }
  const prices: Array<{ sku: string; rate: number; supplier_label: string }> =
    [];
  const liveSuppliers: SupplierId[] = [];
  for (const id of ALL_SUPPLIERS) {
    const list = await fetchPrices(id);
    if (list.mode !== "live") continue;
    liveSuppliers.push(id);
    for (const p of list.prices) {
      prices.push({
        sku: p.sku,
        rate: p.rate,
        supplier_label: list.supplier_label,
      });
    }
  }
  return { prices, liveSuppliers };
}

export function supplierFeedStatusSummary(lists: SupplierPriceList[]): {
  live_count: number;
  configured_dir: boolean;
  suppliers_live_flag: boolean;
  honesty: string;
} {
  const live_count = lists.filter((l) => l.mode === "live").length;
  const configured_dir = !!suppliersRateSheetDir();
  const suppliers_live_flag = isSuppliersLiveEnabled();
  let honesty = DEV_HONESTY;
  if (live_count > 0) {
    honesty = `${live_count}/${lists.length} suppliers on configured rate sheets.`;
  } else if (suppliers_live_flag && !configured_dir) {
    honesty =
      "SUPPLIERS_LIVE=true but SUPPLIERS_RATE_SHEET_DIR is unset — using canned fallback (not live).";
  } else if (suppliers_live_flag && configured_dir) {
    honesty =
      "SUPPLIERS_LIVE=true and rate-sheet dir set, but no valid {supplier}.json sheets loaded — using canned fallback (not live).";
  }
  return {
    live_count,
    configured_dir,
    suppliers_live_flag,
    honesty,
  };
}
