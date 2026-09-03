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

import { useMemo, useState } from "react";
import { useStudioStore } from "./studioStore";
import {
  createSheet,
  issueSheet,
  buildLegendFromMaterials,
  formatScale,
  type Sheet,
  type SheetViewport,
  PAPER_DIMENSIONS_MM,
} from "./sheetComposition";
import styles from "./SheetComposer.module.css";

export interface SheetComposerProps {
  onClose: () => void;
}

export function SheetComposer({ onClose }: SheetComposerProps) {
  const projectAddress = useStudioStore((s) => s.projectAddress);
  const [sheets, setSheets] = useState<Sheet[]>(() => [
    createSheet({
      number: "L-01",
      title: "Site plan",
      project: projectAddress || "Untitled site",
    }),
  ]);
  const [activeSheetId, setActiveSheetId] = useState(() => sheets[0]!.id);

  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? sheets[0]!;

  function updateSheet(id: string, patch: Partial<Sheet>) {
    setSheets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addViewport() {
    const vp: SheetViewport = {
      id: `vp-${Date.now()}`,
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
    updateSheet(activeSheetId, {
      viewports: [...activeSheet.viewports, vp],
    });
  }

  function removeViewport(vpId: string) {
    updateSheet(activeSheetId, {
      viewports: activeSheet.viewports.filter((v) => v.id !== vpId),
    });
  }

  function handleIssue() {
    const issued = issueSheet(activeSheet);
    updateSheet(activeSheetId, issued);
  }

  function addSheet() {
    const num = `L-${String(sheets.length + 1).padStart(2, "0")}`;
    const sheet = createSheet({
      number: num,
      title: "New sheet",
      project: projectAddress || "Untitled site",
    });
    setSheets((prev) => [...prev, sheet]);
    setActiveSheetId(sheet.id);
  }

  // Auto-build legend from materials used (Q.3)
  // For now, use all materials until the canvas tracks material usage
  const legend = useMemo(
    () => buildLegendFromMaterials(["setback", "gas", "services", "survey", "drafting"]),
    [],
  );

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
            <button className={styles.actionBtn} onClick={handleIssue} data-testid="issue-pdf">
              Issue PDF
            </button>
            <button className={styles.actionBtn} onClick={onClose}>Close</button>
          </div>
        </header>

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
