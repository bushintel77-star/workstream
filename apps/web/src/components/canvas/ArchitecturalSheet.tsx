"use client";

import type { ReactNode } from "react";
import css from "./architecturalSheet.module.css";

type Props = {
  brand?: string;
  address: string;
  /** Drawing title e.g. SITE PLAN */
  drawingTitle?: string;
  sourceLabel: string;
  areaM2?: number | null;
  locked?: boolean;
  /** Approximate ground width of the fitted parcel (m) for scale bar. */
  groundWidthM?: number | null;
  revision?: string;
  children: ReactNode;
  /** Optional strip under the drawing (sun cast etc). */
  tools?: ReactNode;
  /**
   * Fit sheet on = full architectural paper sheet (cream, title block, scale).
   * Fit sheet off = slim aperture over aerial.
   */
  fitSheet?: boolean;
};

function formatScale(groundWidthM: number | null | undefined): string {
  if (groundWidthM == null || groundWidthM <= 0) return "Indicative";
  // ~180 mm drawing field width at typical sheet → rough RF
  const paperMm = 180;
  const rf = Math.round((groundWidthM * 1000) / paperMm / 50) * 50;
  const nice = Math.max(50, Math.min(500, rf));
  return `1:${nice}`;
}

/**
 * Architectural title sheet — the canvas is the drawing field inside
 * a bordered sheet with title block, not a free GIS map.
 */
export function ArchitecturalSheet({
  brand = "Curtis & Co",
  address,
  drawingTitle = "Garden plan",
  sourceLabel,
  areaM2 = null,
  locked = false,
  groundWidthM = null,
  revision = "Working · indicative",
  children,
  tools = null,
  fitSheet = false,
}: Props) {
  const today = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const scale = formatScale(groundWidthM);

  // Aerial design: aperture only — Fit sheet owns the paper chrome.
  if (!fitSheet) {
    return (
      <div
        className={`${css.sheet} ${css.sheetSlim}`}
        data-testid="architectural-sheet"
        data-fit-sheet="0"
      >
        <div className={css.drawing} data-testid="architectural-drawing-field">
          {children}
        </div>
        {tools}
      </div>
    );
  }

  return (
    <div
      className={`${css.sheet} ${css.sheetPaper}`}
      data-testid="architectural-sheet"
      data-fit-sheet="1"
    >
      <header className={css.header}>
        <div className={css.brandBlock}>
          <p className={css.brand}>{brand}</p>
          <p className={css.address}>{address}</p>
        </div>
        <div className={css.meta}>
          <p className={css.sheetTitle}>Working drawing</p>
          <p className={css.metaLine}>
            <span className={css.metaStrong}>{drawingTitle}</span>
          </p>
          <p className={css.metaLine}>
            <span className={css.metaStrong}>{sourceLabel}</span>
            {areaM2 != null
              ? ` · ${Math.round(areaM2).toLocaleString("en-AU")} m\u00b2`
              : null}
          </p>
          <span
            className={`${css.statusPill}${locked ? ` ${css.statusPillLocked}` : ""}`}
          >
            {locked ? "Boundary locked" : "Fit sheet · draft"}
          </span>
        </div>
      </header>

      <div
        className={`${css.drawing} ${css.drawingPaper}`}
        data-testid="architectural-drawing-field"
      >
        {children}
      </div>

      {tools}

      <footer className={css.footer}>
        <div className={css.cell}>
          <span className={css.cellLabel}>Scale</span>
          <div className={css.scaleBar}>
            <div className={css.scaleTrack} aria-hidden />
            <span className={css.scaleLabel}>{scale}</span>
          </div>
          <p className={css.cellValue}>North up · metres · Fit sheet</p>
        </div>
        <div className={css.cell}>
          <span className={css.cellLabel}>Title block</span>
          <p className={css.cellValue}>Garden working drawing</p>
          <p className={css.cellValue}>{revision}</p>
        </div>
        <div className={css.cell}>
          <span className={css.cellLabel}>Issued</span>
          <p className={css.cellValue}>{today}</p>
          <p className={css.cellValue}>Indicative · not for construction</p>
        </div>
      </footer>
    </div>
  );
}
