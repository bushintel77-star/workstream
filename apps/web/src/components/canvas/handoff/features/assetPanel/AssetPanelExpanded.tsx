"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
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

type CarouselStyle = CSSProperties & {
  "--carousel-angle": string;
  "--carousel-scale": string;
  "--carousel-opacity": string;
};

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
  /** Catalog symbol place — preserves lighting fixture identity. */
  onPickSymbol?: (sym: CatalogSymbol) => void;
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

function AssetCarousel({
  children,
  count,
  focusIndex,
}: {
  children: ReactNode[];
  count: number;
  /** Rotate the ring so this child sits at the front card. */
  focusIndex?: number;
}) {
  const [theta, setTheta] = useState(0);
  const thetaRef = useRef(0);
  const velocityRef = useRef(0);
  const dragRef = useRef<{ x: number; theta: number } | null>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      velocityRef.current *= 0.9;
      thetaRef.current += velocityRef.current;
      if (
        Math.abs(velocityRef.current) > 0.0005 ||
        dragRef.current !== null
      ) {
        setTheta(thetaRef.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Bring the focused card to the front along the shortest arc — picking a
  // Fill rail swatch must present that card for the click that arms it.
  useEffect(() => {
    if (focusIndex == null || focusIndex < 0 || count === 0) return;
    const step = 360 / count;
    const target = -focusIndex * step;
    const current = thetaRef.current;
    const k = Math.round((current - target) / 360);
    const dest = target + k * 360;
    thetaRef.current = dest;
    velocityRef.current = 0;
    setTheta(dest);
  }, [focusIndex, count]);

  const step = count > 0 ? 360 / count : 360;
  const activeIndex =
    count > 0
      ? Math.round((((-theta / step) % count) + count) % count) % count
      : 0;
  const cards = children.map((child, index) => {
    const angle = index * step + theta;
    const normalized = ((angle + 180) % 360) - 180;
    const focus = Math.max(0, Math.cos((normalized * Math.PI) / 180));
    const style: CarouselStyle = {
      "--carousel-angle": `${angle}deg`,
      "--carousel-scale": (0.85 + focus * 0.15).toFixed(3),
      "--carousel-opacity": (0.3 + focus * 0.7).toFixed(3),
    };
    return (
      <div
        className={css.carouselSlot}
        key={index}
        data-active={index === activeIndex ? "true" : "false"}
        style={style}
      >
        {child}
      </div>
    );
  });

  return (
    <div
      className={css.carouselViewport}
      onPointerDown={(event) => {
        // Tiles are buttons — capturing here would retarget their pointerup
        // to the viewport and the tile's click would never fire. Only take
        // the pointer for genuine rotation drags on the viewport itself.
        if ((event.target as HTMLElement).closest("button")) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { x: event.clientX, theta: thetaRef.current };
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) return;
        const delta = event.clientX - dragRef.current.x;
        thetaRef.current = dragRef.current.theta + delta * 0.35;
        velocityRef.current = delta * 0.012;
        setTheta(thetaRef.current);
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onWheel={(event) => {
        event.preventDefault();
        velocityRef.current += event.deltaY * 0.002;
      }}
    >
      <div className={css.carouselTelemetry} aria-hidden>
        <span>CATALOG // ORBITAL</span>
        <span>
          {String(activeIndex + 1).padStart(2, "0")} /{" "}
          {String(count).padStart(2, "0")}
        </span>
      </div>
      <div className={css.carouselReticle} aria-hidden />
      <div className={css.carouselTicks} aria-hidden>
        {Array.from({ length: 13 }, (_, index) => (
          <span
            key={index}
            className={css.carouselTick}
            data-major={index % 3 === 0 ? "true" : "false"}
          />
        ))}
      </div>
      <div className={css.carouselTrack}>{cards}</div>
      <div className={css.carouselHint} aria-hidden>
        DRAG / SCROLL TO ROTATE
      </div>
    </div>
  );
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
  onPickSymbol,
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
    playInstrumentTick("arm");
    if (onPickSymbol) onPickSymbol(sym);
    else onPickMaterial(mapSymbolToStudioType(sym.id));
  };

  const toggleSection = (id: string) => {
    playInstrumentTick("step");
    onOpenSection(openSection === id ? null : id);
  };

  const symbolChip = (sym: CatalogSymbol, carouselIndex?: number) => {
    const mapped = mapSymbolToStudioType(sym.id);
    const on = activeMaterial === mapped;
    const spreadM = sym.default_width_m ?? sym.mature_height_m;
    const scalePct = spreadM
      ? Math.max(12, Math.min(100, (spreadM / 8) * 100))
      : null;
    const sunOn = sym.sun === "full" || sym.sun === "partial";
    const waterOn = sym.water === "moderate" || sym.water === "high";
    return (
      <button
        key={sym.id}
        type="button"
        role="option"
        aria-selected={on}
        className={`${css.tile}${on ? ` ${css.tileOn}` : ""}${carouselIndex != null ? ` ${css.carouselCard}` : ""}`}
        data-testid={`kit-library-${sym.id}`}
        title={
          sym.botanical_name
            ? `${sym.label} · ${sym.botanical_name}`
            : sym.label
        }
        onClick={() => pickSymbol(sym)}
      >
        {carouselIndex != null ? (
          <span className={css.carouselSerial} aria-hidden>
            {String(carouselIndex + 1).padStart(2, "0")}
          </span>
        ) : null}
        <span className={css.glyph} aria-hidden>
          <DesignAssetGlyph symbol={sym} size="sm" />
        </span>
        <span className={css.tileKey}>
          <span className={css.tileTopRow}>
            <span className={css.tileTitle}>{sym.label}</span>
            <span className={css.tileCode}>[{sym.id.toUpperCase()}]</span>
          </span>
          {sym.botanical_name ? (
            <span className={css.tileBotanical}>{sym.botanical_name}</span>
          ) : null}
        </span>
        <span className={css.tileDesc}>
          {sym.sun ? `${sym.sun} sun` : "Catalog asset"}
          {sym.water ? ` · ${sym.water} water` : ""}
        </span>
        {scalePct != null ? (
          <span
            className={css.tileScale}
            title={
              spreadM != null ? `Mature ~${spreadM.toFixed(1)} m` : undefined
            }
            aria-hidden
          >
            <span
              className={css.tileScaleFill}
              style={{ width: `${scalePct}%` }}
            />
          </span>
        ) : null}
        {sym.sun || sym.water ? (
          <span className={css.tileSeasons} aria-hidden>
            <span
              className={css.tileSeasonDot}
              data-kind="sun"
              data-on={sunOn ? "1" : "0"}
            />
            <span
              className={css.tileSeasonDot}
              data-kind="water"
              data-on={waterOn ? "1" : "0"}
            />
            <span className={css.tileSeasonDot} data-on="0" />
          </span>
        ) : null}
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
           {results.length > 0 ? (
             <AssetCarousel count={results.length}>
               {results.map((symbol, index) => symbolChip(symbol, index))}
             </AssetCarousel>
           ) : null}
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
            <p className={css.pinnedLabel}>Pinned assets</p>
            <div
              className={css.tray}
              role="listbox"
              aria-label="Pinned"
              data-testid="asset-carousel-pinned"
            >
              <AssetCarousel
                count={pinned.length}
                focusIndex={pinned.indexOf(paintSwatch ?? armed)}
              >
                {pinned.map((t) => {
                  const on = activeMaterial === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="option"
                      aria-selected={on}
                      className={`${css.tile}${on ? ` ${css.tileOn}` : ""} ${css.carouselCard}`}
                      data-testid={`paint-swatch-${t}`}
                      title={BY_TYPE[t].tag}
                      onClick={() => pickMaterial(t)}
                    >
                      <span className={css.glyph} aria-hidden>
                        <StudioGlyph type={t} ink />
                      </span>
                      <span className={css.tileKey}>
                        <span className={css.tileTopRow}>
                          <span className={css.tileTitle}>{BY_TYPE[t].tag}</span>
                          <span className={css.tileCode}>[{t.toUpperCase()}]</span>
                        </span>
                        <span className={css.tileDesc}>Recent studio asset</span>
                      </span>
                    </button>
                  );
                })}
              </AssetCarousel>
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
                  {group.symbols.length > 0 ? (
                    <AssetCarousel count={group.symbols.length}>
                      {group.symbols.map((symbol, index) =>
                        symbolChip(symbol, index),
                      )}
                    </AssetCarousel>
                  ) : null}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
