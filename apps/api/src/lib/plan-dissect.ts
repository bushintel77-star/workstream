import type {
  CatalogPlacement,
  DesignCanvas,
  PanelRect,
  PlanCropReason,
  PresentationDissectGhost,
  PresentationDissectResponse,
} from "@workstream/contracts";

/**
 * Plan dissection — auto-cut the finished DesignCanvas into named panels for
 * the Present tab. Title-centric (brief §5.1): the site truth (orientation,
 * aspect, frontage) leads the cut.
 *
 * Heuristic-first (deterministic, testable without mocking Claude). Three cut
 * families:
 *   1. Overview — always. The whole plan, one panel.
 *   2. Aspect quadrants — only if `north_bearing` is calibrated. Four 50×50
 *      crops tagged N/E/S/W, computed from the bearing (not stored).
 *   3. Feature clusters — if ≥4 placements. Grid-bucketed proximity clusters,
 *      each tagged `feature` with a label from the dominant symbol category.
 *
 * Ghosts are ephemeral: the caller (route) returns them to the client for
 * review. Acceptance pins them to `canvas_revision` as PlanCropPanel entries.
 */

/** Epoch-ms revision of the canvas — stable integer for panel pinning. */
export function canvasRevisionOf(canvas: DesignCanvas): number {
  return new Date(canvas.updated_at).getTime();
}

/** Compass quadrant label for a bearing in degrees (0 = N, 90 = E). */
function compassLabel(deg: number): "North" | "South" | "East" | "West" {
  const d = ((deg % 360) + 360) % 360;
  if (d >= 315 || d < 45) return "North";
  if (d < 135) return "East";
  if (d < 225) return "South";
  return "West";
}

/**
 * Four board quadrants (TL, TR, BL, BR) each face a compass direction derived
 * from `north_bearing` — the bearing that board-up (screen-up) points toward.
 *
 * board-up faces `bearing`, board-right faces `bearing + 90`, etc. The centre
 * of each quadrant is offset 45° from the cardinal it's closest to:
 *   TL = up-left  → bearing + 315 (i.e. bearing - 45)
 *   TR = up-right → bearing + 45
 *   BL = down-left → bearing + 225
 *   BR = down-right → bearing + 135
 */
function aspectQuadrants(
  bearing: number,
): { crop: PanelRect; label: string }[] {
  const quadrants: { x: number; y: number; dir: number }[] = [
    { x: 0, y: 0, dir: bearing + 315 }, // TL
    { x: 50, y: 0, dir: bearing + 45 }, // TR
    { x: 0, y: 50, dir: bearing + 225 }, // BL
    { x: 50, y: 50, dir: bearing + 135 }, // BR
  ];
  return quadrants.map((q) => ({
    crop: { x_pct: q.x, y_pct: q.y, w_pct: 50, h_pct: 50 },
    label: `${compassLabel(q.dir)} aspect`,
  }));
}

/**
 * Grid-bucket placements into a 3×3 grid; non-empty cells with ≥2 placements
 * become feature clusters. The crop is padded 10% around the cluster bounding
 * box (clamped to 0-100). Label from the dominant symbol_id prefix.
 */
function featureClusters(
  placements: CatalogPlacement[],
): { crop: PanelRect; label: string }[] {
  const GRID = 3;
  const CELL = 100 / GRID;
  const buckets = new Map<string, CatalogPlacement[]>();

  for (const p of placements) {
    const gx = Math.min(GRID - 1, Math.floor(p.x_pct / CELL));
    const gy = Math.min(GRID - 1, Math.floor(p.y_pct / CELL));
    const key = `${gx},${gy}`;
    const arr = buckets.get(key);
    if (arr) arr.push(p);
    else buckets.set(key, [p]);
  }

  const clusters: { crop: PanelRect; label: string }[] = [];
  for (const [, group] of buckets) {
    if (group.length < 2) continue;
    const xs = group.map((p) => p.x_pct);
    const ys = group.map((p) => p.y_pct);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    // Pad 10% around the bbox, clamped to board
    const pad = 10;
    const x = Math.max(0, minX - pad);
    const y = Math.max(0, minY - pad);
    const w = Math.min(100 - x, maxX - minX + pad * 2);
    const h = Math.min(100 - y, maxY - minY + pad * 2);
    // Dominant symbol_id prefix (before '-') as the feature label seed
    const counts = new Map<string, number>();
    for (const p of group) {
      const prefix = p.symbol_id.split("-")[0] ?? p.symbol_id;
      counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }
    let dominant = "";
    let max = 0;
    for (const [k, v] of counts) {
      if (v > max) {
        max = v;
        dominant = k;
      }
    }
    const label = dominant
      ? `${dominant.charAt(0).toUpperCase()}${dominant.slice(1)} area`
      : "Feature area";
    clusters.push({
      crop: { x_pct: x, y_pct: y, w_pct: w, h_pct: h },
      label,
    });
  }
  return clusters;
}

/**
 * Dissect a finished DesignCanvas into proposed plan-crop ghosts.
 * Pure function — no side effects, no I/O. Testable in isolation.
 */
export function dissectPlan(canvas: DesignCanvas): PresentationDissectResponse {
  const revision = canvasRevisionOf(canvas);
  const ghosts: PresentationDissectGhost[] = [];

  // 1. Overview — always
  ghosts.push({
    crop: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
    reason: "overview" as PlanCropReason,
    label: "Site plan overview",
  });

  // 2. Aspect quadrants — only if north_bearing is calibrated
  const bearing = canvas.site_frame?.north_bearing;
  if (bearing != null) {
    for (const q of aspectQuadrants(bearing)) {
      ghosts.push({ crop: q.crop, reason: "aspect", label: q.label });
    }
  }

  // 3. Feature clusters — if enough placements to cluster
  if (canvas.placements.length >= 4) {
    for (const c of featureClusters(canvas.placements)) {
      ghosts.push({ crop: c.crop, reason: "feature", label: c.label });
    }
  }

  return { canvas_revision: revision, ghosts, source: "heuristic" as const };
}
