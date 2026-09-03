/**
 * Phase Q — Sheet composition / issue PDF (spec §18a).
 *
 * Sheets are live viewports onto the same canvas — never copies. Editing the
 * canvas changes the sheet with no re-import. The legend auto-builds from
 * materials actually used, carrying dash signatures. The title block carries
 * project / sheet / scale / date / rev / north / template version.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase Q.
 * Reference: README §18a, code/officeTemplate.ts.
 */

import type { CameraPreset } from "./studioStore";
import { MATERIALS, materialById } from "./materials";

/** Paper sizes (ISO A-series, mm). */
export type PaperSize = "A0" | "A1" | "A2" | "A3";
export const PAPER_DIMENSIONS_MM: Record<PaperSize, { w: number; h: number }> = {
  A0: { w: 1189, h: 841 },
  A1: { w: 841, h: 594 },
  A2: { w: 594, h: 420 },
  A3: { w: 420, h: 297 },
};

export type Orientation = "portrait" | "landscape";

/** A viewport is a live window onto the canvas at a specific camera state. */
export interface SheetViewport {
  id: string;
  /** Camera preset for this viewport. */
  cameraPreset: CameraPreset;
  /** Scale denominator (e.g. 200 for 1:200). */
  scale: number;
  /** Position on the sheet in mm (top-left origin). */
  x: number;
  y: number;
  /** Frame dimensions in mm. */
  w: number;
  h: number;
  /** True when the viewport is live (editing canvas changes it). */
  live: boolean;
  /** True when the viewport has been issued (frozen). */
  issued: boolean;
  /** Optional label (e.g. "Site plan", "Planting plan"). */
  label?: string;
  /** True when the viewport was dropped outside a slot (override). */
  overrideSlot?: boolean;
}

/** A sheet is a paper-sized composition of viewports + title block + legend. */
export interface Sheet {
  id: string;
  /** Sheet number (e.g. "L-01"). */
  number: string;
  /** Sheet title (e.g. "Site plan"). */
  title: string;
  paperSize: PaperSize;
  orientation: Orientation;
  /** Viewports on this sheet. */
  viewports: SheetViewport[];
  /** Title block fields. */
  titleBlock: SheetTitleBlock;
  /** Legend entries — auto-built from materials used in the viewports. */
  legend: SheetLegendEntry[];
  /** Revision number (incremented on issue). */
  revision: number;
  /** True when this sheet has been issued as PDF. */
  issued: boolean;
  /** Epoch ms of last issue. */
  issuedAt?: number;
}

export interface SheetTitleBlock {
  project: string;
  sheet: string;
  scale: string;
  date: string;
  rev: string;
  north: string;
  templateVersion: string;
}

export interface SheetLegendEntry {
  materialId: string;
  label: string;
  color: string;
  /** Dash signature pattern (for markup materials). */
  dash?: number[];
  dashEnds?: string;
  /** True for semantic markup materials. */
  semantic: boolean;
}

/** Build the legend from materials actually used in the viewports.
 *  The legend carries dash signatures (spec §18a / §8c). */
export function buildLegendFromMaterials(
  usedMaterialIds: string[],
): SheetLegendEntry[] {
  const seen = new Set<string>();
  const entries: SheetLegendEntry[] = [];
  for (const id of usedMaterialIds) {
    if (seen.has(id)) continue;
    const m = materialById(id);
    if (!m) continue;
    seen.add(id);
    entries.push({
      materialId: m.id,
      label: m.label,
      color: m.color,
      dash: m.dash,
      dashEnds: m.dashEnds,
      semantic: m.semantic,
    });
  }
  return entries;
}

/**
 * Revision letter for a revision count. 0 -> "A", 1 -> "B", ... 25 -> "Z",
 * 26 -> "AA". The title block prints this, not the raw count \u2014 a drawing
 * issued three times goes out as Rev D, not Rev 3.
 */
export function revisionLetter(revision: number): string {
  let n = Math.max(0, Math.floor(revision));
  let out = "";
  for (;;) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    if (n < 26) return out;
    n = Math.floor(n / 26) - 1;
  }
}

/**
 * Issue date, in the local calendar. `toISOString()` is UTC: a sheet made at
 * 09:00 AEDT is 22:00 UTC the previous day, so every sheet issued before
 * ~10am Melbourne time printed yesterday's date. Sheets are dated documents;
 * the date must be the one the operator is living in (CLAUDE.md: en-AU).
 */
