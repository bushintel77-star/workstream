"use client";

import { useMemo, useState, type RefObject } from "react";
import type { BrushRecipe, CatalogSymbol } from "@workstream/contracts";
import type { StudioAiSuggestion } from "@workstream/domain";
import {
  CATALOG_PLANNING_SYMBOL_IDS,
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
  saveStatusLabel: string;
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
  onScanGhosts: () => void;
  onOpenCommands: () => void;
  onSubmitAssist: (message: string) => void;
  assistReply: string | null;
  assistPending: boolean;
  assistInputRef?: RefObject<HTMLTextAreaElement | null>;
  ghostsActive?: boolean;
};

const TABS: Array<{ id: SketchRibbonTab; label: string }> = [
  { id: "essentials", label: "Essentials" },
  { id: "planting", label: "Plant" },
  { id: "hardscape", label: "Hardscape" },
  { id: "ai", label: "Planning" },
];

function actionLabel(s: StudioAiSuggestion): string {
  switch (s.action) {
    case "cad":
      return "Draft CAD";
    case "quote":
      return "Quote";
    case "save":
      return "Save";
    case "trp":
      return "Arm TRP";
    case "place":
      return s.symbol_id ? "Place" : "Go";
    default:
      return "Go";
  }
}

function skuLabel(sym: CatalogSymbol): string {
  if (sym.rate_card_sku) return sym.rate_card_sku;
  return sym.id.slice(0, 10).toUpperCase();
}

/** Floating sketch ribbon - gold assets, AI coaching, search. */
export function SketchRibbon({
  symbols,
  armedRecipe,
  brushWidthM,
  saveStatusLabel,
  swatchHistory,
  symbolById,
  aiSuggestions,
  onArm,
  onSelectSwatch,
  onToggleCopy,
  onAiAction,
  onDraftCad,
  onScanGhosts,
  onOpenCommands,
  onSubmitAssist,
  assistReply,
  assistPending,
  assistInputRef,
  ghostsActive = false,
}: Props) {
  const [tab, setTab] = useState<SketchRibbonTab>("essentials");
  const [query, setQuery] = useState("");
  const [assistDraft, setAssistDraft] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const trayBase = selectSketchRibbonSymbols(symbols, tab, 24);
  const tray = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trayBase.slice(0, 14);
    return trayBase
      .filter(
        (sym) =>
          sym.label.toLowerCase().includes(q) ||
          sym.id.toLowerCase().includes(q) ||
          (sym.rate_card_sku ?? "").toLowerCase().includes(q),
      )
      .slice(0, 14);
  }, [query, trayBase]);

  const leadAi = aiSuggestions[0] ?? null;

  return (
    <div
      className={`${css.ribbon} ${collapsed ? css.ribbonCollapsed : ""} ${ghostsActive ? css.ribbonGhostActive : ""}`}
      data-testid="sketch-ribbon"
      role="region"
      aria-label="Sketch ribbon"
    >
      <div className={css.ribbonHead}>
        <button
          type="button"
          className={css.collapseBtn}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? "Show tools" : "Hide tools"}
        </button>
        <span className={css.saveStatus} data-testid="sketch-save-status">
          {saveStatusLabel}
        </span>
        <button
          type="button"
          className={css.cmdBtn}
          onClick={onOpenCommands}
          title="Command palette (Ctrl+K)"
          data-testid="sketch-ribbon-cmd"
        >
          Cmd
        </button>
      </div>

      {!collapsed ? (
        <>
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
              <button
                type="button"
                className={css.aiGhost}
                onClick={onScanGhosts}
              >
                Scan
              </button>
              {leadAi.action !== "cad" ? (
                <button type="button" className={css.aiGhost} onClick={onDraftCad}>
                  CAD
                </button>
              ) : null}
            </div>
          ) : null}

          <div className={css.assistBar} data-testid="sketch-assist-bar">
            <textarea
              ref={assistInputRef}
              className={css.assistInput}
              value={assistDraft}
              onChange={(e) => setAssistDraft(e.target.value)}
              placeholder="Ask AI: mass Lomandra along the north boundary..."
              aria-label="AI sketch assist"
              rows={2}
              disabled={assistPending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (assistDraft.trim()) {
                    onSubmitAssist(assistDraft);
                    setAssistDraft("");
                  }
                }
              }}
            />
            <button
              type="button"
              className={css.assistSubmit}
              disabled={assistPending || !assistDraft.trim()}
              data-testid="sketch-assist-submit"
              onClick={() => {
                onSubmitAssist(assistDraft);
                setAssistDraft("");
              }}
            >
              {assistPending ? "Thinking..." : "Ask AI"}
            </button>
            {assistReply ? (
              <p className={css.assistReply} data-testid="sketch-assist-reply">
                {assistReply}
              </p>
            ) : null}
          </div>

          <input
            className={css.search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or SKU..."
            aria-label="Search materials"
          />

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

          <div className={css.tray} role="toolbar" aria-label="Materials">
            {tray.map((sym) => {
              const active = armedRecipe?.symbol_id === sym.id;
              const w = sym.default_width_m ?? 1.2;
              const planning = CATALOG_PLANNING_SYMBOL_IDS.has(sym.id);
              return (
                <button
                  key={sym.id}
                  type="button"
                  className={`${css.trayBtn} ${active ? css.trayBtnOn : ""} ${planning ? css.trayBtnPlanning : ""}`}
                  title={`${sym.label} | ${skuLabel(sym)} | ${w.toFixed(1)} m`}
                  data-testid={`sketch-ribbon-${sym.id}`}
                  onClick={() => onArm(sym)}
                >
                  <DesignAssetGlyph symbol={sym} size="sm" />
                  <span className={css.trayCode}>{skuLabel(sym)}</span>
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
              ? `Snap | ${brushWidthM.toFixed(1)} m brush | stamp or drag | Esc clears`
              : "Gold library | sized to aerial | Alt+click samples | Ctrl+K commands"}
          </p>
        </>
      ) : null}
    </div>
  );
}
