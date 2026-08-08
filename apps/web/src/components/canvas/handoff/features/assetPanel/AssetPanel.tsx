"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type {
  AspectTag,
  HardscapeEdgeType,
  PathFilletLockM,
  PathWidthLockM,
  SoilTag,
} from "@workstream/domain";
import { CameraChrome } from "../../CameraChrome";
import {
  PAINT_SWATCHES,
  type StudioItemType,
  type StudioMode,
  type StudioTool,
} from "../../studioCatalog";
import { AssetPanelExpanded } from "./AssetPanelExpanded";
import { AssetPanelPlacing } from "./AssetPanelPlacing";
import {
  categoryForSwatch,
  needsPathGrammar,
  type LeftAssetPanel,
  type LeftAssetRestore,
} from "./leftAssetPanel";
import css from "./assetPanel.module.css";

type Props = {
  panel: LeftAssetPanel;
  restore: LeftAssetRestore | null;
  activeSwatch: StudioItemType;
  paintArmed: boolean;
  eyedropOn: boolean;
  night?: boolean;
  mode: StudioMode;
  armed: StudioItemType | null;
  tool: StudioTool;
  sunHours: number;
  plantingSoil: SoilTag;
  plantingAspect: AspectTag;
  pathWidthM: PathWidthLockM;
  edgeType: HardscapeEdgeType;
  pathFilletM: PathFilletLockM;
  pathDrafting: boolean;
  /** Prefetch accordion section when opening from a rail icon. */
  expandSection?: string | null;
  focusSearchOnExpand?: boolean;
  /** Keep expanded library through place / canvas interact. */
  libraryPinned?: boolean;
  onToggleLibraryPin?: () => void;
  onExpand: (opts?: {
    section?: string | null;
    focusSearch?: boolean;
  }) => void;
  onEnterPlacing: (restore: LeftAssetRestore, t: StudioItemType) => void;
  onBackFromPlacing: () => void;
  onRailPick: (t: StudioItemType) => void;
  onEyedrop: () => void;
  onPreview?: (t: StudioItemType | null) => void;
  onPlantingSoil: (s: SoilTag) => void;
  onPlantingAspect: (a: AspectTag) => void;
  onPickMaterial: (t: StudioItemType) => void;
  onPickSymbol?: (sym: import("@workstream/contracts").CatalogSymbol) => void;
  onPathWidth: (w: PathWidthLockM) => void;
  onEdgeType: (e: HardscapeEdgeType) => void;
  onPathFillet: (r: PathFilletLockM) => void;
  onBeginPath: () => void;
};

/**
 * Unified left asset panel — collapsed Fill rail → expanded library → Path Grammar.
 * Collapsed, it is seated in the gallery frame's left band (transparent, flat).
 * Expanded / placing, it becomes a dark translucent panel that reaches over the
 * plan. One frame slot; never coexists with a second asset floater.
 */
