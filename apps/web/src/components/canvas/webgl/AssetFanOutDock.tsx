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
  return (
    <Button
      variant="asset-card"
      active={active}
      aria-pressed={active}
      draggable
      data-testid={`asset-card-${entry.symbolId}`}
      title={`${entry.label} — click to arm, or drag onto the lot`}
      style={{ flex: "0 0 auto" }}
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
          fontSize: active ? 20 : 16,
          lineHeight: 1,
          color: active ? GOLD : "var(--gs-ink-secondary)",
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
          textAlign: "center",
          lineHeight: 1.25,
        }}
      >
        {entry.label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-tech)",
          fontSize: "var(--gs-font-xs)",
          color: "var(--gs-ink-secondary)",
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        {entry.botanicalName && <em>{entry.botanicalName}</em>}
        {entry.heightM != null && (
          <div>
            H {entry.heightM.toFixed(1)}
            {entry.spreadM != null ? ` · R ${entry.spreadM.toFixed(1)}`
              : ""}
          </div>
        )}
      </span>
      {active && (
        <span
          data-testid="asset-place-cta"
          style={{
            marginTop: "var(--gs-space-1)",
            padding: "var(--gs-space-1) 9px",
            borderRadius: "var(--gs-radius-pill)",
            border: `1px solid color-mix(in srgb, ${GOLD} 50%, transparent)`,
            background: `color-mix(in srgb, ${GOLD} 20%, transparent)`,
            color: GOLD,
            fontFamily: "var(--font-ui)",
            fontSize: "var(--gs-font-xs)",
            fontWeight: 600,
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
  const areaPlantActive = useStudioStore((s) => s.areaPlantActive);
  const setAreaPlantActive = useStudioStore((s) => s.setAreaPlantActive);
  const rowPlantActive = useStudioStore((s) => s.rowPlantActive);
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armedSymbolId, setArmedSymbolId, setAreaPlantActive, setRowPlantActive]);

  if (!assetsOpen) return null;

  if (armedSymbolId) {
    return (
      <div
        data-testid="asset-dock"
        style={{
          position: "absolute",
          bottom: 12,
          left: "calc(50% - 85px)",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: "var(--gs-space-3)",
          padding: "5px 12px",
          borderRadius: "var(--gs-radius-pill)",
          border: `1px solid color-mix(in srgb, ${GOLD} 40%, transparent)`,
          background: "color-mix(in srgb, var(--gs-glass) 38%, transparent)",
          backdropFilter: "blur(var(--gs-blur))",
          WebkitBackdropFilter: "blur(var(--gs-blur))",
          pointerEvents: "auto",
          fontFamily: "var(--font-tech)",
          fontSize: "var(--gs-font-xs)",
          color: GOLD,
        }}
      >
        {rowPlantActive
          ? "Armed — drag a run to row-plant · Esc cancels"
          : areaPlantActive
            ? "Armed — drag a box to mass-plant · Esc cancels"
            : "Armed — click the lot to place · Esc cancels"}
        <Button
          variant="chip-preset"
          size="xs"
          active={areaPlantActive}
          data-testid="asset-area-plant"
          onClick={() => setAreaPlantActive(!areaPlantActive)}
          style={{ pointerEvents: "auto" }}
        >
          Area
        </Button>
        <Button
          variant="chip-preset"
          size="xs"
          active={rowPlantActive}
          data-testid="asset-row-plant"
          onClick={() => setRowPlantActive(!rowPlantActive)}
          style={{ pointerEvents: "auto" }}
        >
          Row
        </Button>
      </div>
    );
  }

  return (
    <div
      data-testid="asset-dock"
      style={{
        position: "absolute",
        bottom: 12,
        left: "calc(50% - 85px)",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--gs-space-3)",
        padding: "7px 9px",
        borderRadius: "var(--gs-radius-xl)",
        border: "1px solid color-mix(in srgb, var(--gs-line) 35%, transparent)",
        background: "color-mix(in srgb, var(--gs-glass) 24%, transparent)",
        backdropFilter: "blur(var(--gs-blur))",
        WebkitBackdropFilter: "blur(var(--gs-blur))",
        pointerEvents: "none",
        maxWidth: "min(64rem, calc(100vw - 460px))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--gs-space-2)",
          pointerEvents: "auto",
          flexWrap: "wrap",
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
        <label style={{ width: 140 }}>
          <Input
            aria-label="Search assets"
            data-testid="asset-search"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              fontSize: "var(--gs-font-xs)",
              padding: "2px 6px",
              background: "var(--gs-panel)",
            }}
          />
        </label>
        <Button
          variant="chip-preset"
          size="xs"
          active={areaPlantActive}
          data-testid="asset-area-plant"
          onClick={() => setAreaPlantActive(!areaPlantActive)}
          title="Draw a box after arming to mass-plant at mature spacing"
        >
          Area plant
        </Button>
        <Button
          variant="chip-preset"
          size="xs"
          active={rowPlantActive}
          data-testid="asset-row-plant"
          onClick={() => setRowPlantActive(!rowPlantActive)}
          title="Draw a run after arming to row-plant a hedge or border at mature spacing"
        >
          Row plant
        </Button>
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
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "var(--gs-space-3)",
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
              alignItems: "flex-end",
              gap: "var(--gs-space-3)",
              // Horizontal scroll, never wrap: the dock keeps one row and
              // one footprint no matter how many symbols match.
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
        <div
          data-testid="asset-dock-hint"
          style={{
            alignSelf: "center",
            flex: "0 0 auto",
            maxWidth: 110,
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-xs)",
            lineHeight: 1.5,
            color: "var(--gs-ink-secondary)",
          }}
        >
          {browsing
            ? `${visible.length} of ${matches.length} in ${catalog.length} catalog symbols`
            : "Pick or drag an asset onto the lot. Search the full catalog."}
        </div>
      </div>
    </div>
  );
}
