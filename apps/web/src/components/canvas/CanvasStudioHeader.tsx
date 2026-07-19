"use client";

import { useEffect, useRef, useState } from "react";
import type { CanvasViewLayers } from "../../lib/canvas-view-layers";
import type { CanvasLayerOpacity } from "../../lib/canvas-layer-opacity";
import type { CanvasMode, CanvasProgress } from "../../lib/canvas-mode";
import { CanvasLayerOpacityPanel } from "./CanvasLayerOpacityPanel";
import { CanvasModeStrip } from "./CanvasModeStrip";
import { SiteSwitcherPopover } from "./SiteSwitcherPopover";
import hdr from "./canvasStudioHeader.module.css";

type WorkingMeta = {
  eyebrow: string;
  detail: string;
};

export type PaperSize = "A3" | "A4";

type Props = {
  projectId: string;
  projectAddress: string;
  mode: CanvasMode;
  progress: CanvasProgress;
  onMode: (mode: CanvasMode) => void;
  paper?: boolean;
  showFitSheet: boolean;
  onToggleFitSheet: () => void;
  paperSize?: PaperSize;
  onPaperSize?: (size: PaperSize) => void;
  sheetElevations?: boolean;
  onToggleSheetElevations?: () => void;
  darkCanvas?: boolean;
  onToggleDarkCanvas?: () => void;
  clientView?: boolean;
  onToggleClientView?: () => void;
  showCadLine?: boolean;
  cadDrawArmed?: boolean;
  onToggleCadDraw?: () => void;
  ghostCount?: number;
  onAcceptGhosts?: () => void;
  keysHelpOn?: boolean;
  onToggleKeysHelp?: () => void;
  workingMeta?: WorkingMeta | null;
  viewLayers?: CanvasViewLayers;
  onViewLayersChange?: (next: CanvasViewLayers) => void;
  layerOpacity?: CanvasLayerOpacity;
  onLayerOpacityChange?: (next: CanvasLayerOpacity) => void;
  layerCounts?: Partial<Record<keyof CanvasLayerOpacity, number>>;
  onOpenCommands?: () => void;
  onShare?: () => void;
  focusChrome?: boolean;
  onToggleFocusChrome?: () => void;
  hideBrand?: boolean;
  clientViewActive?: boolean;
  autosaveLabel?: string | null;
};