export function AssetPanel({
  panel,
  restore,
  activeSwatch,
  paintArmed,
  eyedropOn,
  night = false,
  mode,
  armed,
  tool,
  sunHours,
  plantingSoil,
  plantingAspect,
  pathWidthM,
  edgeType,
  pathFilletM,
  pathDrafting,
  expandSection = null,
  focusSearchOnExpand = false,
  libraryPinned = false,
  onToggleLibraryPin,
  onExpand,
  onEnterPlacing,
  onBackFromPlacing,
  onRailPick,
  onEyedrop,
  onPreview,
  onPlantingSoil,
  onPlantingAspect,
  onPickMaterial,
  onPickSymbol,
  onPathWidth,
  onEdgeType,
  onPathFillet,
  onBeginPath,
}: Props) {
  const [query, setQuery] = useState(restore?.query ?? "");
  const [openSection, setOpenSection] = useState<string | null>(
    restore?.openSection ?? expandSection,
  );
  const [scrollTop, setScrollTop] = useState(restore?.scrollTop ?? 0);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const stateKey = panel ?? "collapsed";

  useEffect(() => {
    if (panel === "expanded" && expandSection != null) {
      setOpenSection(expandSection);
    }
  }, [panel, expandSection]);

  useEffect(() => {
    if (panel === "expanded" && restore) {
      setQuery(restore.query);
      setOpenSection(restore.openSection);
      setScrollTop(restore.scrollTop);
    }
  }, [panel, restore]);

  const libraryTool =
    tool === "paint" || tool === "add" || tool === "path" || tool === "select"
      ? tool
      : "add";

  return (
    <CameraChrome place={{ kind: "frame" }} testId="asset-panel-chrome">
      <aside
        className={`${css.panel}${night ? ` ${css.panelNight}` : ""}`}
        data-frame-rail="left-assets"
        data-testid="asset-panel"
        data-state={stateKey}
        aria-label="Asset library"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className={css.rail} data-testid="swatch-tray">
          <p className={css.kicker} aria-hidden>
            Fill
          </p>
          <div className={css.stack} role="listbox" aria-label="Fill swatches">
            {PAINT_SWATCHES.map((sw) => {
              const on = paintArmed && sw.t === activeSwatch;
              return (
                <button
                  key={sw.t}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`${css.swatch}${on ? ` ${css.swatchOn}` : ""}`}
                  data-testid={`swatch-${sw.t}`}
                  title={`${sw.label} — open library filtered to this material`}
                  style={{ ["--wash" as string]: sw.wash } as CSSProperties}
                  onClick={() => {
                    if (panel === null) {
                      onExpand({ section: categoryForSwatch(sw.t) });
                      onRailPick(sw.t);
                      return;
                    }
                    if (panel === "expanded") {
                      setOpenSection(categoryForSwatch(sw.t));
                      onRailPick(sw.t);
                      return;
                    }
                    onRailPick(sw.t);
                  }}
                  onPointerEnter={() => onPreview?.(sw.t)}
                  onPointerLeave={() => onPreview?.(null)}
                  onBlur={() => onPreview?.(null)}
                >
                  <span className={css.chip} aria-hidden />
                  <span className={css.label}>{sw.label}</span>
                </button>
              );
            })}
          </div>

          <div className={css.divider} aria-hidden />

          <button
            type="button"
            className={css.swatch}
            data-testid="asset-panel-search-open"
            title="Search asset library"
            aria-label="Search asset library"
            onClick={() => onExpand({ focusSearch: true })}
          >
            <span className={css.toolGlyph} aria-hidden>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                <circle
                  cx="7"
                  cy="7"
                  r="4.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path
                  d="M10.5 10.5 13.5 13.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className={css.label}>Search</span>
          </button>

          <button
            type="button"
            className={`${css.swatch}${eyedropOn ? ` ${css.swatchOn}` : ""}`}
            data-testid="swatch-eyedrop"
            aria-pressed={eyedropOn}
            title="Eyedropper — click any element to load its style"
            onClick={onEyedrop}
          >
            <span className={css.toolGlyph} aria-hidden>
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
                <path
                  d="M10.5 2.5a1.6 1.6 0 0 1 2.3 2.3l-1 1 .8.8-1.1 1.1-.8-.8-4.5 4.5-2.4.7.7-2.4 4.5-4.5-.8-.8L9.3 3.3l.4-.4z"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className={css.label}>Pick</span>
          </button>
        </div>

        {panel === "expanded" ? (
          <AssetPanelExpanded
            mode={mode}
            armed={armed}
            paintSwatch={activeSwatch}
            tool={libraryTool}
            sunHours={sunHours}
            plantingSoil={plantingSoil}
            plantingAspect={plantingAspect}
            query={query}
            openSection={openSection}
            scrollTop={scrollTop}
            focusSearch={focusSearchOnExpand}
            searchRef={searchRef}
            onQuery={setQuery}
            onOpenSection={setOpenSection}
            onScrollTop={setScrollTop}
            onPlantingSoil={onPlantingSoil}
            onPlantingAspect={onPlantingAspect}
            libraryPinned={libraryPinned}
            onToggleLibraryPin={onToggleLibraryPin}
            onPickMaterial={(t) => {
              if (needsPathGrammar(t)) {
                onEnterPlacing({ query, openSection, scrollTop }, t);
                return;
              }
              onPickMaterial(t);
            }}
            onPickSymbol={onPickSymbol}
          />
        ) : null}

        {panel === "placing" ? (
          <AssetPanelPlacing
            pathWidthM={pathWidthM}
            edgeType={edgeType}
            pathFilletM={pathFilletM}
            pathDrafting={pathDrafting}
            onBack={onBackFromPlacing}
            onPathWidth={onPathWidth}
            onEdgeType={onEdgeType}
            onPathFillet={onPathFillet}
            onBeginPath={onBeginPath}
          />
        ) : null}
      </aside>
    </CameraChrome>
  );
}
