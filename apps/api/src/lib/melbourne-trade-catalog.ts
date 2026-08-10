/**
 * Melbourne trade hub catalog loader.
 *
 * Bundled cache lives in @workstream/domain (MELBOURNE_TRADE_CATALOG).
 * Ops can override with a JSON file at MELBOURNE_TRADE_CATALOG_PATH —
 * same offer shape, no nursery scrapers / public APIs required.
 */

import { promises as fs } from "node:fs";
import type {
  MelbourneTradeOffer,
  TradeCatalogSource,
  TradeHubId,
} from "@workstream/domain";
import { MELBOURNE_TRADE_CATALOG } from "@workstream/domain";

const HUB_IDS = new Set<TradeHubId>([
  "plantmark_wantirna",
  "plantmark_thomastown",
  "dinsan_dingley",
  "warners",
  "speciality_trees",
  "lilydale_lawn",
  "anco",
  "soilco",
  "anl",
]);

function isOffer(v: unknown): v is MelbourneTradeOffer {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.hubId === "string" &&
    HUB_IDS.has(o.hubId as TradeHubId) &&
    typeof o.hubLabel === "string" &&
    typeof o.sku === "string" &&
    typeof o.label === "string" &&
    typeof o.botanicalOrSpec === "string" &&
    typeof o.container === "string" &&
    typeof o.unit === "string" &&
    typeof o.wholesaleExGst === "number" &&
    Number.isFinite(o.wholesaleExGst) &&
    typeof o.inStock === "boolean" &&
    typeof o.hubKmFromPrahran === "number" &&
    Array.isArray(o.studioTypes) &&
    o.studioTypes.every((t) => typeof t === "string")
  );
}

export type ResolvedTradeCatalog = {
  offers: MelbourneTradeOffer[];
  source: TradeCatalogSource;
  path: string | null;
  honesty: string;
};

export function melbourneTradeCatalogPath(): string | null {
  const raw = process.env.MELBOURNE_TRADE_CATALOG_PATH?.trim();
  return raw ? raw : null;
}

export async function loadMelbourneTradeCatalog(): Promise<ResolvedTradeCatalog> {
  const filePath = melbourneTradeCatalogPath();
  if (!filePath) {
    return {
      offers: MELBOURNE_TRADE_CATALOG,
      source: "bundled_cache",
      path: null,
      honesty:
        "Bundled Melbourne trade hub cache — not a live nursery API. Set MELBOURNE_TRADE_CATALOG_PATH to a JSON offer array for ops sync.",
    };
  }
  try {
    const text = await fs.readFile(filePath, "utf8");
    const raw = JSON.parse(text) as unknown;
    const list = Array.isArray(raw)
      ? raw
      : raw &&
          typeof raw === "object" &&
          Array.isArray((raw as { offers?: unknown }).offers)
        ? (raw as { offers: unknown[] }).offers
        : null;
    if (!list) {
      return {
        offers: MELBOURNE_TRADE_CATALOG,
        source: "bundled_cache",
        path: filePath,
        honesty: `MELBOURNE_TRADE_CATALOG_PATH invalid JSON shape at ${filePath} — using bundled cache.`,
      };
    }
    const offers = list.filter(isOffer);
    if (offers.length === 0) {
      return {
        offers: MELBOURNE_TRADE_CATALOG,
        source: "bundled_cache",
        path: filePath,
        honesty: `MELBOURNE_TRADE_CATALOG_PATH had no valid offers at ${filePath} — using bundled cache.`,
      };
    }
    return {
      offers,
      source: "configured",
      path: filePath,
      honesty:
        "Configured Melbourne trade catalog (MELBOURNE_TRADE_CATALOG_PATH) — confirm stock with nursery before order.",
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "read failed";
    return {
      offers: MELBOURNE_TRADE_CATALOG,
      source: "bundled_cache",
      path: filePath,
      honesty: `MELBOURNE_TRADE_CATALOG_PATH unreadable (${detail}) — using bundled cache.`,
    };
  }
}
