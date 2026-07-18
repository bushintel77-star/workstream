"use client";

import { useState } from "react";
import type { BrushRecipe, CatalogSymbol } from "@workstream/contracts";
import type { StudioAiSuggestion } from "@workstream/domain";
import {
  selectSketchRibbonSymbols,
  type SketchRibbonTab,
} from "@workstream/domain";
import { DesignAssetGlyph } from "../studio/DesignAssetGlyph";
import { SwatchPad } from "../studio/SwatchPad";
import css from "./sketchRibbon.module.css";

type Props = {
  symbols: CatalogSymbol[];
  armedRecipe: BrushRecipe | null;
  brushWidthM: number;
  saving: boolean;
  swatchHistory: BrushRecipe[];
  symbolById: Map<string, CatalogSymbol>;
  aiSuggestions: StudioAiSuggestion[];
  onArm: (symbol: CatalogSymbol) => void;
  onSelectSwatch: (recipe: BrushRecipe) => void;
  onToggleCopy: (
    recipeId: string,
    key: "copy_geometry" | "copy_material" | "copy_pricing",
  ) => void;
  onAiAction: (suggestion: StudioAiSuggestion) => void;
  onDraftCad: () => void;
};

const TABS: Array<{ id: SketchRibbonTab; label: string }> = [
  { id: "essentials", label: "Essentials" },
  { id: "planting", label: "Plant" },
  { id: "hardscape", label: "Hardscape" },
  { id: "ai", label: "AI library" },
];

function actionLabel(s: StudioAiSuggestion): string {
  switch (s.action) {
    case "cad":
      return "Draft CAD";
    case "quote":
      return "Quote";
    case "trp":
      return "Arm TRP";
    case "place":
      return s.symbol_id ? "Place" : "Go";
    default:
      return "Go";
  }
}

/** 2026 floating sketch ribbon - gold assets, tabs, AI coaching. */
export function SketchRibbon({
  symbols,
  armedRecipe,
  brushWidthM,
  saving,
  swatchHistory,
  symbolById,
  aiSuggestions,
  onArm,
  onSelectSwatch,
  onToggleCopy,
  onAiAction,
  onDraftCad,
}: Props) {
  const [tab, setTab] = useState<SketchRibbonTab>("essentials");
  const tray = selectSketchRibbonSymbols(symbols, tab, 14);
  const leadAi = aiSuggestions[0] ?? null;

  return (
    <div
      className={css.ribbon}
      data-testid="sketch-ribbon"
      role="region"
      aria-label="Sketch ribbon"
    >
      {leadAi ? (
        <div className={css.aiStrip} data-testid="sketch-ribbon-ai">
          <span className={css.aiBadge}>AI</span>
          <div className={css.aiCopy}>
            <strong>{leadAi.title}</strong>
            <span>{leadAi.detail}</span>
          </div>
          <button
            type="button"
            className={css.aiCta}
            onClick={() => onAiAction(leadAi)}
          >
            {actionLabel(leadAi)}
          </button>
          {leadAi.action !== "cad" ? (
            <button type="button" className={css.aiGhost} onClick={onDraftCad}>
              CAD
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={css.tabs} role="tablist" aria-label="Asset sets">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`${css.tab} ${tab === t.id ? css.tabOn : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={css.tray} role="toolbar" aria-label="Gold-standard materials">
        {tray.map((sym) => {
          const active = armedRecipe?.symbol_id === sym.id;
          const w = sym.default_width_m ?? 1.2;
          return (
            <button
              key={sym.id}
              type="button"
              className={`${css.trayBtn} ${active ? css.trayBtnOn : ""}`}
              title={`${sym.label} · ${w.toFixed(1)} m`}
              data-testid={`sketch-ribbon-${sym.id}`}
              onClick={() => onArm(sym)}
            >
              <DesignAssetGlyph symbol={sym} size="sm" />
              <span className={css.trayMeta}>{w.toFixed(1)}m</span>
            </button>
          );
        })}
      </div>

      <SwatchPad
        slots={swatchHistory}
        activeId={armedRecipe?.id ?? null}
        symbolById={symbolById}
        onSelect={onSelectSwatch}
        onToggleCopy={onToggleCopy}
      />

      <p className={css.status}>
        {armedRecipe
          ? `Snap · ${brushWidthM.toFixed(1)} m brush · stamp or drag · Esc clears`
          : "Gold library · sized to aerial · Alt+click samples"}
        {saving ? " · Saving?" : ""}
      </p>
    </div>
  );
}
