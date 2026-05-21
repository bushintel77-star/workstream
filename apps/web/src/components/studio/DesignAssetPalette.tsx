"use client";

import { useMemo, useState } from "react";
import {
  CATALOG_CATEGORY_LABELS,
  type CatalogCategory,
} from "@workstream/contracts";
import {
  CATALOG_CATEGORY_ORDER,
  filterCatalogSymbols,
} from "@workstream/domain";
import type { CatalogSymbol } from "../../lib/api";
import { DesignAssetGlyph } from "./DesignAssetGlyph";
import s from "./designAssetPalette.module.css";

type CategoryFilter = CatalogCategory | "all";

type Props = {
  symbols: CatalogSymbol[];
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
};

export function DesignAssetPalette({
  symbols,
  selectedId,
  disabled = false,
  onSelect,
  onDragStart,
  onDragEnd,
}: Props) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => filterCatalogSymbols(symbols, { category, query }),
    [symbols, category, query],
  );

  const counts = useMemo(() => {
    const map = new Map<CategoryFilter, number>();
    map.set("all", symbols.length);
    for (const cat of CATALOG_CATEGORY_ORDER) {
      map.set(cat, symbols.filter((sym) => sym.category === cat).length);
    }
    return map;
  }, [symbols]);

  return (
    <section
      className={`${s.palette} ${disabled ? s.paletteDisabled : ""}`}
      aria-label="Design asset library"
      data-testid="design-asset-palette"
    >
      <div className={s.header}>
        <h2 className={s.title}>Asset library</h2>
        <p className={s.subtitle}>
          Plants, hardscape, and structures — Curtis palette
        </p>
      </div>

      <div className={s.searchRow}>
        <input
          type="search"
          className={s.search}
          placeholder="Search plants, paving, pergola…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          aria-label="Search assets"
          data-testid="design-asset-search"
        />
      </div>

      <div className={s.tabs} role="tablist" aria-label="Asset categories">
        <button
          type="button"
          role="tab"
          aria-selected={category === "all"}
          className={`${s.tab} ${category === "all" ? s.tabActive : ""}`}
          onClick={() => setCategory("all")}
          disabled={disabled}
        >
          All
          <span className={s.tabCount}>{counts.get("all")}</span>
        </button>
        {CATALOG_CATEGORY_ORDER.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={category === cat}
            className={`${s.tab} ${category === cat ? s.tabActive : ""}`}
            onClick={() => setCategory(cat)}
            disabled={disabled}
          >
            {CATALOG_CATEGORY_LABELS[cat]}
            <span className={s.tabCount}>{counts.get(cat) ?? 0}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className={s.empty}>No assets match. Try another category or search.</p>
      ) : (
        <div className={s.grid}>
          {filtered.map((sym) => {
            const active = selectedId === sym.id;
            const bg = sym.asset?.preview_bg ?? "var(--surface-sunken)";
            return (
              <button
                key={sym.id}
                type="button"
                className={`${s.card} ${active ? s.cardActive : ""}`}
                style={{ background: bg }}
                draggable={!disabled}
                disabled={disabled}
                onDragStart={() => onDragStart?.(sym.id)}
                onDragEnd={() => onDragEnd?.()}
                onClick={() => onSelect(sym.id)}
                aria-pressed={active}
                data-testid={`catalog-${sym.id}`}
              >
                <DesignAssetGlyph symbol={sym} size="lg" />
                <span className={s.cardLabel}>{sym.label}</span>
                {sym.description && (
                  <span className={s.cardDesc}>{sym.description}</span>
                )}
                {sym.rate_card_sku && (
                  <span className={s.cardSku}>{sym.rate_card_sku}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
