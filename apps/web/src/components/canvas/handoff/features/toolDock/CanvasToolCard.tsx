"use client";

import { CameraChrome } from "../../CameraChrome";
import { AssetCommandSheet } from "../assetPanel/AssetCommandSheet";
import type { StudioItemType, StudioMode } from "../../studioCatalog";
import css from "./canvasToolCard.module.css";

type Props = {
  open: boolean;
  mode: StudioMode;
  recentAssetTypes: StudioItemType[];
  armed: StudioItemType | null;
  onArm: (t: StudioItemType) => void;
  onClose: () => void;
  compact?: boolean;
};

/**
 * Summoned asset card — pops out from the canvas border Add icon.
 * No persistent left panel; the operator searches or picks a recent type.
 */
export function CanvasToolCard({
  open,
  mode,
  recentAssetTypes,
  armed,
  onArm,
  onClose,
  compact = false,
}: Props) {
  if (!open) return null;

  return (
    <CameraChrome place={{ kind: "dock" }} testId="canvas-tool-card-chrome">
      <div
        className={`${css.card}${compact ? ` ${css.cardCompact}` : ""}`}
        data-testid="canvas-tool-card"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <AssetCommandSheet
          open
          variant="card"
          mode={mode}
          recentAssetTypes={recentAssetTypes}
          armed={armed}
          onArm={onArm}
          onClose={onClose}
        />
      </div>
    </CameraChrome>
  );
}
