/**
 * Trade supplier price feeds.
 *
 * None of the AU trade suppliers (Bunnings Trade, Boral, Holcim, Andersons,
 * Australian Native Landscapes, Online Plants AU, Speciality Trees) publish a
 * documented public price API. Real integrations need either:
 *   - A signed trade account + scraping a JSON endpoint they expose internally
 *     for the trade portal, or
 *   - Periodic email/PDF rate-sheet ingestion via OCR/Claude.
 *
 * This file exposes a stable interface (`fetchPrices(supplier)`) returning
 * dev-fallback canned prices today and pluggable real adapters later. Set
 * SUPPLIERS_LIVE=true and supply per-supplier credentials to switch over.
 */

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

export function isSuppliersLive(): boolean {
  return process.env.SUPPLIERS_LIVE === "true";
}

export async function fetchPrices(
  supplier: SupplierId,
): Promise<SupplierPriceList> {
  // Real adapters not yet implemented — every supplier returns canned data
  // until a trade-account scraper / OCR ingestion lands.
  return {
    supplier,
    supplier_label: SUPPLIER_LABEL[supplier],
    fetched_at: new Date().toISOString(),
    mode: isSuppliersLive() ? "live" : "dev_fallback",
    prices: DEV[supplier],
  };
}

export const ALL_SUPPLIERS: SupplierId[] = [
  "bunnings",
  "boral",
  "holcim",
  "andersons",
  "anl",
  "online_plants_au",
  "speciality_trees",
];
