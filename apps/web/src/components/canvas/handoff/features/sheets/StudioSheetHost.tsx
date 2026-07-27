"use client";

import type { ReactNode } from "react";
import { CameraChrome } from "../../CameraChrome";
import {
  nextSheetSnap,
  STUDIO_SHEET_PAGES,
  type StudioSheetPage,
  type StudioSheetSnap,
} from "./studioSheet";
import css from "./studioSheet.module.css";

type Props = {
  open: boolean;
  page: StudioSheetPage;
  snap: StudioSheetSnap;
  inboxCount?: number;
  onPage: (page: StudioSheetPage) => void;
  onSnap: (snap: StudioSheetSnap) => void;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Compact canvas-first bottom sheet — one page at a time (lane law).
 * CameraChrome dock only; never nests under .zoomWorld.
 */
export function StudioSheetHost({
  open,
  page,
  snap,
  inboxCount = 0,
  onPage,
  onSnap,
  onClose,
  children,
}: Props) {
  if (!open) return null;

  return (
    <CameraChrome place={{ kind: "dock" }} testId="studio-sheet-chrome">
      <aside
        className={`${css.sheet} ${css[`snap_${snap}`]}`}
        data-testid="studio-sheet"
        data-page={page}
        data-snap={snap}
        aria-label="Studio sheet"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={css.handle}
          aria-label={
            snap === "full" ? "Collapse studio sheet" : "Expand studio sheet"
          }
          data-testid="studio-sheet-handle"
          onClick={() => onSnap(nextSheetSnap(snap))}
        />

        <div className={css.tabs} role="tablist" aria-label="Sheet pages">
          {STUDIO_SHEET_PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={page === p.id}
              className={`${css.tab}${page === p.id ? ` ${css.tabOn}` : ""}`}
              data-testid={`studio-sheet-tab-${p.id}`}
              onClick={() => {
                onPage(p.id);
                if (snap === "peek") onSnap("half");
              }}
            >
              {p.label}
              {p.id === "inbox" && inboxCount > 0 ? (
                <span className={css.badge}>{inboxCount}</span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            className={css.close}
            aria-label="Close studio sheet"
            data-testid="studio-sheet-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className={css.body} data-testid="studio-sheet-body">
          {children}
        </div>
      </aside>
    </CameraChrome>
  );
}
