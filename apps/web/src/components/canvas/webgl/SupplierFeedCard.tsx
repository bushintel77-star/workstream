"use client";

/**
 * Gold Standard 2026 — Supplier Feed card (trade sourcing readout).
 *
 * Wires GET /suppliers into the UI — the live/dev trade price feeds (Bunnings
 * Trade, Boral, Holcim, Andersons, ANL, Online Plants AU, Speciality Trees),
 * the feed-status summary (live vs dev fallback, configured dir, honesty
 * statement), and the Melbourne trade catalog headline.
 *
 * This is the operator's sourcing view: what a trade SKU costs ex GST, whether
 * the feed is live or canned, and what the catalog actually contains. Never
 * claims live for canned rows — the API's honesty field is rendered verbatim.
 *
 * Mounted in the studio right dock alongside the Fit sheet.
 */

import { useCallback, useEffect, useState } from "react";
import type { SupplierFeedResponse, SupplierPrice } from "../../../lib/api";
import { GlassCard } from "./GlassCard";

const AUD = (v: number) =>
  v.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  });

function PriceRow({ p }: { p: SupplierPrice }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 8,
        padding: "3px 0",
        borderTop: "1px solid var(--gs-line)",
        fontSize: "var(--gs-font-xs)",
      }}
    >
      <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
        {p.sku} · {p.label}
      </span>
      <span style={{ fontFamily: "var(--font-tech)", color: "var(--la-ink-secondary)", whiteSpace: "nowrap" }}>
        {AUD(p.rate)}/{p.unit}
        {p.in_stock != null ? (
          <span style={{ marginLeft: 6, color: p.in_stock ? "var(--la-ink-secondary)" : "var(--gs-conflict)" }}>
            {p.in_stock ? "· in stock" : "· low stock"}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function SupplierBlock({
  supplier,
}: {
  supplier: SupplierFeedResponse["suppliers"][number];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          width: "100%",
          border: "none",
          background: "none",
          padding: "5px 0",
          cursor: "pointer",
          fontFamily: "var(--font-ui)",
          fontSize: "var(--gs-font-xs)",
          color: "var(--la-ink)",
          textAlign: "left",
        }}
      >
        <span>{supplier.supplier_label}</span>
        <span style={{ fontFamily: "var(--font-tech)", color: "var(--la-ink-muted)" }}>
          {open ? "▾" : "▸"} {supplier.prices.length} SKUs ·{" "}
          {supplier.mode === "live" ? "live" : "dev"}
        </span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "var(--gs-font-micro)", color: "var(--la-ink-muted)", padding: "2px 0 4px" }}>
            {supplier.honesty}
          </div>
          {supplier.prices.map((p) => (
            <PriceRow key={`${supplier.supplier}-${p.sku}`} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SupplierFeedCard() {
  const [feed, setFeed] = useState<SupplierFeedResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // Server action — lib/api.ts is server-only, so the client never
      // imports it directly (Client Component import would break the bundle).
      const { getSupplierFeedAction } = await import("../../../app/actions");
      const data = await getSupplierFeedAction();
      if (!data) throw new Error("Supplier feed returned no data");
      setFeed(data as SupplierFeedResponse);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stockRisk =
    feed?.suppliers.reduce(
      (n, s) => n + s.prices.filter((p) => p.in_stock === false).length,
      0,
    ) ?? 0;

  return (
    <div data-testid="supplier-feed-card" style={{ pointerEvents: "none" }}>
      <GlassCard style={{ position: "relative", width: 280, padding: 12 }}>
        <div style={{ fontSize: "var(--gs-font-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--la-ink-secondary)", marginBottom: 8 }}>
          Trade sourcing
        </div>
        {busy ? (
          <div style={{ fontSize: "var(--gs-font-xs)", color: "var(--la-ink-muted)" }}>Loading supplier feeds…</div>
        ) : error ? (
          <div style={{ fontSize: "var(--gs-font-xs)", color: "var(--gs-conflict)" }}>Feed unavailable: {error}</div>
        ) : feed ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: "var(--gs-font-xs)" }}>
              <span>{feed.status.live_count}/{feed.suppliers.length} suppliers live</span>
              <span data-testid="supplier-stock-risk" style={{ fontFamily: "var(--font-tech)", color: stockRisk > 0 ? "var(--gs-conflict)" : "var(--la-ink-secondary)" }}>
                {stockRisk > 0 ? `${stockRisk} low-stock SKU${stockRisk === 1 ? "" : "s"}` : "all stocked"}
              </span>
            </div>
            <div style={{ fontSize: "var(--gs-font-micro)", color: "var(--la-ink-muted)" }}>
              {feed.status.honesty}
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
              {feed.suppliers.map((s) => (
                <SupplierBlock key={s.supplier} supplier={s} />
              ))}
            </div>
            {feed.melbourne_trade_catalog.offer_count > 0 && (
              <div style={{ borderTop: "1px solid var(--gs-line)", marginTop: 6, paddingTop: 6, fontSize: "var(--gs-font-xs)", color: "var(--la-ink-secondary)" }}>
                Melbourne trade catalog · {feed.melbourne_trade_catalog.offer_count} offers
                <div style={{ fontSize: "var(--gs-font-micro)", color: "var(--la-ink-muted)" }}>
                  {feed.melbourne_trade_catalog.honesty}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </GlassCard>
    </div>
  );
}
