"use client";

/**
 * Gold Standard 2026 — Asset Fan-Out Dock (discovery palette).
 *
 * The Gap 5 discovery instrument: a bottom-docked fan-out of asset cards
 * (Stitch phase_1.1 idiom). Picking a card arms the symbol — the operator
 * then clicks the lot and AssetPlaceLayer mints the placement. Cards are
 * also draggable onto the canvas. Botanical metadata comes from the real
 * catalog ("never invented"); the selected card takes the gold treatment.
 *
 * Two faces, one dock: the curated eight are the resting face, and the
 * wider catalog arrives through the search box or a category chip. The
 * strip never becomes a wall — results scroll horizontally inside the
 * dock's own max-width and are capped at MAX_DOCK_RESULTS, so the dock's
 * footprint is identical whether it is showing eight cards or a hundred
 * (webgl-chrome-collision.spec.ts gates that).
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (Asset Discovery Fan-Out)
 */

import { useEffect, useMemo, useState } from "react";
import { useStudioStore } from "./studioStore";
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABEL,
  buildAssetPalette,
  buildCatalogAssetPalette,
  filterAssetPalette,
  MAX_DOCK_RESULTS,
  type AssetPaletteCategory,
  type AssetPaletteEntry,
} from "./assetPalette";
import { MASS_PLANT_NOTICE_REF } from "./inspectorPolicy";
import { Button } from "./Button";
import { Input } from "./Field";


const GOLD = "var(--gs-primary)";
const SYMBOL_MIME = "application/x-workstream-symbol";

function AssetCard({
  entry,
  active,
  onPick,
}: {
  entry: AssetPaletteEntry;
  active: boolean;
  onPick: () => void;
}) {
  const tooltip = [
    entry.label,
    entry.botanicalName,
    entry.heightM != null
      ? `H ${entry.heightM.toFixed(1)}${entry.spreadM != null ? ` · R ${entry.spreadM.toFixed(1)}` : ""}`
      : null,
    "Click to arm · Drag onto lot",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Button
      variant="asset-card"
      active={active}
      aria-pressed={active}
      draggable
      data-testid={`asset-card-${entry.symbolId}`}
      title={tooltip}
      style={{
        flex: "0 0 auto",
        width: active ? 80 : 68,
        minHeight: active ? 56 : 48,
        flexDirection: "row",
        gap: "var(--gs-space-2)",
        padding: "5px 8px",
        justifyContent: "flex-start",
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData(SYMBOL_MIME, entry.symbolId);
        e.dataTransfer.setData("text/plain", entry.symbolId);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={onPick}
    >
      {active && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: 2,
            borderRadius: "10px 10px 0 0",
            background: GOLD,
            opacity: 0.6,
          }}
        />
      )}
      <span
        style={{
          fontSize: active ? 18 : 15,
          lineHeight: 1,
          color: active ? GOLD : "var(--gs-ink-secondary)",
          flex: "0 0 auto",
        }}
        aria-hidden
      >
        {entry.glyph}
      </span>
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: "var(--gs-font-xs)",
          fontWeight: 600,
          color: "var(--gs-ink)",
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {entry.label}
      </span>
      {active && (
        <span
          data-testid="asset-place-cta"
          style={{
            flex: "0 0 auto",
            padding: "2px 6px",
            borderRadius: "var(--gs-radius-pill)",
            border: `1px solid color-mix(in srgb, ${GOLD} 50%, transparent)`,
            background: `color-mix(in srgb, ${GOLD} 20%, transparent)`,
            color: GOLD,
            fontFamily: "var(--font-ui)",
            fontSize: "var(--gs-font-xs)",
            fontWeight: 600,
            lineHeight: 1.3,
          }}
        >
          Place
        </span>
      )}
    </Button>
  );
}

