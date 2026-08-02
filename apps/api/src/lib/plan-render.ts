/**
 * Server-side plan SVG renderer — builds an SVG string from the same plan data
 * the client's PlanCropSvg uses (boundary, building, items, strokes). The SVG
 * is converted to PNG via @resvg/resvg-js and sent to Claude's vision model
 * for raster-based plan dissection.
 *
 * Pure string building — no DOM, no React. Matches the client's visual style:
 * parchment background, green boundary, dark building, olive items, magenta
 * strokes. The vision model sees the same plan the operator sees.
 */

import type { DesignCanvas } from "@workstream/contracts";

const SVG_WIDTH = 800;
const SVG_HEIGHT = 600;
const PADDING = 20;

type Point = { x: number; y: number };

/**
 * Build an SVG string from a DesignCanvas. The canvas uses board % coordinates
 * (0-100); we map those to SVG pixel coordinates with padding.
 */
export function renderPlanSvg(canvas: DesignCanvas): string {
  const innerW = SVG_WIDTH - PADDING * 2;
  const innerH = SVG_HEIGHT - PADDING * 2;

  const toX = (pct: number) => PADDING + (pct / 100) * innerW;
  const toY = (pct: number) => PADDING + (pct / 100) * innerH;

  const ptsToStr = (pts: Point[]) =>
    pts.map((p) => `${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`).join(" ");

  const parts: string[] = [];

  // Background (parchment)
  parts.push(
    `<rect x="0" y="0" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#f5f0e6" />`,
  );

  // Boundary (site boundary — green)
  if (canvas.site_frame?.boundary && canvas.site_frame.boundary.length >= 3) {
    const boundaryPts = canvas.site_frame.boundary.map((p) => ({
      x: p.x_pct,
      y: p.y_pct,
    }));
    parts.push(
      `<polygon points="${ptsToStr(boundaryPts)}" fill="rgba(61,107,79,0.08)" stroke="#3d6b4f" stroke-width="2" />`,
    );
  }

  // Building (dwelling — dark)
  if (canvas.site_frame?.building && canvas.site_frame.building.length >= 3) {
    const buildingPts = canvas.site_frame.building.map((p) => ({
      x: p.x_pct,
      y: p.y_pct,
    }));
    parts.push(
      `<polygon points="${ptsToStr(buildingPts)}" fill="rgba(42,30,24,0.15)" stroke="#2a1e18" stroke-width="1.5" />`,
    );
  }

  // Items (plants, paving, etc. — olive green)
  for (const item of canvas.placements) {
    const cx = toX(item.x_pct);
    const cy = toY(item.y_pct);
    const r = 4;
    parts.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="#3d6b4f" opacity="0.7" />`,
    );
  }

  // Strokes (freehand — magenta)
  for (const stroke of canvas.strokes ?? []) {
    if (stroke.points.length < 2) continue;
    const strokePts = stroke.points.map((p) => ({
      x: p.x_pct,
      y: p.y_pct,
    }));
    parts.push(
      `<polyline points="${ptsToStr(strokePts)}" fill="none" stroke="#ff2ef6" stroke-width="1.5" opacity="0.6" />`,
    );
  }

  // North arrow (if calibrated)
  const bearing = canvas.site_frame?.north_bearing;
  if (bearing != null) {
    const cx = SVG_WIDTH - 40;
    const cy = 40;
    const rad = (bearing - 90) * (Math.PI / 180);
    const arrowLen = 20;
    const x2 = cx + Math.cos(rad) * arrowLen;
    const y2 = cy + Math.sin(rad) * arrowLen;
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="16" fill="none" stroke="#888" stroke-width="1" />`,
    );
    parts.push(
      `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#2a2a2a" stroke-width="2" />`,
    );
    parts.push(
      `<text x="${cx}" y="${cy + 30}" font-family="sans-serif" font-size="10" fill="#888" text-anchor="middle">N</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">${parts.join("")}</svg>`;
}

/**
 * Convert an SVG string to PNG using @resvg/resvg-js.
 * Returns a Buffer of PNG data.
 */
export async function renderSvgToPng(svg: string): Promise<Buffer> {
  const { Resvg } = await import("@resvg/resvg-js");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: SVG_WIDTH },
    background: "#f5f0e6",
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

/**
 * Render a DesignCanvas plan to a PNG buffer, ready to send to Claude's vision
 * model as base64.
 */
export async function renderPlanPng(canvas: DesignCanvas): Promise<Buffer> {
  const svg = renderPlanSvg(canvas);
  return renderSvgToPng(svg);
}
