import {
  toBoardPoint,
  type CatalogPlacement,
  type CanvasPointPct,
} from "@workstream/contracts";
import {
  groundMetersToPct,
  pointInPolygonGround,
  polygonAreaFromCanvasPercent,
  type CanvasGroundScale,
} from "./canvas-geometry";

/** Triangular (staggered) grid plant count for a given area. */
export function staggeredPlantCount(areaM2: number, spacingCm: number): number {
  if (areaM2 <= 0 || spacingCm <= 0) return 0;
  const spacingM = spacingCm / 100;
  const plantsPerM2 = 1 / (spacingM * spacingM * Math.sin(Math.PI / 3));
  return Math.ceil(areaM2 * plantsPerM2);
}

export function generateStaggeredPlacements(
  polygonPct: CanvasPointPct[],
  symbolId: string,
  spacingCm: number,
  scale: CanvasGroundScale,
  newId: () => string = () => crypto.randomUUID(),
): CatalogPlacement[] {
  if (polygonPct.length < 3 || spacingCm <= 0) return [];

  const spacingM = spacingCm / 100;
  const projected = polygonPct.map((p) => {
    const g = {
      x: (p.x_pct / 100) * scale.canvasWidthPx * scale.metresPerXPx,
      y: (p.y_pct / 100) * scale.canvasHeightPx * scale.metresPerYPx,
    };
    return g;
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of projected) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const dY = spacingM;
  const dX = spacingM;
  const placements: CatalogPlacement[] = [];
  let row = 0;

  for (let y = minY; y <= maxY + dY; y += dY) {
    const offset = row % 2 === 1 ? dX / 2 : 0;
    for (let x = minX - dX; x <= maxX + dX; x += dX) {
      const testX = x + offset;
      if (pointInPolygonGround(testX, y, polygonPct, scale)) {
        placements.push({
          id: newId(),
          symbol_id: symbolId,
          ...toBoardPoint(groundMetersToPct(testX, y, scale)),
          rotation_deg: 0,
          scale: 1,
        });
      }
    }
    row++;
  }

  return placements;
}

export function massPlantSummary(
  polygonPct: CanvasPointPct[],
  spacingCm: number,
  scale: CanvasGroundScale,
): { areaM2: number; plantCount: number } {
  const areaM2 = polygonAreaFromCanvasPercent(polygonPct, scale);
  return {
    areaM2,
    plantCount: staggeredPlantCount(areaM2, spacingCm),
  };
}
