import {
  clampBoardPct,
  type GhostPlacementSuggestion,
} from "@workstream/contracts";

export type RgbaImageData = {
  width: number;
  height: number;
  /** RGBA byte buffer, length = width * height * 4. */
  data: ArrayLike<number>;
};

export type CanopyClusterOpts = {
  gridSize?: number;
  minGreenShare?: number;
  minClusterCells?: number;
  maxClusters?: number;
  symbolId?: string;
};

type Cell = { gx: number; gy: number };

function isGreenDominant(r: number, g: number, b: number): boolean {
  const brightness = (r + g + b) / 3;
  if (brightness < 28 || brightness > 220) return false;
  return g > r * 1.12 && g > b * 1.05;
}

/**
 * Heuristic aerial canopy detection from raster RGBA samples.
 * Downsamples into a grid, flood-fills green-dominant cells, and emits
 * up to N canopy ghost suggestions at cluster centroids.
 */
export function detectCanopyClustersFromImageData(
  image: RgbaImageData,
  opts: CanopyClusterOpts = {},
): GhostPlacementSuggestion[] {
  const gridSize = opts.gridSize ?? 24;
  const minGreenShare = opts.minGreenShare ?? 0.42;
  const minClusterCells = opts.minClusterCells ?? 3;
  const maxClusters = opts.maxClusters ?? 6;
  const symbolId = opts.symbolId ?? "existing-tree-retain";

  if (image.width <= 0 || image.height <= 0 || image.data.length < 4) {
    return [];
  }

  const cellW = image.width / gridSize;
  const cellH = image.height / gridSize;
  const green = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => false),
  );

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      let greenPx = 0;
      let total = 0;
      const x0 = Math.floor(gx * cellW);
      const y0 = Math.floor(gy * cellH);
      const x1 = Math.min(image.width, Math.floor((gx + 1) * cellW));
      const y1 = Math.min(image.height, Math.floor((gy + 1) * cellH));
      const stepX = Math.max(1, Math.floor((x1 - x0) / 4));
      const stepY = Math.max(1, Math.floor((y1 - y0) / 4));
      for (let y = y0; y < y1; y += stepY) {
        for (let x = x0; x < x1; x += stepX) {
          const i = (y * image.width + x) * 4;
          const r = image.data[i] ?? 0;
          const g = image.data[i + 1] ?? 0;
          const b = image.data[i + 2] ?? 0;
          total++;
          if (isGreenDominant(r, g, b)) greenPx++;
        }
      }
      green[gy]![gx] = total > 0 && greenPx / total >= minGreenShare;
    }
  }

  const seen = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => false),
  );
  const clusters: Cell[][] = [];

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      if (!green[gy]![gx] || seen[gy]![gx]) continue;
      const stack: Cell[] = [{ gx, gy }];
      const cells: Cell[] = [];
      seen[gy]![gx] = true;
      while (stack.length) {
        const cur = stack.pop()!;
        cells.push(cur);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = cur.gx + dx;
          const ny = cur.gy + dy;
          if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
          if (seen[ny]![nx] || !green[ny]![nx]) continue;
          seen[ny]![nx] = true;
          stack.push({ gx: nx, gy: ny });
        }
      }
      if (cells.length >= minClusterCells) clusters.push(cells);
    }
  }

  clusters.sort((a, b) => b.length - a.length);

  return clusters.slice(0, maxClusters).map((cells, i) => {
    const cx = cells.reduce((s, c) => s + c.gx + 0.5, 0) / cells.length;
    const cy = cells.reduce((s, c) => s + c.gy + 0.5, 0) / cells.length;
    const sizeNorm = Math.min(1, cells.length / 12);
    const confidence = Math.round((0.55 + sizeNorm * 0.35) * 100) / 100;
    return {
      id: `canopy-cluster-${i + 1}`,
      symbol_id: symbolId,
      x_pct: clampBoardPct((cx / gridSize) * 100),
      y_pct: clampBoardPct((cy / gridSize) * 100),
      confidence,
      reason: "Detected canopy from aerial imagery (colour analysis)",
    };
  });
}
