"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import {
  ASPECT_TAG_LABELS,
  buildSketchLibraryGroups,
  CURTIS_CATALOG_SYMBOLS,
  filterPlantingPalette,
  searchSketchLibrary,
  SOIL_TAG_LABELS,
  type AspectTag,
  type SoilTag,
} from "@workstream/domain";
import type { CatalogSymbol } from "@workstream/contracts";
import { DesignAssetGlyph } from "../../../../studio/DesignAssetGlyph";
import { StudioGlyph } from "../../StudioGlyph";
import {
  BY_TYPE,
  KIT_BAGS,
  type StudioItemType,
  type StudioMode,
} from "../../studioCatalog";
import { mapSymbolToStudioType } from "../../state/studioAiEngine";
import { playInstrumentTick } from "../ambient/instrumentTick";
import css from "./assetPanel.module.css";

const SOIL_OPTS: SoilTag[] = ["any", "clay", "loam", "sand"];
const ASPECT_OPTS: AspectTag[] = ["any", "N", "E", "S", "W"];
/** Pinned row — favorites/recents cap (replaces Draft kit grid). */
const PINNED_MAX = 9;

export type AssetPanelExpandedProps = {
  mode: StudioMode;
  armed: StudioItemType | null;
  paintSwatch: StudioItemType;
  tool: "add" | "paint" | "select" | "path";
  sunHours: number;
  plantingSoil: SoilTag;
  plantingAspect: AspectTag;
  query: string;
  openSection: string | null;
  scrollTop: number;
  focusSearch?: boolean;
  searchRef?: RefObject<HTMLInputElement | null>;
  onQuery: (q: string) => void;
  onOpenSection: (id: string | null) => void;
  onScrollTop: (n: number) => void;
  onPlantingSoil: (s: SoilTag) => void;
  onPlantingAspect: (a: AspectTag) => void;
  onPickMaterial: (t: StudioItemType) => void;
  /** Keep library open through place / canvas interact. */
  libraryPinned?: boolean;
  onToggleLibraryPin?: () => void;
};

function pinnedTypes(mode: StudioMode): StudioItemType[] {
  const all = KIT_BAGS.flatMap((b) => b.types);
  const filtered =
    mode === "survey" ? all.filter((t) => t === "exist") : all;
  return filtered.slice(0, PINNED_MAX);
}

