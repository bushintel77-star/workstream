"use client";

/**
 * Gold Standard 2026 — Asset Library Panel (rail-docked discovery palette).
 *
 * The asset workflow's single surface, replacing both the retired bottom
 * fan-out dock and the full-screen Asset Selection Studio (both removed
 * 2026-08-25). Canvas-UX principle: the library is a tool palette, not a
 * destination — it unfolds from the left ribbon, occupies the rail-adjacent
 * column only, and every control on it affects placement or states a real
 * catalog fact (the "never invented" law).
 *
 *   - Search-first: the field autofocuses; the category chips compose with
 *     the query (command-palette behaviour).
 *   - One dense result list: glyph + label + botanical + H/R figures. Rows
 *     arm on click/Enter, stay draggable onto the lot, and the armed row
 *     carries the Signal Blue treatment.
 *   - Armed footer: catalog facts + the placement hint. No dial/slider
 *     controls — rotation is owned by the placement gizmo after placing;
 *     the panel refuses controls that do not affect placement.
 *
 * The component stays mounted while closed so it owns the Esc ladder for
 * the whole arm workflow (the floating toolbar promises "Esc disarms"):
 *   1. armed symbol → disarm (panel stays open for the next pick),
 *   2. query → clear,
 *   3. else → close the panel.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (Asset Discovery Fan-Out)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useStudioStore } from "./studioStore";
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABEL,
  buildAssetPalette,
  buildCatalogAssetPalette,
  filterAssetPalette,
  type AssetPaletteCategory,
  type AssetPaletteEntry,
} from "./assetPalette";
import { massPlantSpacingM } from "./fillAreaAssets";
import { MASS_PLANT_NOTICE_REF } from "./inspectorPolicy";
import { Button } from "./Button";
import { Input } from "./Field";

const GOLD = "var(--la-accent)";
const SYMBOL_MIME = "application/x-workstream-symbol";

export function AssetLibraryPanel() {
  const assetsOpen = useStudioStore((s) => s.assetsOpen);
  const setAssetsOpen = useStudioStore((s) => s.setAssetsOpen);
  const armedSymbolId = useStudioStore((s) => s.armedSymbolId);
  const setArmedSymbolId = useStudioStore((s) => s.setArmedSymbolId);
  const boundaryNotice = useStudioStore((s) => s.boundaryNotice);
  const dismissBoundaryNotice = useStudioStore((s) => s.dismissBoundaryNotice);

  const [curated] = useState(buildAssetPalette);
  const [catalog] = useState(buildCatalogAssetPalette);
  const [category, setCategory] = useState<AssetPaletteCategory | "all">("all");
  const [query, setQuery] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // Searching or filtering opens the wider catalog behind the curated eight.
  const browsing = query.trim().length > 0 || category !== "all";
  const matches = useMemo(
    () => filterAssetPalette(browsing ? catalog : curated, { category, query }),
    [browsing, catalog, curated, category, query],
  );

  const armed = armedSymbolId
    ? catalog.find((e) => e.symbolId === armedSymbolId) ?? null
    : null;
  const trimNotice =
    boundaryNotice?.refId === MASS_PLANT_NOTICE_REF ? boundaryNotice : null;

  // Focus management: entering the panel parks the operator in the search
  // field; leaving returns focus to the ribbon button that opened it.
  useEffect(() => {
    if (assetsOpen) {
      const prev = document.activeElement;
      if (prev instanceof HTMLElement && !prev.closest('[data-testid="asset-library"]')) {
        prevFocusRef.current = prev;
      }
      searchRef.current?.focus();
    } else if (prevFocusRef.current?.isConnected) {
      prevFocusRef.current.focus();
      prevFocusRef.current = null;
    }
  }, [assetsOpen]);

  // The Esc ladder — disarm first (the toolbar's promise), then peel the
  // query, then close. Ignored while typing in other chrome inputs; the
  // panel's own search field participates (Esc there clears/disarms).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        target !== searchRef.current &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;
      const store = useStudioStore.getState();
      if (store.armedSymbolId) {
        e.preventDefault();
        store.setArmedSymbolId(null);
        return;
      }
      if (query) {
        e.preventDefault();
        setQuery("");
        searchRef.current?.focus();
        return;
      }
      if (assetsOpen) {
        e.preventDefault();
        setAssetsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [assetsOpen, query, setAssetsOpen]);

  if (!assetsOpen) return null;

  const focusRow = (from: number, delta: number) => {
    const rows = listRef.current?.querySelectorAll<HTMLButtonElement>(
      '[data-asset-row="true"]',
    );
    if (!rows || rows.length === 0) return;
    const next = Math.min(rows.length - 1, Math.max(0, from + delta));
    rows[next]?.focus();
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusRow(-1, 1);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        '[data-asset-row="true"]',
      ) ?? [],
    );
    const idx = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusRow(idx, 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx <= 0) searchRef.current?.focus();
      else focusRow(idx, -1);
    }
  };

  return (
    <div
      data-testid="asset-library"
      role="dialog"
      aria-label="Asset library"
      style={{
        position: "absolute",
        // Flush to the tool rail's right edge (rail: left 8, top 152) — the
        // palette lives where the pointer already is and never reaches the
        // right dock column (cleared at every collision-gated viewport).
        left: 68,
        top: 152,
        width: "clamp(200px, calc(100vw - 800px), 270px)",
        maxHeight: "calc(100dvh - 170px)",
        display: "flex",
        flexDirection: "column",
        zIndex: "var(--cf-z-chrome)",
        borderRadius: "var(--gs-radius-panel)",
        background: "var(--la-surface)",
        border: "1px solid var(--la-surface-muted)",
        boxShadow: "var(--gs-shadow-2)",
        overflow: "hidden",
        animation: "wsPanelIn 180ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* Header — title, live count, close */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--gs-space-2)",
          padding: "8px 10px 6px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-micro)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--la-ink-muted)",
          }}
        >
          Asset library
        </span>
        <span
          data-testid="asset-library-count"
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-micro)",
            color: "var(--la-ink-muted)",
            opacity: 0.8,
          }}
        >
          {matches.length}
          {browsing ? `/${catalog.length}` : ""}
        </span>
        <span style={{ flex: 1 }} />
        <Button
          variant="text"
          size="xs"
          aria-label="Close asset library"
          data-testid="asset-library-close"
          onClick={() => setAssetsOpen(false)}
          style={{ color: "var(--la-ink-secondary)", padding: "0 4px" }}
        >
          ×
        </Button>
      </div>

      {/* Search + category chips */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--gs-space-2)",
          padding: "0 10px 6px",
        }}
      >
        <Input
          ref={searchRef}
          aria-label="Search assets"
          data-testid="asset-search"
          placeholder="Search species, hardscape…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
          style={{ fontSize: "var(--gs-font-sm)" }}
        />
        <div
          role="group"
          aria-label="Asset categories"
          style={{ display: "flex", flexWrap: "wrap", gap: "var(--gs-space-1)" }}
        >
          <Button
            variant="chip-preset"
            size="xs"
            active={category === "all"}
            aria-pressed={category === "all"}
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
              aria-pressed={category === id}
              data-testid={`asset-filter-${id}`}
              onClick={() => setCategory(id)}
            >
              {ASSET_CATEGORY_LABEL[id]}
            </Button>
          ))}
        </div>
      </div>

      {/* Boundary trim notice — mass plants clipped by the title edge */}
      {trimNotice && (
        <div
          data-testid="asset-boundary-notice"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--gs-space-2)",
            padding: "2px 10px 4px",
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-xs)",
            color: "var(--la-error)",
          }}
        >
          <span style={{ minWidth: 0 }}>{trimNotice.reason}</span>
          <Button
            variant="text"
            size="xs"
            aria-label="Dismiss boundary notice"
            onClick={dismissBoundaryNotice}
            style={{ color: "var(--la-ink-secondary)" }}
          >
            ×
          </Button>
        </div>
      )}

      {/* Result list — one dense column of real catalog rows */}
      <div
        ref={listRef}
        onKeyDown={onListKeyDown}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "2px 6px 6px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {matches.length === 0 ? (
          <span
            data-testid="asset-empty"
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: "var(--gs-font-xs)",
              color: "var(--la-ink-secondary)",
              padding: "10px 4px",
            }}
          >
            No assets match.
          </span>
        ) : (
          matches.map((entry, i) => (
            <AssetRow
              key={entry.symbolId}
              entry={entry}
              active={entry.symbolId === armedSymbolId}
              staggerMs={Math.min(i * 12, 144)}
              onPick={() =>
                setArmedSymbolId(
                  entry.symbolId === armedSymbolId ? null : entry.symbolId,
                )
              }
            />
          ))
        )}
      </div>

      {/* Armed footer — catalog facts + the placement loop hint */}
      {armed && (
        <div
          data-testid="asset-armed-footer"
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "var(--gs-space-2)",
            padding: "6px 10px",
            borderTop: "1px solid var(--la-surface-muted)",
            background: "color-mix(in srgb, var(--la-accent) 6%, transparent)",
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-xs)",
            color: "var(--la-ink-secondary)",
          }}
        >
          <span style={{ color: GOLD, fontWeight: 600 }}>
            {armed.label} armed
          </span>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {armed.heightM != null
              ? `H ${armed.heightM.toFixed(1)} m`
              : ""}
            {armed.spreadM != null
              ? ` · R ${armed.spreadM.toFixed(1)} m`
              : ""}{" "}
            · {massPlantSpacingM(armed.symbolId).toFixed(1)} m centres
          </span>
          <span style={{ marginLeft: "auto", flex: "0 0 auto", opacity: 0.75 }}>
            Click the lot · Esc
          </span>
        </div>
      )}
    </div>
  );
}

