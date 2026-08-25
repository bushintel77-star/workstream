"use client";

/**
 * BottomAssetStrip — Gold Standard 2026
 *
 * A compact horizontal strip at the bottom of the canvas that replaces
 * the left-side AssetLibraryPanel. Shows 6 curated assets as dense
 * horizontal chips with a search affordance. The full library opens
 * via the "All →" overflow chip.
 *
 * Binding: §3 "Asset Discovery Fan-Out" — "The strip never becomes a wall"
 *
 * Height: ~56px (one row of chips). Sits above the interaction guidance
 * bar and below the canvas. Uses z-index var(--cf-z-chrome) to stay
 * above the canvas but below the right-panel.
 */

import { useMemo, useRef, useState } from "react";
import { useStudioStore } from "./studioStore";
import {
  buildAssetPalette,
  type AssetPaletteEntry,
} from "./assetPalette";
import { Button } from "./Button";

const GOLD = "var(--la-accent)";

export function BottomAssetStrip() {
  const setAssetsOpen = useStudioStore((s) => s.setAssetsOpen);
  const armedSymbolId = useStudioStore((s) => s.armedSymbolId);
  const setArmedSymbolId = useStudioStore((s) => s.setArmedSymbolId);

  const [curated] = useState(buildAssetPalette);
  const stripRef = useRef<HTMLDivElement>(null);

  // Show the first 6 curated assets as chips, plus an "All →" overflow
  const visibleChips = useMemo(() => curated.slice(0, 6), [curated]);
  const hasMore = curated.length > 6;

  return (
    <div
      data-testid="bottom-asset-strip"
      role="toolbar"
      aria-label="Asset palette"
      ref={stripRef}
      style={{
        position: "absolute",
        bottom: 48,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: "var(--gs-space-2)",
        padding: "5px 10px",
        borderRadius: "var(--gs-radius-panel)",
        background: "var(--la-surface)",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
        border: "1px solid color-mix(in srgb, var(--la-surface-muted) 40%, transparent)",
        boxShadow: "var(--gs-shadow-2)",
        zIndex: "var(--cf-z-chrome)",
        pointerEvents: "auto",
        animation: "wsPanelIn 160ms ease-out",
        maxWidth: "calc(100vw - 640px)",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      {visibleChips.map((entry) => (
        <StripChip
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
      {hasMore ? (
        <Button
          variant="chip-preset"
          size="xs"
          data-testid="asset-strip-more"
          onClick={() => setAssetsOpen(true)}
          style={{
            color: "var(--la-ink-secondary)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          All →
        </Button>
      ) : null}
    </div>
  );
}

function StripChip({
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
      type="button"
      data-testid={`asset-strip-${entry.symbolId}`}
      data-asset-row="true"
      aria-pressed={active}
      onClick={onPick}
      title={`${entry.label}${entry.botanicalName ? `\n${entry.botanicalName}` : ""}${entry.heightM != null ? `\nH ${entry.heightM.toFixed(1)}m` : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--gs-space-1)",
        padding: "3px 8px",
        borderRadius: "var(--gs-radius-chip)",
        border: active
          ? `1px solid color-mix(in srgb, ${GOLD} 50%, transparent)`
          : "1px solid color-mix(in srgb, var(--la-surface-muted) 35%, transparent)",
        background: active
          ? "color-mix(in srgb, var(--la-accent) 8%, transparent)"
          : "transparent",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "var(--font-ui)",
        color: "var(--la-ink)",
        whiteSpace: "nowrap",
        flexShrink: 0,
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: 13,
          lineHeight: 1,
          color: active ? GOLD : "var(--la-ink-secondary)",
          flexShrink: 0,
        }}
      >
        {entry.glyph}
      </span>
      <span
        style={{
          fontSize: "var(--gs-font-xs)",
          fontWeight: 500,
          lineHeight: 1.2,
          color: active ? GOLD : "var(--la-ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 80,
        }}
      >
        {entry.label}
      </span>
      {active ? (
        <span
          data-testid="asset-strip-place-cta"
          style={{
            padding: "1px 6px",
            borderRadius: "var(--gs-radius-pill)",
            border: `1px solid color-mix(in srgb, ${GOLD} 50%, transparent)`,
            background: `color-mix(in srgb, ${GOLD} 20%, transparent)`,
            color: GOLD,
            fontFamily: "var(--font-ui)",
            fontSize: "var(--gs-font-micro)",
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          Place
        </span>
      ) : null}
    </button>
  );
}
