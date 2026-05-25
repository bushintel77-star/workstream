"use client";

import { isTier1WrightsTerrace } from "@workstream/domain";
import type { RibbonTab } from "./StudioRibbon";
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
}: Props) {
  const tier1 = isTier1WrightsTerrace(projectAddress);

  const chip = (label: string, active: boolean, onClick: () => void, title?: string) => (
    <button
      type="button"
      className={`${cs.chip} ${active ? cs.chipActive : ""}`}
      onClick={onClick}
      title={title}
    >
      {label}
    </button>
  );

  return (
    <div className={cs.strip} data-testid="studio-context-strip">
      {ribbonTab === "ai" ? (
        <>
          {chip("Scan design", false, onScan)}
          {chip("Coaching", false, () => {})}
          {chip("Develop from sketch", false, onOpenDevelop)}
          {tier1 ? (
            <span className={cs.tier1Chip}>36 Wrights Terrace · Tier-1 design</span>
          ) : null}
        </>
      ) : null}
      {ribbonTab === "home" ? (
        <>
          {chip("Undo", false, onUndo, !canUndo ? "Nothing to undo" : undefined)}
          {chip("Redo", false, onRedo, !canRedo ? "Nothing to redo" : undefined)}
          {chip("Select all", false, () => {})}
          {chip("Snap off", false, () => {}, "Coming in Stage 2 CAD")}
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
          {chip("Text label", false, () => {}, "Coming soon")}
          {chip("Dimension", false, () => {}, "Coming soon")}
          {chip("Arrow", false, () => {}, "Coming soon")}
        </>
      ) : null}
      {ribbonTab === "site" ? (
        <>
          {chip("Sun/shade", false, () => {}, "Stage 8")}
          {chip("TRP zones", false, () => {})}
          {chip("Easements", false, () => {}, "Stage 9")}
          {chip("Utilities", false, () => {}, "Stage 9")}
          {chip("Permits", false, () => {})}
        </>
      ) : null}
    </div>
  );
}
