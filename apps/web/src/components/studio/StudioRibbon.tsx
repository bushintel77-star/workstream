"use client";

import type { ToolOverride } from "./studioTypes";
import rb from "./studioRibbon.module.css";

export type RibbonTab = "home" | "plant" | "annotate" | "ai";

type Props = {
  ribbonTab: RibbonTab;
  onRibbonTab: (tab: RibbonTab) => void;
  toolOverride: ToolOverride;
  onTool: (tool: ToolOverride) => void;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onOpenAiRail: () => void;
  canUndo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canRedo: boolean;
  saveStatus: React.ReactNode;
  saveButton: React.ReactNode;
  tier1?: boolean;
};

export function StudioRibbon({
  ribbonTab,
  onRibbonTab,
  toolOverride,
  onTool,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onResetView,
  onOpenAiRail,
  canUndo,
  onUndo,
  onRedo,
  canRedo,
  saveStatus,
  saveButton,
  tier1 = false,
}: Props) {
  const toolBtn = (tool: ToolOverride, label: string, title: string) => (
    <button
      type="button"
      className={`${rb.btn} ${toolOverride === tool ? rb.btnActive : ""}`}
      aria-pressed={toolOverride === tool}
      title={title}
      onClick={() => onTool(tool)}
    >
      {label}
    </button>
  );

  return (
    <div className={rb.ribbon} role="toolbar" aria-label="Studio ribbon">
      <div className={rb.tabRow} role="tablist" aria-label="Ribbon sections">
        {(
          [
            ["ai", "AI assist", true],
            ["home", "Home", false],
            ["plant", "Plant", false],
            ["annotate", "Annotate", false],
          ] as const
        ).map(([id, label, ai]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={ribbonTab === id}
            className={`${rb.tab} ${ribbonTab === id ? rb.tabActive : ""} ${ai ? rb.tabAi : ""}`}
            onClick={() => {
              onRibbonTab(id);
              if (id === "ai") onOpenAiRail();
            }}
          >
            {label}
            {tier1 && id === "ai" ? " · T1" : null}
          </button>
        ))}
      </div>

      <div className={rb.body}>
        {ribbonTab === "home" || ribbonTab === "ai" ? (
          <div className={rb.cluster}>
            <span className={rb.clusterLabel}>Navigate</span>
            <div className={rb.btnGroup}>
              {toolBtn("pan", "Hand", "Pan (Space)")}
              {toolBtn(null, "Auto", "Auto mode")}
              {toolBtn("select", "Select", "Select (V)")}
            </div>
          </div>
        ) : null}

        {ribbonTab === "home" || ribbonTab === "plant" || ribbonTab === "ai" ? (
          <div className={rb.cluster}>
            <span className={rb.clusterLabel}>Place</span>
            <div className={rb.btnGroup}>
              {toolBtn("place", "Place", "Place (P)")}
              {toolBtn("massplant", "Mass", "Mass plant bed")}
              {toolBtn("irrigation", "Irrigate", "Irrigation zones")}
            </div>
          </div>
        ) : null}

        {ribbonTab === "annotate" || ribbonTab === "home" ? (
          <div className={rb.cluster}>
            <span className={rb.clusterLabel}>Markup</span>
            <div className={rb.btnGroup}>
              {toolBtn("draw", "Draw", "Draw (D)")}
              {toolBtn("measure", "Measure", "Measure (M)")}
            </div>
          </div>
        ) : null}

        <div className={rb.cluster}>
          <span className={rb.clusterLabel}>View</span>
          <div className={rb.btnGroup}>
            <button type="button" className={rb.btn} title="Zoom out (-)" onClick={onZoomOut}>
              −
            </button>
            <span className={rb.zoomReadout} aria-live="polite">
              {zoomPercent}%
            </span>
            <button type="button" className={rb.btn} title="Zoom in (+)" onClick={onZoomIn}>
              +
            </button>
            <button type="button" className={rb.btn} title="Reset view (0)" onClick={onResetView}>
              Fit
            </button>
          </div>
        </div>

        <div className={rb.cluster}>
          <span className={rb.clusterLabel}>Edit</span>
          <div className={rb.btnGroup}>
            <button
              type="button"
              className={rb.btn}
              disabled={!canUndo}
              onClick={onUndo}
              title="Undo"
            >
              Undo
            </button>
            <button
              type="button"
              className={rb.btn}
              disabled={!canRedo}
              onClick={onRedo}
              title="Redo"
            >
              Redo
            </button>
          </div>
        </div>

        {ribbonTab === "ai" ? (
          <div className={rb.cluster}>
            <span className={rb.clusterLabel}>AI</span>
            <div className={rb.btnGroup}>
              <button
                type="button"
                className={`${rb.btn} ${rb.btnAccent}`}
                onClick={onOpenAiRail}
              >
                Open AI rail
              </button>
            </div>
          </div>
        ) : null}

        <div className={rb.actions}>
          {saveStatus}
          {saveButton}
        </div>
      </div>
    </div>
  );
}
