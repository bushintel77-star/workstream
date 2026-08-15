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
        width: 108,
        minHeight: 138,
        border: `1px solid color-mix(in srgb, ${GOLD} 50%, transparent)`,
        background: `color-mix(in srgb, ${GOLD} 6%, var(--gs-glass))`,
        boxShadow: "0 0 18px color-mix(in srgb, var(--gs-primary) 12%, transparent)",
      }
    : { width: 92, minHeight: 118 };
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
        gap: 3,
        padding: 8,
        borderRadius: 10,
        border: "1px solid var(--gs-line)",
        background: "color-mix(in srgb, var(--gs-glass) 38%, transparent)",
        backdropFilter: "blur(var(--gs-blur))",
        WebkitBackdropFilter: "blur(var(--gs-blur))",
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
          fontSize: 9.5,
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
          fontSize: 9.5,
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
            marginTop: 2,
            padding: "1px 9px",
            borderRadius: 999,
            border: `1px solid color-mix(in srgb, ${GOLD} 50%, transparent)`,
            background: `color-mix(in srgb, ${GOLD} 20%, transparent)`,
            color: GOLD,
            fontFamily: "var(--font-ui)",
            fontSize: 10.5,
            fontWeight: 600,
          }}
        >
          Place
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
          bottom: 96,
          // Centre in the safe zone (between the tool rail and the right
          // chrome column), not the raw viewport — collision-spec guaranteed.
          left: "calc(50% - 85px)",
          transform: "translateX(-50%)",
          padding: "5px 12px",
          borderRadius: 999,
          border: `1px solid color-mix(in srgb, ${GOLD} 40%, transparent)`,
          background: "color-mix(in srgb, var(--gs-glass) 38%, transparent)",
          backdropFilter: "blur(var(--gs-blur))",
          WebkitBackdropFilter: "blur(var(--gs-blur))",
          pointerEvents: "none",
          fontFamily: "var(--font-tech)",
          fontSize: 10,
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
        bottom: 96, // stacked above the growth scrubber card
        // Centred in the safe zone between the tool rail and the right
        // chrome column; width capped to the same zone so the fan never
        // swings into the instrument cards (collision-spec guaranteed).
        left: "calc(50% - 85px)",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "flex-end",
        gap: 6,
        padding: "7px 9px",
        borderRadius: 12,
        border: "1px solid color-mix(in srgb, var(--gs-line) 35%, transparent)",
        background: "color-mix(in srgb, var(--gs-glass) 24%, transparent)",
        backdropFilter: "blur(var(--gs-blur))",
        WebkitBackdropFilter: "blur(var(--gs-blur))",
        // Container passes clicks through to the canvas — the dock spans the
        // screen centre, so only the cards themselves may capture (Stitch
        // phase_1.1 does exactly this: pointer-events-none dock, auto cards).
        pointerEvents: "none",
        maxWidth: "min(64rem, calc(100vw - 460px))",
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
          maxWidth: 110,
          fontFamily: "var(--font-tech)",
          fontSize: 10.5,
          lineHeight: 1.5,
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
