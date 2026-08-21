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
 * Binding: docs/GOLD-STANDARD-2026.md §3 (Asset Discovery Fan-Out)
 */

import { useEffect, useMemo, useState } from "react";
import { useStudioStore } from "./studioStore";
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABEL,
  buildAssetPalette,
  filterAssetPalette,
  type AssetPaletteCategory,
  type AssetPaletteEntry,
} from "./assetPalette";
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

  const [palette] = useState(buildAssetPalette);
  const [category, setCategory] = useState<AssetPaletteCategory | "all">("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () => filterAssetPalette(palette, { category, query }),
    [palette, category, query],
  );

  useEffect(() => {
    if (!armedSymbolId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setArmedSymbolId(null);
        setAreaPlantActive(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armedSymbolId, setArmedSymbolId, setAreaPlantActive]);

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
        {areaPlantActive
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
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "var(--gs-space-3)",
          pointerEvents: "none",
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
          visible.map((entry) => (
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
          ))
        )}
        <div
          style={{
            alignSelf: "center",
            maxWidth: 110,
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-xs)",
            lineHeight: 1.5,
            color: "var(--gs-ink-secondary)",
          }}
        >
          Pick or drag an asset onto the lot.
        </div>
      </div>
    </div>
  );
}