function AssetRow({
  entry,
  active,
  staggerMs,
  onPick,
}: {
  entry: AssetPaletteEntry;
  active: boolean;
  staggerMs: number;
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
    <button
      type="button"
      data-testid={`asset-card-${entry.symbolId}`}
      data-asset-row="true"
      aria-pressed={active}
      draggable
      title={tooltip}
      onClick={onPick}
      onDragStart={(e) => {
        e.dataTransfer.setData(SYMBOL_MIME, entry.symbolId);
        e.dataTransfer.setData("text/plain", entry.symbolId);
        e.dataTransfer.effectAllowed = "copy";
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--gs-space-2)",
        padding: "5px 8px 5px 10px",
        borderRadius: "var(--gs-radius-chip)",
        border: `1px solid ${active ? `color-mix(in srgb, ${GOLD} 45%, transparent)` : "transparent"}`,
        borderLeftWidth: active ? 3 : 1,
        background: active
          ? "color-mix(in srgb, var(--la-accent) 8%, transparent)"
          : "transparent",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "var(--font-ui)",
        color: "var(--la-ink)",
        // One orchestrated entrance — rows rise in behind the panel unfold.
        animation: `wsPanelIn 150ms cubic-bezier(0.22, 1, 0.36, 1) both`,
        animationDelay: `${staggerMs}ms`,
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: "var(--gs-font-sub)",
          lineHeight: 1,
          color: active ? GOLD : "var(--la-ink-secondary)",
          flex: "0 0 auto",
        }}
      >
        {entry.glyph}
      </span>
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          flex: "1 1 auto",
        }}
      >
        <span
          style={{
            fontSize: "var(--gs-font-xs)",
            fontWeight: 600,
            lineHeight: 1.25,
            color: "var(--la-ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.label}
        </span>
        {entry.botanicalName ? (
          <span
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: "var(--gs-font-micro)",
              fontStyle: "italic",
              lineHeight: 1.25,
              color: "var(--la-ink-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entry.botanicalName}
          </span>
        ) : null}
      </span>
      {entry.heightM != null ? (
        <span
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-micro)",          color: active ? GOLD : "var(--la-ink-secondary)",
          flex: "0 0 auto",
          whiteSpace: "nowrap",
        }}
      >
          H{entry.heightM.toFixed(0)}
          {entry.spreadM != null ? ` R${entry.spreadM.toFixed(0)}` : ""}
        </span>
      ) : null}
      {active && (
        <span
          data-testid="asset-place-cta"
          style={{
            flex: "0 0 auto",
            padding: "1px 7px",
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
      )}
    </button>
  );
}
