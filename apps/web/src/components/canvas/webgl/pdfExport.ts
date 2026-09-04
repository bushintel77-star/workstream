/**
 * PDF export engine — raster viewports + vector chrome (spec §18a).
 *
 * The vector-raster split:
 *   - Raster: WebGL canvas framebuffer captured per viewport and placed as
 *     a JPEG image in the PDF.
 *   - Vector: Title block, legend, and sheet borders written as native PDF
 *     text and lines (infinitely scalable).
 *
 * Scale honesty (the binding rule): a viewport's printed scale is COMPUTED
 * from the camera state at capture time, never copied from the nominal
 * `vp.scale` metadata. Orthographic frames report the true denominator
 * (visible world metres across the frame ÷ frame width in metres); a
 * perspective frame is stamped "NOT TO SCALE" — a screenshot from a
 * perspective camera has no scale, and pretending otherwise on an issued
 * sheet is a professional defect. Raster sharpness is bounded by the
 * canvas DPR ([1, 1.5]) — the image maps the true frustum to the frame at
 * any resolution, so the scale holds; only crispness varies.
 *
 * Per-viewport views: the caller passes a `frame` adapter that positions
 * the studio camera at each viewport's preset (and waits for the camera
 * spring to settle) before its capture, so two viewports never print the
 * same picture.
 *
 * Honest failure: if a viewport capture fails, the export halts and throws
 * a typed error — never silently outputs a blank or corrupted viewport.
 */

import { jsPDF } from "jspdf";
import {
  type Sheet,
  type SheetViewport,
  PAPER_DIMENSIONS_MM,
  revisionLetter,
} from "./sheetComposition";

export type ExportPhase = "idle" | "capturing" | "assembling" | "done" | "error";

export interface ExportProgress {
  phase: ExportPhase;
  /** Current viewport index (1-based for display). */
  current: number;
  /** Total viewports to capture. */
  total: number;
  /** Phase label for the hardware-grade readout. */
  label: string;
  /** Error message if phase === "error". */
  error?: string;
}

export interface ViewportCapture {
  viewportId: string;
  /** Base64 JPEG data URL from the WebGL canvas. */
  dataUrl: string;
  /** Captured pixel width. */
  width: number;
  /** Captured pixel height. */
  height: number;
  /**
   * True scale denominator of this capture (1:N), computed from the live
   * camera frustum at capture time. Undefined = perspective frame, which
   * has no scale and is labelled as such.
   */
  trueScaleDenominator?: number;
}

/** Adapter that lets the export loop drive the live studio camera. */
export interface ExportFrameAdapter {
  /**
   * Position the studio at this viewport's view (camera preset) and resolve
   * once the camera spring has settled — the capture must read the rested
   * frame, not a mid-transition blur.
   */
  apply: (vp: SheetViewport) => Promise<void>;
  /**
   * Honest scale denominator for the CURRENT frame at this viewport's mm
   * width, read from the camera at capture time. Undefined = not to scale.
   */
  scaleDenominator: (vp: SheetViewport) => number | undefined;
}

/**
 * The scale text printed under a viewport frame. Truth only: a computed
 * orthographic denominator, or an explicit not-to-scale stamp.
 */
export function viewportScaleLabel(
  capture: Pick<ViewportCapture, "trueScaleDenominator">,
): string {
  const den = capture.trueScaleDenominator;
  return den != null && den >= 1 ? `1:${den}` : "NOT TO SCALE";
}

/**
 * Capture the WebGL canvas at its native resolution. The Canvas is created
 * with `preserveDrawingBuffer: true` (WebGLStudio) so the drawing buffer
 * survives compositing and `toDataURL` is deterministic — the flush here is
 * belt-and-braces, not the mechanism.
 *
 * @throws {ViewportCaptureError} if the canvas is lost or capture fails.
 */
export class ViewportCaptureError extends Error {
  constructor(message: string, public viewportId: string) {
    super(message);
    this.name = "ViewportCaptureError";
  }
}

