"use client";

import { useMemo, useState } from "react";
import {
  CURTIS_DESIGN_ASSETS,
  OSMIC_LANDSCAPE_SYMBOLS,
  PLANZV_DESIGN_SYMBOLS,
  WIKIMEDIA_TREE_SYMBOLS,
  selectSketchRibbonSymbols,
  type SketchRibbonTab,
} from "@workstream/domain";
import type { CatalogSymbol } from "@workstream/contracts";
import { DesignAssetGlyph } from "../../../../studio/DesignAssetGlyph";
import { StudioGlyph } from "../../StudioGlyph";
import {
  BY_TYPE,
  KIT_BAGS,
  type KitBagId,
  type StudioItemType,
  type StudioMode,
} from "../../studioCatalog";
import { mapSymbolToStudioType } from "../../state/studioAiEngine";
import { playInstrumentTick } from "../ambient/instrumentTick";
import css from "./kitAssetDock.module.css";

export type KitDockTab = KitBagId | "library";

type Props = {
  mode: StudioMode;
  /** Armed place type, if any. */
  armed: StudioItemType | null;
  /** Selected item type — highlights matching chip when retyping. */
  selectedType: StudioItemType | null;
  paintSwatch: StudioItemType;
  tool: string;
  onArmMaterial: (t: StudioItemType) => void;
  onPaintMaterial: (t: StudioItemType) => void;
  onRetypeSelected: (t: StudioItemType) => void;
};

const DRAFT_TABS: Array<{ id: KitDockTab; label: string }> = [
  { id: "soft", label: "Soft" },
  { id: "hard", label: "Hard" },
  { id: "trees", label: "Trees" },
  { id: "water", label: "Water" },
  { id: "library", label: "Library" },
];

const LIBRARY_SUB: Array<{ id: SketchRibbonTab; label: string }> = [
  { id: "essentials", label: "Essentials" },
  { id: "planting", label: "Planting" },
  { id: "hardscape", label: "Hardscape" },
  { id: "ai", label: "AI CAD" },
];

function libraryPool(): CatalogSymbol[] {
  return [
    ...CURTIS_DESIGN_ASSETS,
    ...OSMIC_LANDSCAPE_SYMBOLS,
    ...PLANZV_DESIGN_SYMBOLS,
    ...WIKIMEDIA_TREE_SYMBOLS,
  ];
}

function typesForTab(tab: KitBagId, mode: StudioMode): StudioItemType[] {
  const bag = KIT_BAGS.find((b) => b.id === tab);
  if (!bag) return [];
  if (mode === "survey") return bag.types.filter((t) => t === "exist");
  return bag.types.filter((t) => t !== "exist" || tab === "trees");
}

/**
 * Bottom asset dock — gold-standard canvas inventory.
 * Soft / Hard / Trees / Water drafting chips + open-source Library
 * (Curtis, Osmic, PlanZV, Wikimedia). Never overlays the selected object.
 */
export function KitAssetDock({
  mode,
  armed,
  selectedType,
  paintSwatch,
  tool,
  onArmMaterial,
  onPaintMaterial,
  onRetypeSelected,
}: Props) {
  const [tab, setTab] = useState<KitDockTab>("soft");
  const [libSub, setLibSub] = useState<SketchRibbonTab>("essentials");

  const draftTypes = useMemo(() => {
    if (tab === "library") return [];
    return typesForTab(tab, mode);
  }, [tab, mode]);

  const librarySymbols = useMemo(() => {
    if (tab !== "library") return [];
    return selectSketchRibbonSymbols(libraryPool(), libSub, 16);
  }, [tab, libSub]);

  const pickMaterial = (t: StudioItemType) => {
    playInstrumentTick("arm");
    if (selectedType) {
      onRetypeSelected(t);
      return;
    }
    if (tool === "paint") {
      onPaintMaterial(t);
      return;
    }
    onArmMaterial(t);
  };

  const pickSymbol = (sym: CatalogSymbol) => {
    pickMaterial(mapSymbolToStudioType(sym.id));
  };

  const activeMaterial =
    selectedType ?? (tool === "paint" ? paintSwatch : armed);

  return (
    <aside
      className={css.dock}
      data-testid="kit-asset-dock"
      aria-label="Asset library"
    >
      <div className={css.tabs} role="tablist" aria-label="Asset families">
        {DRAFT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`${css.tab}${tab === t.id ? ` ${css.tabOn}` : ""}`}
            data-testid={`kit-dock-tab-${t.id}`}
            onClick={() => {
              playInstrumentTick("step");
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "library" ? (
        <div className={css.subTabs} role="tablist" aria-label="Library packs">
          {LIBRARY_SUB.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={libSub === s.id}
              className={`${css.subTab}${libSub === s.id ? ` ${css.subTabOn}` : ""}`}
              onClick={() => {
                playInstrumentTick("step");
                setLibSub(s.id);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className={css.tray} role="listbox" aria-label="Symbols">
        {tab !== "library"
          ? draftTypes.map((t) => {
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
            })
          : librarySymbols.map((sym) => {
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
                  title={sym.label}
                  onClick={() => pickSymbol(sym)}
                >
                  <span className={css.glyph} aria-hidden>
                    <DesignAssetGlyph symbol={sym} size="sm" />
                  </span>
                  <span className={css.label}>{sym.label}</span>
                </button>
              );
            })}
        {tab === "library" && librarySymbols.length === 0 ? (
          <p className={css.empty}>No library symbols in this pack.</p>
        ) : null}
      </div>
    </aside>
  );
}