export function AssetFanOutDock() {
  const assetsOpen = useStudioStore((s) => s.assetsOpen);
  const armedSymbolId = useStudioStore((s) => s.armedSymbolId);
  const setArmedSymbolId = useStudioStore((s) => s.setArmedSymbolId);
  const setAreaPlantActive = useStudioStore((s) => s.setAreaPlantActive);
  const setRowPlantActive = useStudioStore((s) => s.setRowPlantActive);
  const boundaryNotice = useStudioStore((s) => s.boundaryNotice);
  const dismissBoundaryNotice = useStudioStore((s) => s.dismissBoundaryNotice);

  const [curated] = useState(buildAssetPalette);
  const [catalog] = useState(buildCatalogAssetPalette);
  const [category, setCategory] = useState<AssetPaletteCategory | "all">("all");
  const [query, setQuery] = useState("");

  // The curated eight are the resting face; searching or picking a category
  // opens the wider catalog behind them.
  const browsing = query.trim().length > 0 || category !== "all";
  const matches = useMemo(
    () => filterAssetPalette(browsing ? catalog : curated, { category, query }),
    [browsing, catalog, curated, category, query],
  );
  const visible = matches.slice(0, MAX_DOCK_RESULTS);
  const trimNotice =
    boundaryNotice?.refId === MASS_PLANT_NOTICE_REF ? boundaryNotice : null;

  useEffect(() => {
    if (!armedSymbolId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setArmedSymbolId(null);
        setAreaPlantActive(false);
        setRowPlantActive(false);
        useStudioStore.getState().setMassPlantPreviewCount(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armedSymbolId, setArmedSymbolId, setAreaPlantActive, setRowPlantActive]);

  if (!assetsOpen) return null;

  return (
    <div
      data-testid="asset-dock"
      style={{
        position: "absolute",
        bottom: 12,
        // Centred at 50% − 85px, not 50%: at 960px the dock (maxWidth
        // 100vw−640px = 320px) centred at 50% spans x=320..640 and bites
        // the right dock column (perimeter panel starts at x=600) by 40px.
        // The −85px offset keeps the right edge at vw/2 − 85 + w/2, clear
        // of the panel at every viewport (webgl-chrome-collision gates it).
        left: "calc(50% - 85px)",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--gs-space-2)",
        padding: "5px 8px",
        borderRadius: "var(--gs-radius-xl)",
        border: "1px solid color-mix(in srgb, var(--gs-line) 35%, transparent)",
        background: "color-mix(in srgb, var(--gs-glass) 24%, transparent)",
        backdropFilter: "blur(var(--gs-blur))",
        WebkitBackdropFilter: "blur(var(--gs-blur))",
        pointerEvents: "none",
        maxWidth: "min(64rem, calc(100vw - 640px))",
      }}
    >
      {/* Single compact row: filters + search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--gs-space-1)",
          pointerEvents: "auto",
          justifyContent: "center",
        }}
      >
        <Button
          variant="chip-preset"
          size="xs"
          active={category === "all"}
          data-testid="asset-filter-all"
          onClick={() => setCategory("all")}
        >
          All
        </Button>
        {ASSET_CATEGORIES.map((id) => (
          <Button
            key={id}
            variant="chip-preset"
            size="xs"
            active={category === id}
            data-testid={`asset-filter-${id}`}
            onClick={() => setCategory(id)}
          >
            {ASSET_CATEGORY_LABEL[id]}
          </Button>
        ))}
        <label style={{ width: 110 }}>
          <Input
            aria-label="Search assets"
            data-testid="asset-search"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              fontSize: "var(--gs-font-xs)",
              padding: "2px 5px",
              background: "var(--gs-panel)",
            }}
          />
        </label>
      </div>
      {trimNotice && (
        <div
          data-testid="asset-boundary-notice"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--gs-space-2)",
            pointerEvents: "auto",
            maxWidth: "100%",
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-xs)",
            color: "var(--gs-conflict)",
          }}
        >
          <span>{trimNotice.reason}</span>
          <Button
            variant="text"
            size="xs"
            aria-label="Dismiss boundary notice"
            onClick={dismissBoundaryNotice}
            style={{ color: "var(--gs-ink-secondary)" }}
          >
            ×
          </Button>
        </div>
      )}
      {/* Card strip — single horizontal row, scrollable */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--gs-space-2)",
          pointerEvents: "none",
          maxWidth: "100%",
        }}
      >
        {visible.length === 0 ? (
          <span
            data-testid="asset-empty"
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: "var(--gs-font-xs)",
              color: "var(--gs-ink-secondary)",
              pointerEvents: "none",
            }}
          >
            No assets match.
          </span>
        ) : (
          <div
            data-testid="asset-card-strip"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--gs-space-2)",
              overflowX: "auto",
              overflowY: "hidden",
              minWidth: 0,
              padding: "2px",
              pointerEvents: "auto",
            }}
          >
            {visible.map((entry) => (
              <AssetCard
                key={entry.symbolId}
                entry={entry}
                active={entry.symbolId === armedSymbolId}
                onPick={() =>
                  setArmedSymbolId(
                    entry.symbolId === armedSymbolId ? null : entry.symbolId,
                  )
                }
              />
            ))}
          </div>
        )}
        {browsing && (
          <span
            data-testid="asset-dock-hint"
            style={{
              flex: "0 0 auto",
              fontFamily: "var(--font-tech)",
              fontSize: "var(--gs-font-xs)",
              color: "var(--gs-ink-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            {visible.length}/{matches.length}
          </span>
        )}
      </div>
    </div>
  );
}
