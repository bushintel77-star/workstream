"use client";

/**
 * Gold Standard 2026 — Asset Fan-Out Dock (discovery palette).
 *
 * The Gap 5 discovery instrument: a bottom-docked fan-out of asset cards
 * (Stitch phase_1.1 idiom). Picking a card arms the symbol — the operator
 * then clicks the lot and AssetPlaceLayer mints the placement. Botanical
 * metadata comes from the real catalog ("never invented" — the mobile
 * DiscoveryAssetCard law); the selected card takes the gold treatment.
 *
 * DOM chrome (Layer 3), self-gating on assetsOpen. Esc cancels arming.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (Asset Discovery Fan-Out)
 */

import { useEffect, useState } from "react";
import { useStudioStore } from "./studioStore";
import { buildAssetPalette, type AssetPaletteEntry } from "./assetPalette";

const GOLD = "var(--gs-primary)";

function cardFaceStyle(active: boolean): React.CSSProperties {
  return active
    ? {
        width: 176,
        minHeight: 224,
        border: `1px solid color-mix(in srgb, ${GOLD} 50%, transparent)`,
        background: `color-mix(in srgb, ${GOLD} 6%, var(--gs-glass))`,
        boxShadow: "0 0 24px color-mix(in srgb, var(--gs-primary) 12%, transparent)",
      }
    : { width: 148, minHeight: 192 };
}

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
    <button
      data-testid={`asset-card-${entry.symbolId}`}
      onClick={onPick}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: 14,
        borderRadius: 14,
        border: "1px solid var(--gs-line)",
        background: "color-mix(in srgb, var(--gs-glass) 70%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        cursor: "pointer",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        pointerEvents: "auto",
        ...cardFaceStyle(active),
      }}
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
            borderRadius: "14px 14px 0 0",
            background: GOLD,
            opacity: 0.6,
          }}
        />
      )}
      <span
        style={{
          fontSize: active ? 34 : 26,
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
          fontSize: 12,
          fontWeight: 600,
          color: "var(--gs-ink)",
          textAlign: "center",
        }}
      >
        {entry.label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-tech)",
          fontSize: 10,
          color: "var(--gs-ink-secondary)",
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        {entry.botanicalName && <em>{entry.botanicalName}</em>}
        {entry.heightM != null && (
          <div>
            Hgt {entry.heightM.toFixed(1)}m
            {entry.spreadM != null ? ` · Rad ${entry.spreadM.toFixed(1)}m` : ""}
          </div>
        )}
      </span>
      {active && (
        <span
          data-testid="asset-place-cta"
          style={{
            marginTop: 6,
            padding: "4px 14px",
            borderRadius: 999,
            border: `1px solid color-mix(in srgb, ${GOLD} 50%, transparent)`,
            background: `color-mix(in srgb, ${GOLD} 20%, transparent)`,
            color: GOLD,
            fontFamily: "var(--font-ui)",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          Place Asset
        </span>
      )}
    </button>
  );
}

export function AssetFanOutDock() {
  const assetsOpen = useStudioStore((s) => s.assetsOpen);
  const armedSymbolId = useStudioStore((s) => s.armedSymbolId);
  const setArmedSymbolId = useStudioStore((s) => s.setArmedSymbolId);

  // Static curated palette — deterministic, memo-free by design.
  const [palette] = useState(buildAssetPalette);

  // Esc cancels arming (not the dock).
  useEffect(() => {
    if (!armedSymbolId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setArmedSymbolId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armedSymbolId, setArmedSymbolId]);

  if (!assetsOpen) return null;

  // While armed, the dock collapses to a compact hint pill — the placement
  // click owns the canvas (an armed tool never has chrome over the lot),
  // and the full palette returns after the place / Esc.
  if (armedSymbolId) {
    return (
      <div
        data-testid="asset-dock"
        style={{
          position: "absolute",
          bottom: 132,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "8px 16px",
          borderRadius: 999,
          border: `1px solid color-mix(in srgb, ${GOLD} 40%, transparent)`,
          background: "color-mix(in srgb, var(--gs-glass) 60%, transparent)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          pointerEvents: "none",
          fontFamily: "var(--font-tech)",
          fontSize: 11,
          color: GOLD,
        }}
      >
        Armed — click the lot to place · Esc cancels
      </div>
    );
  }

  return (
    <div
      data-testid="asset-dock"
      style={{
        position: "absolute",
        bottom: 132, // stacked above the growth scrubber card
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 16,
        border: "1px solid color-mix(in srgb, var(--gs-line) 60%, transparent)",
        background: "color-mix(in srgb, var(--gs-glass) 40%, transparent)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        // Container passes clicks through to the canvas — the dock spans the
        // screen centre, so only the cards themselves may capture (Stitch
        // phase_1.1 does exactly this: pointer-events-none dock, auto cards).
        pointerEvents: "none",
        maxWidth: "min(92vw, 60rem)",
      }}
    >
      {palette.map((entry) => (
        <AssetCard
          key={entry.symbolId}
          entry={entry}
          active={entry.symbolId === armedSymbolId}
          onPick={() =>
            setArmedSymbolId(entry.symbolId === armedSymbolId ? null : entry.symbolId)
          }
        />
      ))}
      <div
        style={{
          alignSelf: "center",
          maxWidth: 160,
          fontFamily: "var(--font-tech)",
          fontSize: 10,
          lineHeight: 1.6,
          color: armedSymbolId ? GOLD : "var(--gs-ink-secondary)",
        }}
      >
        {armedSymbolId
          ? "Armed — click the lot to place. Esc cancels."
          : "Pick an asset to place on the lot."}
      </div>
    </div>
  );
}
