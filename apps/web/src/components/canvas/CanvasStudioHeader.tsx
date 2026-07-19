"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CanvasViewLayers } from "../../lib/canvas-view-layers";
import type { CanvasLayerOpacity } from "../../lib/canvas-layer-opacity";
import type { CanvasMode, CanvasProgress } from "../../lib/canvas-mode";
import { CanvasLayerOpacityPanel } from "./CanvasLayerOpacityPanel";
import { CanvasModeStrip } from "./CanvasModeStrip";
import hdr from "./canvasStudioHeader.module.css";

type WorkingMeta = {
  eyebrow: string;
  detail: string;
};

type Props = {
  projectAddress: string;
  mode: CanvasMode;
  progress: CanvasProgress;
  onMode: (mode: CanvasMode) => void;
  paper?: boolean;
  showFitSheet: boolean;
  onToggleFitSheet: () => void;
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
  focusChrome?: boolean;
  onToggleFocusChrome?: () => void;
  hideBrand?: boolean;
};

export function CanvasStudioHeader({
  projectAddress,
  mode,
  progress,
  onMode,
  paper = false,
  showFitSheet,
  onToggleFitSheet,
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
  focusChrome = false,
  onToggleFocusChrome,
  hideBrand = false,
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
              aria-haspopup="dialog"
              data-testid="canvas-layers-top"
              onClick={() => setLayersOpen((v) => !v)}
            >
              Layers
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

        {onToggleFocusChrome ? (
          <button
            type="button"
            className={`${hdr.toolBtn}${focusChrome ? ` ${hdr.toolBtnActive}` : ""}`}
            aria-pressed={focusChrome}
            title="Focus — hide side panels"
            data-testid="canvas-focus-top"
            onClick={onToggleFocusChrome}
          >
            Focus
          </button>
        ) : null}

        <Link href="/" className={hdr.toolBtn}>
          Sites
        </Link>

        {onToggleKeysHelp ? (
          <button
            type="button"
            className={`${hdr.toolBtn}${keysHelpOn ? ` ${hdr.toolBtnActive}` : ""}`}
            title="Keyboard shortcuts (?)"
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
