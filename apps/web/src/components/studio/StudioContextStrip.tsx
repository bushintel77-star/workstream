"use client";

import { isTier1WrightsTerrace } from "@workstream/domain";
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
  libraryFilter: string | null;
  onLibraryFilter: (f: string | null) => void;
  siteLayers?: SiteLayerState;
  onToggleSiteLayer?: (id: SiteLayerId) => void;
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
  libraryFilter,
  onLibraryFilter,
  siteLayers,
  onToggleSiteLayer,
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
          {tier1 ? (
            <span className={cs.tier1Chip}>36 Wrights Terrace · Tier-1 design</span>
          ) : null}
        </>
      ) : null}
      {ribbonTab === "home" ? (
        <>
          {chip("Undo", false, onUndo, { disabled: !canUndo, title: "Undo last change" })}
          {chip("Redo", false, onRedo, { disabled: !canRedo, title: "Redo" })}
          {chip("Select all", false, () => {}, { disabled: true, title: "Stage 2 CAD" })}
          {chip("Snap off", false, () => {}, { disabled: true, title: "Stage 2 CAD" })}
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
          {chip("Text label", false, () => {}, { disabled: true, title: "Stage 2 CAD" })}
          {chip("Dimension", false, () => {}, { disabled: true, title: "Stage 2 CAD" })}
          {chip("Arrow", false, () => {}, { disabled: true, title: "Stage 2 CAD" })}
          <span className={cs.hint}>Annotations ship with Stage 2 CAD</span>
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
