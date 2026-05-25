"use client";

import { useMemo, useState } from "react";
import {
  CATALOG_CATEGORY_LABELS,
  type CatalogCategory,
  type PlantSun,
  type PlantWater,
} from "@workstream/contracts";
import {
  CATALOG_CATEGORY_ORDER,
  CATALOG_PLANNING_SYMBOL_IDS,
  catalogAssetCode,
  filterCatalogSymbols,
} from "@workstream/domain";
import type { CatalogSymbol } from "@workstream/contracts";
import { DesignAssetGlyph } from "./DesignAssetGlyph";
import s from "./designAssetPalette.module.css";

type CategoryFilter = CatalogCategory | "all";

type Props = {
  symbols: CatalogSymbol[];
  selectedId: string | null;
  disabled?: boolean;
  embedded?: boolean;
  onSelect: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
};

function AssetCard({
  sym,
  active,
  disabled,
  planning,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  sym: CatalogSymbol;
  active: boolean;
  disabled: boolean;
  planning?: boolean;
  onSelect: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
}) {
  const code = catalogAssetCode(sym);
  return (
    <button
      type="button"
      className={`${s.card} ${active ? s.cardActive : ""} ${planning ? s.cardPlanning : ""}`}
      draggable={!disabled}
      disabled={disabled}
      onDragStart={() => onDragStart?.(sym.id)}
      onDragEnd={() => onDragEnd?.()}
      onPointerDown={() => {
        if (!disabled) onSelect(sym.id);
      }}
      onClick={() => onSelect(sym.id)}
      aria-pressed={active}
      data-testid={`catalog-${sym.id}`}
    >
      <div className={s.cardPreview}>
        <DesignAssetGlyph symbol={sym} size="lg" />
      </div>
      <span className={s.cardCode}>{code}</span>
      <span className={s.cardLabel}>{sym.label}</span>
      {planning ? <span className={s.planningTag}>TRP</span> : null}
    </button>
  );
}