export function issueDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Build a default title block for a sheet. */
export function buildTitleBlock(opts: {
  project: string;
  sheet: string;
  scale: number;
  northBearingDeg?: number | null;
  templateVersion: string;
  revision?: number;
}): SheetTitleBlock {
  return {
    project: opts.project,
    sheet: opts.sheet,
    scale: `1:${opts.scale}`,
    date: issueDate(),
    rev: revisionLetter(opts.revision ?? 0),
    north: opts.northBearingDeg != null ? `${opts.northBearingDeg.toFixed(0)}\u00B0` : "N\u2191",
    templateVersion: opts.templateVersion,
  };
}

/** Create a new sheet with defaults. */
export function createSheet(opts: {
  number: string;
  title: string;
  project: string;
  paperSize?: PaperSize;
  orientation?: Orientation;
  scale?: number;
  templateVersion?: string;
}): Sheet {
  const paperSize = opts.paperSize ?? "A1";
  const orientation = opts.orientation ?? "landscape";
  const scale = opts.scale ?? 200;
  return {
    // randomUUID, not Date.now(): two sheets added in the same millisecond
    // collided, which gave duplicate React keys and made the second tab
    // select the first sheet.
    id: `sheet-${crypto.randomUUID()}`,
    number: opts.number,
    title: opts.title,
    paperSize,
    orientation,
    viewports: [],
    titleBlock: buildTitleBlock({
      project: opts.project,
      sheet: opts.number,
      scale,
      templateVersion: opts.templateVersion ?? "v1",
    }),
    legend: [],
    revision: 0,
    issued: false,
  };
}

/**
 * Q.10 — crop, never rescale. A viewport dropped into a smaller frame keeps
 * its scale and crops. This function computes the crop area (what the
 * viewport will show) given the frame size and the scale.
 */
export function computeViewportCrop(
  viewport: Pick<SheetViewport, "w" | "h" | "scale">,
  canvasSizeM: { w: number; h: number },
): { cropX: number; cropY: number; cropW: number; cropH: number } {
  // At 1:scale, the viewport frame shows (frameMm / 1000 * scale) metres
  const visibleW_m = (viewport.w / 1000) * viewport.scale;
  const visibleH_m = (viewport.h / 1000) * viewport.scale;
  // Center the crop on the canvas
  const cropX = Math.max(0, (canvasSizeM.w - visibleW_m) / 2);
  const cropY = Math.max(0, (canvasSizeM.h - visibleH_m) / 2);
  return {
    cropX,
    cropY,
    cropW: Math.min(visibleW_m, canvasSizeM.w),
    cropH: Math.min(visibleH_m, canvasSizeM.h),
  };
}

/**
 * Q.11 — the dragged frame states what the scale would become, offered as
 * a decision — never applied. Returns the scale that would result from
 * fitting the canvas into the given frame.
 */
export function computeImpliedScale(
  frameMm: { w: number; h: number },
  canvasSizeM: { w: number; h: number },
): number {
  // Scale = canvasSize_m * 1000 / frame_mm
  const scaleX = (canvasSizeM.w * 1000) / frameMm.w;
  const scaleY = (canvasSizeM.h * 1000) / frameMm.h;
  // Use the larger scale (more zoomed out) to fit everything
  return Math.ceil(Math.max(scaleX, scaleY) / 10) * 10;
}

/**
 * Q.12 — issue the sheet as PDF. Freezes all live viewports and bumps the
 * revision. Returns the issued sheet.
 */
export function issueSheet(sheet: Sheet, now: Date = new Date()): Sheet {
  const revision = sheet.revision + 1;
  return {
    ...sheet,
    viewports: sheet.viewports.map((v) => ({ ...v, live: false, issued: true })),
    issued: true,
    issuedAt: now.getTime(),
    revision,
    // The title block is what actually goes out on paper, so the revision
    // and issue date have to move with it — bumping `revision` alone left
    // every issued sheet printing "Rev A".
    titleBlock: {
      ...sheet.titleBlock,
      rev: revisionLetter(revision),
      date: issueDate(now),
    },
  };
}

/** All 21 material ids — for the legend builder when all materials are used. */
export const ALL_MATERIAL_IDS = MATERIALS.map((m) => m.id);

/** Format a scale as a string (e.g. 200 → "1:200"). */
export function formatScale(scale: number): string {
  return `1:${scale}`;
}