export function CanvasStudioHeader({
  projectId,
  projectAddress,
  mode,
  progress,
  onMode,
  paper = false,
  showFitSheet,
  onToggleFitSheet,
  paperSize = "A3",
  onPaperSize,
  sheetElevations = false,
  onToggleSheetElevations,
  darkCanvas = false,
  onToggleDarkCanvas,
  clientView = false,
  onToggleClientView,
  showCadLine = false,
  cadDrawArmed = false,
  onToggleCadDraw,
  ghostCount = 0,
  onAcceptGhosts,
  keysHelpOn = false,
  onToggleKeysHelp,
  workingMeta = null,
  viewLayers,
  onViewLayersChange,
  layerOpacity,
  onLayerOpacityChange,
  layerCounts,
  onOpenCommands,
  onShare,
  focusChrome = false,
  onToggleFocusChrome,
  hideBrand = false,
  clientViewActive = false,
  autosaveLabel = null,
}: Props) {
  const [layersOpen, setLayersOpen] = useState(false);
  const layersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!layersOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!layersRef.current?.contains(e.target as Node)) {
        setLayersOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [layersOpen]);

  if (clientViewActive) {
    return (
      <header
        className={`${hdr.header} ${hdr.headerClient}`}
        data-testid="canvas-studio-header"
      >
        <div className={hdr.brand}>
          <p className={hdr.brandName}>Curtis &amp; Co</p>
          <p className={hdr.address}>{projectAddress}</p>
        </div>
        {onToggleClientView ? (
          <button
            type="button"
            className={hdr.toolBtn}
            onClick={onToggleClientView}
          >
            Exit client view
          </button>
        ) : null}
      </header>
    );
  }

  return (
    <header
      className={`${hdr.header}${paper ? ` ${hdr.headerPaper}` : ""}`}
      data-testid="canvas-studio-header"
    >
      {!hideBrand ? (
        <div className={hdr.brand}>
          <p className={hdr.brandName}>Curtis &amp; Co</p>
          <p className={hdr.address} title={projectAddress}>
            {projectAddress}
          </p>
          {ghostCount > 0 ? (
            <span className={hdr.aiBadge} data-testid="ai-draft-badge">
              AI draft: unverified
            </span>
          ) : null}
          {autosaveLabel ? (
            <span className={hdr.saveTick}>{autosaveLabel}</span>
          ) : null}
        </div>
      ) : null}

      <div className={hdr.modeHost}>
        <CanvasModeStrip
          mode={mode}
          progress={progress}
          onMode={onMode}
          paper={paper}
        />
      </div>

      {workingMeta ? (
        <div className={hdr.meta}>
          <span className={hdr.metaEyebrow}>{workingMeta.eyebrow}</span>
          <span className={hdr.metaDetail}>{workingMeta.detail}</span>
        </div>
      ) : null}

      <div
        className={`${hdr.toolbar}${workingMeta ? ` ${hdr.toolbarWithMeta}` : ""}`}
      >
        {showFitSheet && onPaperSize ? (
          <div className={hdr.segment} data-testid="paper-size-control">
            {(["A3", "A4"] as PaperSize[]).map((size) => (
              <button
                key={size}
                type="button"
                className={`${hdr.segmentBtn}${paperSize === size ? ` ${hdr.segmentBtnActive}` : ""}`}
                aria-pressed={paperSize === size}
                onClick={() => onPaperSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
        ) : null}

        {showFitSheet && onToggleSheetElevations ? (
          <button
            type="button"
            className={`${hdr.toolBtn}${sheetElevations ? ` ${hdr.toolBtnActive}` : ""}`}
            aria-pressed={sheetElevations}
            data-testid="sheet-elevations-top"
            onClick={onToggleSheetElevations}
          >
            {sheetElevations ? "Elevations ✓" : "+ Elevations"}
          </button>
        ) : null}

        <button
          type="button"
          className={`${hdr.toolBtn}${showFitSheet ? ` ${hdr.toolBtnActive}` : ""}`}
          onClick={onToggleFitSheet}
          title="Fit sheet — paper working drawing (F)"
          aria-pressed={showFitSheet}
          data-testid="fit-sheet-top"
        >
          Fit sheet
        </button>

        {onToggleDarkCanvas ? (
          <button
            type="button"
            className={`${hdr.toolBtn}${darkCanvas ? ` ${hdr.toolBtnActive}` : ""}`}
            aria-pressed={darkCanvas}
            data-testid="dark-canvas-top"
            onClick={onToggleDarkCanvas}
          >
            {darkCanvas ? "Light" : "Dark"}
          </button>
        ) : null}

        {showCadLine ? (
          <button
            type="button"
            className={`${hdr.toolBtn}${cadDrawArmed ? ` ${hdr.toolBtnActive}` : ""}`}
            title="Line draw (Space)"
            aria-pressed={cadDrawArmed}
            data-testid="cad-line-top"
            onClick={onToggleCadDraw}
          >
            {cadDrawArmed ? "Line on" : "Line"}
          </button>
        ) : null}

        {layerOpacity && onLayerOpacityChange ? (
          <div className={hdr.popoverWrap} ref={layersRef}>
            <button
              type="button"
              className={`${hdr.toolBtn}${layersOpen ? ` ${hdr.toolBtnActive}` : ""}`}
              aria-expanded={layersOpen}
              data-testid="canvas-layers-top"
              onClick={() => setLayersOpen((v) => !v)}
            >
              ⧉ Layers
            </button>
            {layersOpen ? (
              <div className={hdr.popover} role="dialog" aria-label="Canvas layers">
                <CanvasLayerOpacityPanel
                  opacity={layerOpacity}
                  onOpacityChange={onLayerOpacityChange}
                  counts={layerCounts}
                  viewLayers={viewLayers}
                  onViewLayersChange={onViewLayersChange}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <SiteSwitcherPopover
          currentProjectId={projectId}
          buttonClassName={hdr.toolBtn}
        />

        {onToggleFocusChrome ? (
          <button
            type="button"
            className={`${hdr.toolBtn}${focusChrome ? ` ${hdr.toolBtnActive}` : ""}`}
            aria-pressed={focusChrome}
            data-testid="canvas-focus-top"
            onClick={onToggleFocusChrome}
          >
            Focus
          </button>
        ) : null}

        {onToggleClientView ? (
          <button
            type="button"
            className={`${hdr.toolBtn}${clientView ? ` ${hdr.toolBtnActive}` : ""}`}
            aria-pressed={clientView}
            data-testid="client-view-top"
            onClick={onToggleClientView}
          >
            Client view
          </button>
        ) : null}

        {onShare ? (
          <button type="button" className={hdr.toolBtn} data-testid="share-top" onClick={onShare}>
            Share
          </button>
        ) : null}

        {onToggleKeysHelp ? (
          <button
            type="button"
            className={`${hdr.toolBtn}${keysHelpOn ? ` ${hdr.toolBtnActive}` : ""}`}
            aria-pressed={keysHelpOn}
            onClick={onToggleKeysHelp}
          >
            ?
          </button>
        ) : null}

        {onOpenCommands ? (
          <button
            type="button"
            className={`${hdr.toolBtn} ${hdr.toolBtnIcon}`}
            title="Command palette (⌘K)"
            data-testid="canvas-command-top"
            onClick={onOpenCommands}
          >
            ⌘K
          </button>
        ) : null}

        {ghostCount > 0 && onAcceptGhosts ? (
          <button
            type="button"
            className={`${hdr.toolBtn} ${hdr.toolBtnAccent}`}
            data-testid="header-accept-ghosts"
            onClick={onAcceptGhosts}
          >
            Accept AI ({ghostCount})
          </button>
        ) : null}
      </div>
    </header>
  );
}
