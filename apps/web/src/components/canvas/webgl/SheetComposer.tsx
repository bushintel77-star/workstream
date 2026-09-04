"use client";

/**
 * Phase Q — Sheet composer UI (spec §18a).
 *
 * A light-surface modal for composing sheets from live viewports, building
 * legends, and issuing PDFs. Sheets are live viewports onto the same canvas
 * — never copies. The legend auto-builds from materials actually used.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase Q.
 */

import { useEffect, useMemo, useState } from "react";
import { useStudioStore } from "./studioStore";
import {
  createSheet,
  buildLegendFromMaterials,
  formatScale,
  type Sheet,
  type SheetViewport,
  PAPER_DIMENSIONS_MM,
} from "./sheetComposition";
import {
  exportSheetToPdf,
  type ExportProgress,
  type ExportFrameAdapter,
} from "./pdfExport";
import styles from "./SheetComposer.module.css";

export interface SheetComposerProps {
  onClose: () => void;
}

export function SheetComposer({ onClose }: SheetComposerProps) {
  const projectAddress = useStudioStore((s) => s.projectAddress);
  // The sheet set lives in the store, not in this component: the composer is
  // unmounted on close, so component state meant every sheet, viewport and
  // issued revision was discarded the moment the operator dismissed it.
  const sheets = useStudioStore((s) => s.sheets);
  const activeSheetId = useStudioStore((s) => s.activeSheetId);
  const strokes = useStudioStore((s) => s.sketchStrokes);
  const addSheetToStore = useStudioStore((s) => s.addSheet);
  const setActiveSheetId = useStudioStore((s) => s.setActiveSheetId);
  const addSheetViewport = useStudioStore((s) => s.addSheetViewport);
  const removeSheetViewport = useStudioStore((s) => s.removeSheetViewport);
  const issueSheetById = useStudioStore((s) => s.issueSheetById);

  // First open seeds the default sheet. Re-opening finds the set as it was
  // left, revisions included.
  useEffect(() => {
    if (sheets.length > 0) return;
    addSheetToStore(
      createSheet({
        number: "L-01",
        title: "Site plan",
        project: projectAddress || "Untitled site",
      }),
    );
  }, [sheets.length, addSheetToStore, projectAddress]);

  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? sheets[0];

  function addViewport() {
    if (!activeSheet) return;
    // randomUUID, not Date.now(): two viewports added in the same
    // millisecond collided into one React key.
    const vp: SheetViewport = {
      id: `vp-${crypto.randomUUID()}`,
      cameraPreset: "plan",
      scale: 200,
      x: 20,
      y: 20,
      w: 200,
      h: 150,
      live: true,
      issued: false,
      label: "New viewport",
    };
    // The store action appends to the CURRENT array. This used to rebuild
    // the array from the render-time `activeSheet`, so two quick clicks
    // wrote the same base twice and one viewport vanished.
    addSheetViewport(activeSheet.id, vp);
  }

  function removeViewport(vpId: string) {
    if (!activeSheet) return;
    removeSheetViewport(activeSheet.id, vpId);
  }

  // PDF export pipeline state — hardware-grade determinative progress.
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    phase: "idle",
    current: 0,
    total: 0,
    label: "",
  });
  const isExporting = exportProgress.phase === "capturing" || exportProgress.phase === "assembling";

  async function handleIssue() {
    if (!activeSheet || isExporting) return;
    // Find the WebGL canvas element for raster capture.
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="webgl-canvas"]');
    if (!canvas) {
      setExportProgress({
        phase: "error",
        current: 0,
        total: 0,
        label: "CAPTURE FAILED",
        error: "WebGL canvas not found — cannot rasterize viewports",
      });
      return;
    }
    // Issue the sheet (freeze viewports + bump revision) before export,
    // so the PDF reflects the issued state.
    issueSheetById(activeSheet.id);
    // Read the now-issued sheet from the store for the export.
    const issuedSheet = useStudioStore
      .getState()
      .sheets.find((s) => s.id === activeSheet.id);
    if (!issuedSheet) return;

    // Frame adapter — drive the live studio camera per viewport so each
    // raster is that viewport's view (never N copies of one frame), and
    // compute the TRUE printed scale from the camera at capture time.
    // A perspective frame has no scale and the PDF says so.
    const prevPreset = useStudioStore.getState().cameraPreset;
    const frame: ExportFrameAdapter = {
      apply: async (vp) => {
        useStudioStore.getState().setCameraPreset(vp.cameraPreset);
        // Let the camera spring settle — capture the rested frame, not a
        // mid-transition blur. 700ms covers the preset spring + margin.
        await new Promise((r) => setTimeout(r, 700));
      },
      scaleDenominator: (vp) => {
        const cv = useStudioStore.getState().cameraView;
        if (!cv || cv.kind !== "ortho" || cv.widthM <= 0 || vp.w <= 0) {
          return undefined;
        }
        // Frame is vp.w mm wide on paper; the frustum shows cv.widthM m.
        // 1:N where N = world_mm ÷ paper_mm.
        return Math.max(1, Math.round((cv.widthM * 1000) / vp.w));
      },
    };

    try {
      await exportSheetToPdf(issuedSheet, canvas, setExportProgress, frame);
    } finally {
      // Return the operator to the view they left, whatever happened.
      useStudioStore.getState().setCameraPreset(prevPreset);
    }
  }

  function dismissExportError() {
    setExportProgress({ phase: "idle", current: 0, total: 0, label: "" });
  }

  function addSheet() {
    const num = `L-${String(sheets.length + 1).padStart(2, "0")}`;
    addSheetToStore(
      createSheet({
        number: num,
        title: "New sheet",
        project: projectAddress || "Untitled site",
      }),
    );
  }

  // Q.3 — the legend auto-builds from the materials ACTUALLY used in the
  // drawing. It used to be a hardcoded list of the five markup materials
  // under a heading that claimed otherwise, so the legend said the same
  // thing on every project regardless of what was drawn.
  const legend = useMemo(() => {
    const used: string[] = [];
    for (const s of strokes) if (s.material) used.push(s.material);
    return buildLegendFromMaterials(used);
  }, [strokes]);

  // One frame before the seeding effect commits the default sheet.
  if (!activeSheet) return null;

  return (
    <div className={styles.scrim} onClick={onClose} data-testid="sheet-composer-scrim">
      <div
        className={styles.composer}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Sheet composer"
        data-testid="sheet-composer"
      >
        <header className={styles.header}>
          <div>
            <div className={styles.title}>Sheet composition</div>
            <div className={styles.meta}>
              {projectAddress || "Untitled site"} · {sheets.length} sheet{sheets.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className={styles.actions}>
            <button
              className={styles.actionBtn}
              onClick={handleIssue}
              disabled={isExporting}
              data-testid="issue-revision"
              title="Freeze this sheet's viewports, advance its revision, and export a PDF."
            >
              {isExporting ? exportProgress.label : "Issue revision"}
            </button>
            <button className={styles.actionBtn} onClick={onClose} disabled={isExporting}>Close</button>
          </div>
        </header>

        {/* PDF export progress / failure card (§18a vector-raster split) */}
        {exportProgress.phase === "error" && (
          <div className={styles.exportErrorCard} data-testid="export-error-card" role="alert">
            <div className={styles.exportErrorHeader}>
              <span className={styles.exportErrorLabel}>EXPORT FAILED</span>
              <button className={styles.exportErrorDismiss} onClick={dismissExportError} title="Dismiss">
                {"\u00D7"}
              </button>
            </div>
            <div className={styles.exportErrorMsg}>{exportProgress.error}</div>
            <div className={styles.exportErrorHint}>
              The sheet revision was issued but no PDF was produced. Correct the
              viewport or WebGL state and re-issue.
            </div>
          </div>
        )}
        {isExporting && (
          <div className={styles.exportProgressBar} data-testid="export-progress">
            <span className={styles.exportProgressLabel}>{exportProgress.label}</span>
            <div className={styles.exportProgressTrack}>
              <div
                className={styles.exportProgressFill}
                style={{
                  width: exportProgress.total > 0
                    ? `${(exportProgress.current / exportProgress.total) * 100}%`
                    : "100%",
                }}
              />
            </div>
          </div>
        )}
        {exportProgress.phase === "done" && (
          <div className={styles.exportDoneCard} data-testid="export-done-card">
            <span className={styles.exportDoneLabel}>PDF ISSUED</span>
            <button className={styles.exportDoneDismiss} onClick={dismissExportError} title="Dismiss">
              {"\u00D7"}
            </button>
          </div>
        )}

        <div className={styles.body}>
          {/* Sheet set rail (Q.5) */}
          <div className={styles.sheetRail} data-testid="sheet-rail">
            {sheets.map((s) => (
              <button
                key={s.id}
                className={`${styles.sheetTab} ${s.id === activeSheetId ? styles.sheetTabActive : ""}`}
                onClick={() => setActiveSheetId(s.id)}
                data-sheet-id={s.id}
                data-issued={s.issued ? "true" : undefined}
              >
                <span className={styles.sheetNumber}>{s.number}</span>
                <span className={styles.sheetTitle}>{s.title}</span>
                {s.issued && <span className={styles.issuedBadge}>REV {s.revision}</span>}
              </button>
            ))}
            <button className={styles.addSheetBtn} onClick={addSheet} data-testid="add-sheet">
              + Sheet
            </button>
          </div>

          {/* Paper preview */}
          <div className={styles.previewArea}>
            <PaperPreview
              sheet={activeSheet}
              onAddViewport={addViewport}
              onRemoveViewport={removeViewport}
            />
          </div>

          {/* Legend (Q.3) */}
          <div className={styles.legend} data-testid="sheet-legend">
            <div className={styles.legendTitle}>Legend (auto-built from materials used)</div>
            {legend.length === 0 && (
              <div className={styles.legendEmpty}>
                Nothing drawn with a palette material yet — the legend fills in
                as materials are used.
              </div>
            )}
            {legend.map((entry) => (
              <div key={entry.materialId} className={styles.legendRow}>
                <span
                  className={styles.legendSwatch}
                  style={{ background: entry.color }}
                />
                <span className={styles.legendLabel}>{entry.label}</span>
                {entry.dash && entry.dash.length > 0 && (
                  <span className={styles.legendDash}>
                    {entry.dash.join("/")}
                  </span>
                )}
                {entry.semantic && (
                  <span className={styles.legendSemantic}>semantic</span>
                )}
              </div>
            ))}
          </div>

          {/* Title block (Q.4) */}
          <div className={styles.titleBlock} data-testid="title-block">
            <div className={styles.titleBlockRow}>
              <span>Project</span>
              <span>{activeSheet.titleBlock.project}</span>
            </div>
            <div className={styles.titleBlockRow}>
              <span>Sheet</span>
              <span>{activeSheet.titleBlock.sheet}</span>
            </div>
            <div className={styles.titleBlockRow}>
              <span>Scale</span>
              <span>{activeSheet.titleBlock.scale}</span>
            </div>
            <div className={styles.titleBlockRow}>
              <span>Date</span>
              <span>{activeSheet.titleBlock.date}</span>
            </div>
            <div className={styles.titleBlockRow}>
              <span>Rev</span>
              <span>{activeSheet.titleBlock.rev}</span>
            </div>
            <div className={styles.titleBlockRow}>
              <span>North</span>
              <span>{activeSheet.titleBlock.north}</span>
            </div>
            <div className={styles.titleBlockRow}>
              <span>Template</span>
              <span>{activeSheet.titleBlock.templateVersion}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaperPreview({
  sheet,
  onAddViewport,
  onRemoveViewport,
}: {
  sheet: Sheet;
  onAddViewport: () => void;
  onRemoveViewport: (id: string) => void;
}) {
  const dims = PAPER_DIMENSIONS_MM[sheet.paperSize];
  const isLandscape = sheet.orientation === "landscape";
  const previewW = isLandscape ? dims.w : dims.h;
  const previewH = isLandscape ? dims.h : dims.w;
  const aspect = previewW / previewH;

  return (
    <div className={styles.paperPreview} data-testid="paper-preview">
      <div
        className={styles.paper}
        style={{ aspectRatio: `${aspect}` }}
        data-paper-size={sheet.paperSize}
        data-orientation={sheet.orientation}
      >
        {/* Viewports */}
        {sheet.viewports.map((vp) => (
          <div
            key={vp.id}
            className={`${styles.viewport} ${vp.issued ? styles.viewportIssued : ""}`}
            style={{
              left: `${(vp.x / previewW) * 100}%`,
              top: `${(vp.y / previewH) * 100}%`,
              width: `${(vp.w / previewW) * 100}%`,
              height: `${(vp.h / previewH) * 100}%`,
            }}
            data-testid={`viewport-${vp.id}`}
            data-live={vp.live ? "true" : undefined}
            data-issued={vp.issued ? "true" : undefined}
            data-override-slot={vp.overrideSlot ? "true" : undefined}
          >
            <div className={styles.viewportChrome}>
              <span className={styles.viewportLabel}>{vp.label ?? "Viewport"}</span>
              <span className={styles.viewportMeta}>
                {vp.cameraPreset.toUpperCase()} · {formatScale(vp.scale)} · {vp.live ? "LIVE" : "FROZEN"}
              </span>
            </div>
            {!vp.issued && (
              <button
                className={styles.viewportRemove}
                onClick={() => onRemoveViewport(vp.id)}
                title="Remove viewport"
              >
                {"\u00D7"}
              </button>
            )}
          </div>
        ))}
        {/* Add viewport button */}
        <button className={styles.addViewportBtn} onClick={onAddViewport} data-testid="add-viewport">
          + Viewport
        </button>
      </div>
      <div className={styles.paperMeta}>
        {sheet.paperSize} {sheet.orientation} · {previewW}mm x {previewH}mm
      </div>
    </div>
  );
}