export function DesignAssetPalette({
  symbols,
  selectedId,
  disabled = false,
  embedded = false,
  onSelect,
  onDragStart,
  onDragEnd,
}: Props) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [plantKeyword, setPlantKeyword] = useState<string | null>(null);
  const [plantSun, setPlantSun] = useState<PlantSun | null>(null);
  const [plantWater, setPlantWater] = useState<PlantWater | null>(null);

  const selectedSymbol = useMemo(
    () => symbols.find((sym) => sym.id === selectedId) ?? null,
    [symbols, selectedId],
  );

  const planningSymbols = useMemo(
    () => symbols.filter((sym) => CATALOG_PLANNING_SYMBOL_IDS.has(sym.id)),
    [symbols],
  );

  const filtered = useMemo(() => {
    if (
      plantKeyword === "landscape" ||
      plantKeyword === "open crop" ||
      plantKeyword === "wikimedia"
    ) {
      let list = symbols.filter((sym) =>
        (sym.keywords ?? []).some((k) => k.toLowerCase().includes(plantKeyword)),
      );
      if (query.trim()) {
        list = filterCatalogSymbols(list, { query });
      }
      return list;
    }

    let list = filterCatalogSymbols(symbols, { category, query });
    if (category === "planting" && plantKeyword) {
      list = list.filter((sym) =>
        (sym.keywords ?? []).some((k) => k.toLowerCase().includes(plantKeyword)),
      );
    }
    if (category === "planting" && plantSun) {
      list = list.filter((sym) => sym.sun === plantSun);
    }
    if (category === "planting" && plantWater) {
      list = list.filter((sym) => sym.water === plantWater);
    }
    return list;
  }, [symbols, category, query, plantKeyword, plantSun, plantWater]);

  const gridSymbols = useMemo(() => {
    if (category !== "all" || query.trim()) return filtered;
    const planningIds = new Set(planningSymbols.map((sym) => sym.id));
    return filtered.filter((sym) => !planningIds.has(sym.id));
  }, [filtered, category, query, planningSymbols]);

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
      className={`${s.palette} ${embedded ? s.paletteEmbedded : ""} ${disabled ? s.paletteDisabled : ""}`}
      aria-label="Design asset library"
      data-testid="design-asset-palette"
    >
      <div className={s.header}>
        <h2 className={s.title}>Asset library</h2>
        <p className={s.subtitle}>
          Search by name or asset code. Planning symbols pinned for TRP work.
        </p>
      </div>

      <div className={s.searchRow}>
        <input
          type="search"
          className={s.search}
          placeholder="Search name or code (e.g. PLT-HORN, TRP)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          aria-label="Search assets by name or code"
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

      {category === "planting" || category === "all" ? (
        <>
          <div className={s.filterRow}>
            <button
              type="button"
              className={`${s.filterChip} ${plantKeyword === "landscape" ? s.filterChipActive : ""}`}
              onClick={() => {
                setPlantKeyword((cur) => (cur === "landscape" ? null : "landscape"));
                setCategory("all");
                setPlantSun(null);
                setPlantWater(null);
              }}
              disabled={disabled}
            >
              Landscape library
            </button>
            <button
              type="button"
              className={`${s.filterChip} ${plantKeyword === "wikimedia" ? s.filterChipActive : ""}`}
              onClick={() => {
                setPlantKeyword((cur) => (cur === "wikimedia" ? null : "wikimedia"));
                setCategory("all");
                setPlantSun(null);
                setPlantWater(null);
              }}
              disabled={disabled}
            >
              Tree pack
            </button>
            <button
              type="button"
              className={`${s.filterChip} ${plantKeyword === "open crop" ? s.filterChipActive : ""}`}
              onClick={() => {
                setPlantKeyword((cur) => (cur === "open crop" ? null : "open crop"));
                setCategory("all");
                setPlantSun(null);
                setPlantWater(null);
              }}
              disabled={disabled}
            >
              Crop library
            </button>
          </div>
        </>
      ) : null}

      {category === "planting" ? (
        <>
          <div className={s.filterRow}>
            {(
              [
                ["full", "Full sun"],
                ["partial", "Partial"],
                ["shade", "Shade"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`${s.filterChip} ${plantSun === value ? s.filterChipActive : ""}`}
                onClick={() =>
                  setPlantSun((cur: PlantSun | null) => (cur === value ? null : value))
                }
                disabled={disabled}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={s.filterRow}>
            {(
              [
                ["low", "Low water"],
                ["moderate", "Moderate"],
                ["high", "High"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`${s.filterChip} ${plantWater === value ? s.filterChipActive : ""}`}
                onClick={() =>
                  setPlantWater((cur: PlantWater | null) => (cur === value ? null : value))
                }
                disabled={disabled}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={s.filterRow}>
            {["native", "grass", "hedge"].map((kw) => (
              <button
                key={kw}
                type="button"
                className={`${s.filterChip} ${plantKeyword === kw ? s.filterChipActive : ""}`}
                onClick={() => setPlantKeyword((cur) => (cur === kw ? null : kw))}
                disabled={disabled}
              >
                {kw}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {category === "planting" && selectedSymbol ? (
        <div className={s.plantDetail} data-testid="planting-detail-strip">
          <p className={s.plantDetailTitle}>{selectedSymbol.label}</p>
          {selectedSymbol.botanical_name ? (
            <p className={s.plantDetailMeta}>{selectedSymbol.botanical_name}</p>
          ) : null}
          <p className={s.plantDetailMeta}>
            {[
              selectedSymbol.sun ? `Sun: ${selectedSymbol.sun}` : null,
              selectedSymbol.water ? `Water: ${selectedSymbol.water}` : null,
              selectedSymbol.mature_height_m
                ? `Mature ~${selectedSymbol.mature_height_m} m`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {selectedSymbol.rate_card_sku ? (
            <p className={s.plantDetailSku}>SKU {selectedSymbol.rate_card_sku}</p>
          ) : (
            <p className={s.plantDetailHint}>Curtis-approved palette — confirm size on site</p>
          )}
        </div>
      ) : null}

      {category === "all" && !query.trim() && planningSymbols.length > 0 ? (
        <div className={s.planningBlock}>
          <h3 className={s.planningHeading}>Planning</h3>
          <div className={s.grid}>
            {planningSymbols.map((sym) => (
              <AssetCard
                key={sym.id}
                sym={sym}
                active={selectedId === sym.id}
                disabled={disabled}
                planning
                onSelect={onSelect}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            ))}
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className={s.empty}>No assets match. Try another category or search.</p>
      ) : (
        <div className={s.grid}>
          {gridSymbols.map((sym) => (
            <AssetCard
              key={sym.id}
              sym={sym}
              active={selectedId === sym.id}
              disabled={disabled}
              onSelect={onSelect}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </section>
  );
}
