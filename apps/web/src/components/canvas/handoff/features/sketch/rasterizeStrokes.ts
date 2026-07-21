/**
 * Rasterize raw freehand sketch strokes (percent-space points) into a PNG for
 * the AI sketch→CAD vision pipeline. Pure capture — it draws the ink exactly as
 * stored (no smoothing / snapping), matching the interference-free sketch layer.
 */

export type RasterStroke = { points: Array<{ x: number; y: number }> };

export type RasterizedSketch = {
  image_base64: string;
  mime_type: "image/png";
};

export function rasterizeStrokesToPng(
  strokes: RasterStroke[],
  boardWidth: number,
  boardHeight: number,
): RasterizedSketch | null {
  if (typeof document === "undefined") return null;
  const w = Math.max(64, Math.min(1600, Math.round(boardWidth) || 1000));
  const h = Math.max(64, Math.min(1600, Math.round(boardHeight) || 700));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Light ground, dark ink — high contrast for the vision model.
  ctx.fillStyle = "#f7f5f0";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#141414";
  ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) / 300));
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const s of strokes) {
    if (!s.points || s.points.length < 2) continue;
    ctx.beginPath();
    s.points.forEach((p, i) => {
      const x = (p.x / 100) * w;
      const y = (p.y / 100) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.split(",")[1] ?? "";
  if (!base64) return null;
  return { image_base64: base64, mime_type: "image/png" };
}
