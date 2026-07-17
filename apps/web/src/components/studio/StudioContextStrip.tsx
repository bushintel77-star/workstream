"use client";

import { isTier1WrightsTerrace } from "@workstream/domain";
import type { CanvasAnnotationKind } from "@workstream/contracts";
import type { RibbonTab } from "./StudioRibbon";
import type { SiteLayerId, SiteLayerState } from "./SiteLayersPanel";
import cs from "./studioContextStrip.module.css";

type Props = {
  ribbonTab: RibbonTab;
  projectAddress: string;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onScan: () => void;
  onOpenDevelop: () => void;
  onOpenCad?: () => void;
  libraryFilter: string | null;
  onLibraryFilter: (f: string | null) => void;
  siteLayers?: SiteLayerState;
  onToggleSiteLayer?: (id: SiteLayerId) => void;
  snapEnabled?: boolean;
  onToggleSnap?: () => void;
  onSelectAll?: () => void;
  annotateTool?: CanvasAnnotationKind | null;
  onAnnotateTool?: (kind: CanvasAnnotationKind | null) => void;
};

export function StudioContextStrip({
  ribbonTab,
  projectAddress,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onScan,
  onOpenDevelop,
  onOpenCad,
  libraryFilter,
  onLibraryFilter,
  siteLayers,
  onToggleSiteLayer,
  snapEnabled = false,
  onToggleSnap,
  onSelectAll,
  annotateTool = null,
  onAnnotateTool,
}: Props) {
  const tier1 = isTier1WrightsTerrace(projectAddress);

  const chip = (
    label: string,
    active: boolean,
    onClick: () => void,
    opts?: { title?: string; disabled?: boolean },
  ) => (
    <button
      type="button"
      className={`${cs.chip} ${active ? cs.chipActive : ""} ${opts?.disabled ? cs.chipDisabled : ""}`}
      onClick={opts?.disabled ? undefined : onClick}
      title={opts?.title}
      disabled={opts?.disabled}
      aria-disabled={opts?.disabled}
    >
      {label}
    </button>
  );

  const siteChip = (label: string, id: SiteLayerId) => {
    const on = siteLayers?.[id]?.on ?? false;
    return chip(label, on, () => onToggleSiteLayer?.(id), {
      title: on ? "Hide layer" : "Show layer",
      disabled: !onToggleSiteLayer,
    });
  };

  return (
    <div className={cs.strip} data-testid="studio-context-strip">
      {ribbonTab === "ai" ? (
        <>
          {chip("Scan design", false, onScan)}
          {chip("Develop from sketch", false, onOpenDevelop)}
          {chip("Upgrade to AI CAD", false, () => onOpenCad?.(), {
            disabled: !onOpenCad,
            title: "Stage 2 metre-space CAD with LibreCAD DXF export",
          })}
          {tier1 ? (
            <span className={cs.tier1Chip}>36 Wrights Terrace · Tier-1 design</span>
          ) : null}
        </>
      ) : null}
      {ribbonTab === "home" ? (
        <>
          {chip("Undo", false, onUndo, { disabled: !canUndo, title: "Undo last change" })}
          {chip("Redo", false, onRedo, { disabled: !canRedo, title: "Redo" })}
          {chip("Select all", false, () => onSelectAll?.(), {
            disabled: !onSelectAll,
            title: "Select all symbols",
          })}
          {chip(
            snapEnabled ? "Snap on" : "Snap off",
            snapEnabled,
            () => onToggleSnap?.(),
            { disabled: !onToggleSnap, title: "Snap to indicative grid" },
          )}
        </>
      ) : null}
      {ribbonTab === "plant" ? (
        <>
          {["All", "Curtis", "Landscape", "Tree pack", "Open Crop"].map((f) => {
            const key =
              f === "All"
                ? null
                : f === "Tree pack"
                  ? "wikimedia"
                  : f === "Landscape"
                    ? "osmic"
                    : f === "Open Crop"
                      ? "open-crop"
                      : "curtis";
            return chip(f, libraryFilter === key, () => onLibraryFilter(key));
          })}
        </>
      ) : null}
      {ribbonTab === "annotate" ? (
        <>
          {chip(
            "Text label",
            annotateTool === "text",
            () => onAnnotateTool?.(annotateTool === "text" ? null : "text"),
            { title: "Place text label on canvas" },
          )}
          {chip(
            "Dimension",
            annotateTool === "dimension",
            () =>
              onAnnotateTool?.(annotateTool === "dimension" ? null : "dimension"),
            { title: "Two-click indicative dimension" },
          )}
          {chip(
            "Arrow",
            annotateTool === "arrow",
            () => onAnnotateTool?.(annotateTool === "arrow" ? null : "arrow"),
            { title: "Two-click arrow" },
          )}
          <span className={cs.hint}>Indicative markup — not survey CAD</span>
        </>
      ) : null}
      {ribbonTab === "site" ? (
        <>
          {siteChip("Sun/shade", "sun-shade")}
          {siteChip("TRP zones", "trp")}
          {siteChip("Easements", "easements")}
          {siteChip("Utilities", "utilities")}
          {siteChip("Permits", "permits")}
        </>
      ) : null}
    </div>
  );
}