export function captureCanvas(
  canvas: HTMLCanvasElement,
  viewportId: string,
): ViewportCapture {
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) {
    throw new ViewportCaptureError(
      "WebGL context lost — cannot capture viewport",
      viewportId,
    );
  }

  // Safety net only — preserveDrawingBuffer is the real guarantee.
  try {
    gl.flush();
    gl.finish();
  } catch {
    // Context may be lost — fall through to the toDataURL check
  }

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  } catch (e) {
    throw new ViewportCaptureError(
      `Canvas capture failed: ${e instanceof Error ? e.message : "unknown error"}`,
      viewportId,
    );
  }

  if (!dataUrl || dataUrl === "data:,") {
    throw new ViewportCaptureError(
      "Canvas capture returned empty data — viewport may be blank",
      viewportId,
    );
  }

  return {
    viewportId,
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Assemble the PDF from captured viewports + vector chrome.
 *
 * @param sheet The sheet to export.
 * @param captures Raster captures for each viewport.
 * @returns The jsPDF document (caller calls .save() or .output()).
 */
export function assemblePdf(
  sheet: Sheet,
  captures: Map<string, ViewportCapture>,
): jsPDF {
  const dims = PAPER_DIMENSIONS_MM[sheet.paperSize];
  const isLandscape = sheet.orientation === "landscape";
  const pageW = isLandscape ? dims.w : dims.h;
  const pageH = isLandscape ? dims.h : dims.w;

  const doc = new jsPDF({
    orientation: sheet.orientation,
    unit: "mm",
    format: sheet.paperSize,
  });

  // --- Sheet border (vector line) ---
  doc.setDrawColor(28, 25, 23); // --la-accent charcoal
  doc.setLineWidth(0.5);
  doc.rect(5, 5, pageW - 10, pageH - 10);

  // --- Viewports (raster images) ---
  for (const vp of sheet.viewports) {
    const capture = captures.get(vp.id);
    if (!capture) continue;

    // Place the raster at the viewport's mm position on the sheet.
    // The image fills the viewport frame exactly — the raster maps the
    // captured frustum onto the frame, which is what makes the printed
    // 1:N label true for orthographic frames.
    doc.addImage(
      capture.dataUrl,
      "JPEG",
      vp.x,
      vp.y,
      vp.w,
      vp.h,
      undefined,
      "FAST",
    );

    // Viewport frame border (vector line)
    doc.setDrawColor(28, 25, 23);
    doc.setLineWidth(0.3);
    doc.rect(vp.x, vp.y, vp.w, vp.h);

    // Viewport label (vector text) — scale text is the COMPUTED truth.
    doc.setFont("courier", "bold");
    doc.setFontSize(7);
    doc.setTextColor(28, 25, 23);
    doc.text(
      `${vp.label ?? "Viewport"} · ${vp.cameraPreset.toUpperCase()} · ${viewportScaleLabel(capture)}`,
      vp.x + 2,
      Math.max(vp.y - 1, 3.5),
    );
  }

  // --- Title block (vector text, bottom-right) ---
  const tbW = 80;
  const tbH = 40;
  const tbX = pageW - tbW - 10;
  const tbY = pageH - tbH - 10;

  doc.setDrawColor(28, 25, 23);
  doc.setLineWidth(0.3);
  doc.rect(tbX, tbY, tbW, tbH);

  doc.setFont("courier", "normal");
  doc.setFontSize(6);
  doc.setTextColor(28, 25, 23);

  const tb = sheet.titleBlock;
  const tbRowH = 4.5;
  const tbRows: Array<[string, string]> = [
    ["Project", tb.project],
    ["Sheet", `${sheet.number} · ${sheet.title}`],
    ["Scale", tb.scale],
    ["Date", tb.date],
    ["Rev", tb.rev],
    ["North", tb.north],
    ["Template", tb.templateVersion],
  ];
  tbRows.forEach(([label, value], i) => {
    const y = tbY + 5 + i * tbRowH;
    doc.setFont("courier", "normal");
    doc.setTextColor(120, 113, 108); // muted label
    doc.text(label.toUpperCase(), tbX + 2, y);
    doc.setFont("courier", "bold");
    doc.setTextColor(28, 25, 23);
    doc.text(value, tbX + 22, y);
  });

  // --- Legend (vector text + color swatches, bottom-left) ---
  if (sheet.legend.length > 0) {
    const lgX = 10;
    const lgY = pageH - 10 - Math.max(sheet.legend.length * 5 + 8, 30);
    const lgW = 60;
    const lgH = Math.max(sheet.legend.length * 5 + 8, 30);

    doc.setDrawColor(28, 25, 23);
    doc.setLineWidth(0.3);
    doc.rect(lgX, lgY, lgW, lgH);

    doc.setFont("courier", "bold");
    doc.setFontSize(6);
    doc.setTextColor(28, 25, 23);
    doc.text("LEGEND", lgX + 2, lgY + 5);

    sheet.legend.forEach((entry, i) => {
      const y = lgY + 10 + i * 5;
      // Color swatch as a filled rect
      const swatchColor = parseHexColor(entry.color);
      if (swatchColor) {
        doc.setFillColor(swatchColor[0], swatchColor[1], swatchColor[2]);
        doc.rect(lgX + 2, y - 2, 3, 3, "F");
      }
      doc.setFont("courier", "normal");
      doc.setTextColor(28, 25, 23);
      doc.text(entry.label, lgX + 7, y);
      if (entry.dash && entry.dash.length > 0) {
        doc.setTextColor(120, 113, 108);
        doc.text(entry.dash.join("/"), lgX + 45, y);
      }
    });
  }

  // --- Stamp (vector text, bottom-center) ---
  doc.setFont("courier", "normal");
  doc.setFontSize(5);
  doc.setTextColor(120, 113, 108);
  doc.text(
    `Issued Rev ${revisionLetter(sheet.revision)} · ${sheet.issuedAt ? new Date(sheet.issuedAt).toISOString().split("T")[0] : ""} · indicative only`,
    pageW / 2,
    pageH - 6,
    { align: "center" },
  );

  return doc;
}

function parseHexColor(hex: string): [number, number, number] | null {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Full export pipeline: position the camera per viewport, capture, assemble
 * the PDF, and trigger a download. Reports progress via the callback.
 *
 * Uses requestAnimationFrame between steps to avoid blocking the main
 * thread — each capture yields back to the event loop.
 */
export async function exportSheetToPdf(
  sheet: Sheet,
  canvas: HTMLCanvasElement,
  onProgress: (progress: ExportProgress) => void,
  frame?: ExportFrameAdapter,
): Promise<void> {
  const viewports = sheet.viewports;
  const total = viewports.length;

  if (total === 0) {
    // No viewports — still produce a PDF with just the title block + border
    onProgress({ phase: "assembling", current: 0, total: 0, label: "ASSEMBLING PDF..." });
    const doc = assemblePdf(sheet, new Map());
    doc.save(pdfFilename(sheet));
    onProgress({ phase: "done", current: 0, total: 0, label: "PDF ISSUED" });
    return;
  }

  // Phase 1: Frame + rasterize viewports (each at its own camera view)
  const captures = new Map<string, ViewportCapture>();
  for (let i = 0; i < viewports.length; i++) {
    const vp = viewports[i]!;
    onProgress({
      phase: "capturing",
      current: i + 1,
      total,
      label: `RASTERIZING VIEWPORTS [${i + 1}/${total}]...`,
    });

    try {
      if (frame) {
        await frame.apply(vp);
      }
      // Yield a frame so the rested camera state is what gets captured.
      await nextFrame();

      const capture = captureCanvas(canvas, vp.id);
      capture.trueScaleDenominator = frame?.scaleDenominator(vp);
      captures.set(vp.id, capture);
    } catch (e) {
      const msg = e instanceof ViewportCaptureError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Unknown capture error";
      onProgress({
        phase: "error",
        current: i + 1,
        total,
        label: `CAPTURE FAILED [${i + 1}/${total}]`,
        error: msg,
      });
      return; // Halt — never output a PDF with a blank/corrupted viewport
    }
  }

  // Phase 2: Assemble PDF
  onProgress({
    phase: "assembling",
    current: total,
    total,
    label: "ASSEMBLING PDF...",
  });

  await nextFrame();

  const doc = assemblePdf(sheet, captures);
  doc.save(pdfFilename(sheet));

  onProgress({
    phase: "done",
    current: total,
    total,
    label: "PDF ISSUED",
  });
}

function pdfFilename(sheet: Sheet): string {
  return `${sheet.number}-${sheet.title.replace(/\s+/g, "-").toLowerCase()}-rev${revisionLetter(sheet.revision)}.pdf`;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
