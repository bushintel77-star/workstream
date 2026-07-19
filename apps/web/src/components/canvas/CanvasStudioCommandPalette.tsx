"use client";

import { useCallback, useEffect, useMemo } from "react";
import type { CatalogSymbol } from "@workstream/contracts";
import type { CanvasMode } from "../../lib/canvas-mode";
import {
  CanvasCommandPalette,
  type CanvasCommand,
} from "./CanvasCommandPalette";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CanvasMode;
  symbols: CatalogSymbol[];
  onMode: (mode: CanvasMode) => void;
  onToggleFitSheet: () => void;
  fitSheetOn: boolean;
  onToggleDarkCanvas: () => void;
  darkCanvas: boolean;
  onToggleClientView: () => void;
  clientView: boolean;
  onScanGhosts?: () => void;
  onDraftCad?: () => void;
  onGoToQuote?: () => void;
  onToggleMeasure?: () => void;
  measureActive?: boolean;
  onFocusAssist?: () => void;
  onToggleShade?: () => void;
  onToggleEasements?: () => void;
  shadeActive?: boolean;
  easementsActive?: boolean;
  onArmSymbol?: (symbol: CatalogSymbol) => void;
  projectId: string;
};

export function CanvasStudioCommandPalette({
  open,
  onOpenChange,
  mode,
  symbols,
  onMode,
  onToggleFitSheet,
  fitSheetOn,
  onToggleDarkCanvas,
  darkCanvas,
  onToggleClientView,
  clientView,
  onScanGhosts,
  onDraftCad,
  onGoToQuote,
  onToggleMeasure,
  measureActive = false,
  onFocusAssist,
  onToggleShade,
  onToggleEasements,
  shadeActive = false,
  easementsActive = false,
  onArmSymbol,
  projectId,
}: Props) {
  const modeCommands: CanvasCommand[] = useMemo(
    () =>
      (
        [
          "survey",
          "sketch",
          "cad",
          "elevation",
          "quote",
          "share",
        ] as CanvasMode[]
      ).map((m) => ({
        id: `mode-${m}`,
        label: `Switch to ${m}`,
        detail: `Canvas mode · ${m}`,
        keywords: `mode ${m} switch lens`,
        run: () => {
          onMode(m);
          onOpenChange(false);
        },
      })),
    [onMode, onOpenChange],
  );

  const globalCommands: CanvasCommand[] = useMemo(
    () => [
      {
        id: "fit-sheet",
        label: fitSheetOn ? "Hide Fit sheet" : "Show Fit sheet",
        detail: "Paper working drawing layout",
        keywords: "fit sheet paper frame working drawing",
        run: () => {
          onToggleFitSheet();
          onOpenChange(false);
        },
      },
      {
        id: "dark-canvas",
        label: darkCanvas ? "Light canvas" : "Dark canvas",
        detail: "Toggle presentation background",
        keywords: "dark light canvas theme",
        run: () => {
          onToggleDarkCanvas();
          onOpenChange(false);
        },
      },
      {
        id: "client-view",
        label: clientView ? "Exit client view" : "Client view",
        detail: "Hide editing chrome for screen share",
        keywords: "client presentation share view",
        run: () => {
          onToggleClientView();
          onOpenChange(false);
        },
      },
      {
        id: "open-project",
        label: "Open this project",
        detail: projectId,
        keywords: "project site id",
        run: () => onOpenChange(false),
      },
      ...modeCommands,
    ],
    [
      clientView,
      darkCanvas,
      fitSheetOn,
      modeCommands,
      onOpenChange,
      onToggleClientView,
      onToggleDarkCanvas,
      onToggleFitSheet,
      projectId,
    ],
  );

  const noopArm = useCallback(() => {}, []);

  return (
    <CanvasCommandPalette
      open={open}
      onOpenChange={onOpenChange}
      symbols={symbols}
      onArmSymbol={onArmSymbol ?? noopArm}
      onScanGhosts={onScanGhosts ?? (() => {})}
      onDraftCad={onDraftCad ?? (() => {})}
      onGoToQuote={onGoToQuote ?? (() => {})}
      onToggleMeasure={onToggleMeasure ?? (() => {})}
      measureActive={measureActive}
      onFocusAssist={onFocusAssist}
      onToggleShade={onToggleShade}
      onToggleEasements={onToggleEasements}
      shadeActive={shadeActive}
      easementsActive={easementsActive}
      extraCommands={globalCommands}
    />
  );
}
