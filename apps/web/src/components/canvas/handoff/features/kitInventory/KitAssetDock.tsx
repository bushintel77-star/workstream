"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
import { resolveDockAnchor } from "../reach/dockAnchor";
import { ATELIER_LINGER_MS, type AtelierPhase } from "./atelierPresence";
import css from "./kitAssetDock.module.css";

const SOIL_OPTS: SoilTag[] = ["any", "clay", "loam", "sand"];
const ASPECT_OPTS: AspectTag[] = ["any", "N", "E", "S", "W"];

type Props = {
  /** Board-% — instrument summon point (margin), never object centre. */
  xPct: number;
  yPct: number;
  mode: StudioMode;
  armed: StudioItemType | null;
  paintSwatch: StudioItemType;
  tool: "add" | "paint";
  /** Indicative sun hours at summon cell (shade mesh sample). */
  sunHours: number;
  plantingSoil: SoilTag;
  plantingAspect: AspectTag;
  onPlantingSoil: (s: SoilTag) => void;
  onPlantingAspect: (a: AspectTag) => void;
  onArmMaterial: (t: StudioItemType) => void;
  onPaintMaterial: (t: StudioItemType) => void;
  onDismiss?: () => void;
};

const DRAFT_SECTION_ID = "draft";

function draftKitTypes(mode: StudioMode): StudioItemType[] {
  const all = KIT_BAGS.flatMap((b) => b.types);
  return mode === "survey" ? all.filter((t) => t === "exist") : all;
}

/**
 * Fold-out asset library — one summoned frost popup for everything placeable:
 * search across the whole gold catalog, Draft kit materials first, then every
 * catalog category as a collapsible section (one open at a time).
 * Binding: docs/STUDIO-STYLING-AND-UX.md
 */
export function KitAssetDock({
  xPct,
  yPct,
  mode,
  armed,
  paintSwatch,
  tool,
  sunHours,
  plantingSoil,
  plantingAspect,
  onPlantingSoil,
  onPlantingAspect,
  onArmMaterial,
  onPaintMaterial,
  onDismiss,
}: Props) {
  const [openSection, setOpenSection] = useState<string | null>(
    DRAFT_SECTION_ID,
  );
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState(false);
  const [lingering, setLingering] = useState(true);
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverRef = useRef(false);

  const clearLinger = useCallback(() => {
    if (lingerTimer.current) {
      clearTimeout(lingerTimer.current);
      lingerTimer.current = null;
    }
  }, []);

  const beginLinger = useCallback(() => {
    clearLinger();
    setLingering(true);
    lingerTimer.current = setTimeout(() => {
      setLingering(false);
      lingerTimer.current = null;
      if (!hoverRef.current) onDismiss?.();
    }, ATELIER_LINGER_MS);
  }, [clearLinger, onDismiss]);

  const stayEngaged = useCallback(() => {
    clearLinger();
    setLingering(true);
  }, [clearLinger]);

  useEffect(() => {
    if (hoverRef.current) {
      stayEngaged();
      return clearLinger;
    }
    beginLinger();
    return clearLinger;
  }, [tool, armed, beginLinger, stayEngaged, clearLinger]);

  const phase: AtelierPhase = hover ? "open" : lingering ? "linger" : "rest";

  const draftTypes = useMemo(() => draftKitTypes(mode), [mode]);

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

  const pickMaterial = (t: StudioItemType) => {
    playInstrumentTick("arm");
    stayEngaged();
    if (tool === "paint") {
      onPaintMaterial(t);
      return;
    }
    onArmMaterial(t);
  };

  const pickSymbol = (sym: CatalogSymbol) => {
    pickMaterial(mapSymbolToStudioType(sym.id));
  };

  const toggleSection = (id: string) => {
    playInstrumentTick("step");
    stayEngaged();
    setOpenSection((cur) => (cur === id ? null : id));
  };

  const activeMaterial = tool === "paint" ? paintSwatch : armed;
  /* Edge-anchor into the board so the popup never clips at the gutter. */
  const anchor = resolveDockAnchor(xPct, yPct);

  const symbolChip = (sym: CatalogSymbol) => {
    const mapped = mapSymbolToStudioType(sym.id);
    const on = activeMaterial === mapped;
    return (
      <button
        key={sym.id}
        type="button"
        role="option"
        aria-selected={on}
        className={`${css.chip}${on ? ` ${css.chipOn}` : ""}`}
        data-testid={`kit-library-${sym.id}`}
        title={sym.botanical_name ? `${sym.label} · ${sym.botanical_name}` : sym.label}
        onClick={() => pickSymbol(sym)}
      >
        <span className={css.glyph} aria-hidden>
          <DesignAssetGlyph symbol={sym} size="sm" />
        </span>
        <span className={css.label}>{sym.label}</span>
      </button>
    );
  };

  return (
    <aside
      className={css.popup}
      data-testid="kit-asset-dock"
      data-phase={phase}
      data-side={anchor.side}
      aria-label="Asset library"
      style={{ left: `${anchor.x}%`, top: `${anchor.y}%` } as CSSProperties}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={() => {
        hoverRef.current = true;
        stayEngaged();
        setHover(true);
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
        setHover(false);
        beginLinger();
      }}
    >
      <input
        type="search"
        className={css.search}
        value={query}
        placeholder="Search plants, hardscape, lighting…"
        aria-label="Search asset library"
        data-testid="kit-library-search"
        onChange={(e) => {
          setQuery(e.target.value);
          stayEngaged();
        }}
        onFocus={stayEngaged}
      />

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
                stayEngaged();
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
                stayEngaged();
                onPlantingAspect(a);
              }}
            >
              {ASPECT_TAG_LABELS[a]}
            </button>
          ))}
        </div>
      </div>

      {searching ? (
        <div className={css.scroll}>
          <div className={css.tray} role="listbox" aria-label="Search results">
            {results.map(symbolChip)}
            {results.length === 0 ? (
              <p className={css.empty}>Nothing in the library matches.</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className={css.scroll}>
          <section className={css.section}>
            <button
              type="button"
              className={css.sectionHead}
              aria-expanded={openSection === DRAFT_SECTION_ID}
              data-testid="kit-section-draft"
              onClick={() => toggleSection(DRAFT_SECTION_ID)}
            >
              <span
                className={css.chevron}
                data-open={openSection === DRAFT_SECTION_ID ? "1" : "0"}
                aria-hidden
              />
              Draft kit
              <span className={css.count}>{draftTypes.length}</span>
            </button>
            {openSection === DRAFT_SECTION_ID ? (
              <div className={css.tray} role="listbox" aria-label="Draft kit">
                {draftTypes.map((t) => {
                  const on = activeMaterial === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="option"
                      aria-selected={on}
                      className={`${css.chip}${on ? ` ${css.chipOn}` : ""}`}
                      data-testid={`paint-swatch-${t}`}
                      title={BY_TYPE[t].tag}
                      onClick={() => pickMaterial(t)}
                    >
                      <span className={css.glyph} aria-hidden>
                        <StudioGlyph type={t} ink />
                      </span>
                      <span className={css.label}>{BY_TYPE[t].tag}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
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
                <div className={css.tray} role="listbox" aria-label={group.label}>
                  {group.symbols.map(symbolChip)}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </aside>
  );
}