export function AssetPanelExpanded({
  mode,
  armed,
  paintSwatch,
  tool,
  sunHours,
  plantingSoil,
  plantingAspect,
  query,
  openSection,
  scrollTop,
  focusSearch = false,
  searchRef,
  onQuery,
  onOpenSection,
  onScrollTop,
  onPlantingSoil,
  onPlantingAspect,
  onPickMaterial,
  libraryPinned = false,
  onToggleLibraryPin,
}: AssetPanelExpandedProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const localSearchRef = useRef<HTMLInputElement | null>(null);
  const inputRef = searchRef ?? localSearchRef;

  useEffect(() => {
    if (focusSearch) inputRef.current?.focus();
  }, [focusSearch, inputRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && Math.abs(el.scrollTop - scrollTop) > 1) {
      el.scrollTop = scrollTop;
    }
  }, [scrollTop, openSection, query]);

  const pinned = useMemo(() => pinnedTypes(mode), [mode]);

  const filteredCatalog = useMemo(
    () =>
      filterPlantingPalette(CURTIS_CATALOG_SYMBOLS, {
        sunHours,
        soil: plantingSoil,
        aspect: plantingAspect,
      }),
    [sunHours, plantingSoil, plantingAspect],
  );

  const libraryGroups = useMemo(
    () => buildSketchLibraryGroups(filteredCatalog),
    [filteredCatalog],
  );

  const searching = query.trim().length > 0;
  const results = useMemo(
    () => (searching ? searchSketchLibrary(filteredCatalog, query) : []),
    [searching, query, filteredCatalog],
  );

  const activeMaterial =
    tool === "paint" ? paintSwatch : armed ?? paintSwatch;

  const pickMaterial = (t: StudioItemType) => {
    playInstrumentTick("arm");
    onPickMaterial(t);
  };

  const pickSymbol = (sym: CatalogSymbol) => {
    pickMaterial(mapSymbolToStudioType(sym.id));
  };

  const toggleSection = (id: string) => {
    playInstrumentTick("step");
    onOpenSection(openSection === id ? null : id);
  };

  const symbolChip = (sym: CatalogSymbol) => {
    const mapped = mapSymbolToStudioType(sym.id);
    const on = activeMaterial === mapped;
    return (
      <button
        key={sym.id}
        type="button"
        role="option"
        aria-selected={on}
        className={`${css.tile}${on ? ` ${css.tileOn}` : ""}`}
        data-testid={`kit-library-${sym.id}`}
        title={
          sym.botanical_name
            ? `${sym.label} · ${sym.botanical_name}`
            : sym.label
        }
        onClick={() => pickSymbol(sym)}
      >
        <span className={css.glyph} aria-hidden>
          <DesignAssetGlyph symbol={sym} size="sm" />
        </span>
        <span className={css.tileLabel}>{sym.label}</span>
      </button>
    );
  };

  return (
    <div className={css.body} data-testid="asset-panel-expanded">
      <div className={css.libraryHead}>
        <input
          ref={inputRef}
          type="search"
          className={css.search}
          value={query}
          placeholder="Search plants, hardscape, lighting…"
          aria-label="Search asset library"
          data-testid="kit-library-search"
          onChange={(e) => onQuery(e.target.value)}
        />
        {onToggleLibraryPin ? (
          <button
            type="button"
            className={`${css.pinBtn}${libraryPinned ? ` ${css.pinBtnOn}` : ""}`}
            aria-pressed={libraryPinned}
            title={
              libraryPinned
                ? "Unpin library — collapses after place"
                : "Pin library open"
            }
            data-testid="asset-panel-pin"
            onClick={onToggleLibraryPin}
          >
            Pin
          </button>
        ) : null}
      </div>

      <div className={css.filterRow} data-testid="kit-planting-filters">
        <span className={css.filterMeta} data-testid="kit-shade-hours">
          Shade cell · {sunHours.toFixed(1)} h
        </span>
        <div className={css.filterChips} aria-label="Soil tag">
          {SOIL_OPTS.map((s) => (
            <button
              key={s}
              type="button"
              className={css.filterChip}
              data-active={plantingSoil === s ? "true" : "false"}
              data-testid={`kit-soil-${s}`}
              onClick={() => {
                playInstrumentTick("step");
                onPlantingSoil(s);
              }}
            >
              {SOIL_TAG_LABELS[s]}
            </button>
          ))}
        </div>
        <div className={css.filterChips} aria-label="Aspect tag">
          {ASPECT_OPTS.map((a) => (
            <button
              key={a}
              type="button"
              className={css.filterChip}
              data-active={plantingAspect === a ? "true" : "false"}
              data-testid={`kit-aspect-${a}`}
              onClick={() => {
                playInstrumentTick("step");
                onPlantingAspect(a);
              }}
            >
              {ASPECT_TAG_LABELS[a]}
            </button>
          ))}
        </div>
      </div>

      {searching ? (
        <div
          ref={scrollRef}
          className={css.scroll}
          onScroll={(e) => onScrollTop(e.currentTarget.scrollTop)}
        >
          <div className={css.tray} role="listbox" aria-label="Search results">
            {results.map(symbolChip)}
            {results.length === 0 ? (
              <p className={css.empty}>Nothing in the library matches.</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className={css.scroll}
          onScroll={(e) => onScrollTop(e.currentTarget.scrollTop)}
        >
          <section className={css.section} data-testid="asset-pinned">
            <p className={css.pinnedLabel}>Pinned</p>
            <div className={css.tray} role="listbox" aria-label="Pinned">
              {pinned.map((t) => {
                const on = activeMaterial === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`${css.tile}${on ? ` ${css.tileOn}` : ""}`}
                    data-testid={`paint-swatch-${t}`}
                    title={BY_TYPE[t].tag}
                    onClick={() => pickMaterial(t)}
                  >
                    <span className={css.glyph} aria-hidden>
                      <StudioGlyph type={t} ink />
                    </span>
                    <span className={css.tileLabel}>{BY_TYPE[t].tag}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {libraryGroups.map((group) => (
            <section key={group.category} className={css.section}>
              <button
                type="button"
                className={css.sectionHead}
                aria-expanded={openSection === group.category}
                data-testid={`kit-section-${group.category}`}
                onClick={() => toggleSection(group.category)}
              >
                <span
                  className={css.chevron}
                  data-open={openSection === group.category ? "1" : "0"}
                  aria-hidden
                />
                {group.label}
                <span className={css.count}>{group.symbols.length}</span>
              </button>
              {openSection === group.category ? (
                <div
                  className={css.tray}
                  role="listbox"
                  aria-label={group.label}
                >
                  {group.symbols.map(symbolChip)}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
