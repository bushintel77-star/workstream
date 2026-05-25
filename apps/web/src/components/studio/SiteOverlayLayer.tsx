"use client";

import { useMemo } from "react";
import {
  SHADE_GRID_SIZE,
  buildIndicativeShadeGrid,
} from "@workstream/domain";
import type { CatalogPlacement, CatalogSymbol } from "@workstream/contracts";
import type { SiteLayerState } from "./SiteLayersPanel";
import ov from "./siteOverlayLayer.module.css";

const TREE_PREFIX = "wikimedia-tree-";

type Props = {
  canvasWidth: number;
  canvasHeight: number;
  placements: CatalogPlacement[];
  symbols: CatalogSymbol[];
  layers: SiteLayerState;
  lat?: number;
  lng?: number;
  shadeWhen: Date;
  siteWidthM?: number;
  hiddenIds: Set<string>;
};

function isTreeSymbol(sym: CatalogSymbol | undefined, symbolId: string): boolean {
  if (symbolId.startsWith(TREE_PREFIX)) return true;
  return sym?.category === "planting" && /tree/i.test(sym.label);
}

export function SiteOverlayLayer({
  canvasWidth,
  canvasHeight,
  placements,
  symbols,
  layers,
  lat,
  lng,
  shadeWhen,
  siteWidthM = 20,
  hiddenIds,
}: Props) {
  const symbolById = useMemo(
    () => new Map(symbols.map((s) => [s.id, s])),
    [symbols],
  );

  const shadeCells = useMemo(() => {
    if (!layers["sun-shade"].on || lat == null || lng == null) return [];
    return buildIndicativeShadeGrid(lat, lng, shadeWhen);
  }, [layers, lat, lng, shadeWhen]);

  const trpRings = useMemo(() => {
    if (!layers.trp.on) return [];
    return placements
      .filter((p) => !hiddenIds.has(p.id))
      .map((p) => {
        const sym = symbolById.get(p.symbol_id);
        if (!isTreeSymbol(sym, p.symbol_id)) return null;
        const radiusM = (sym?.default_width_m ?? 4) * p.scale * 1.2;
        const radiusPct = (radiusM / siteWidthM) * 100;
        return { id: p.id, cx: p.x_pct, cy: p.y_pct, r: radiusPct };
      })
      .filter(Boolean) as { id: string; cx: number; cy: number; r: number }[];
  }, [layers.trp.on, placements, symbolById, siteWidthM, hiddenIds]);

  const cellW = 100 / SHADE_GRID_SIZE;
  const opacity = layers["sun-shade"].opacity / 100;

  return (
    <svg
      className={ov.layer}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      style={{ width: canvasWidth, height: canvasHeight }}
    >
      {layers["sun-shade"].on && shadeCells.length > 0
        ? shadeCells.map((c) => (
            <rect
              key={`${c.col}-${c.row}`}
              x={c.col * cellW}
              y={c.row * cellW}
              width={cellW}
              height={cellW}
              fill="var(--overlay-shade)"
              opacity={c.sunHours < 4 ? opacity * 0.9 : opacity * 0.35}
            />
          ))
        : null}
      {trpRings.map((ring) => (
        <g key={ring.id}>
          <circle
            cx={ring.cx}
            cy={ring.cy}
            r={ring.r}
            fill="var(--overlay-trp)"
            fillOpacity={0.15}
            stroke="var(--overlay-trp)"
            strokeWidth={0.4}
            strokeDasharray="2 2"
          />
          <circle
            cx={ring.cx}
            cy={ring.cy}
            r={ring.r * 0.5}
            fill="none"
            stroke="var(--overlay-trp)"
            strokeWidth={0.3}
            strokeDasharray="1 2"
          />
        </g>
      ))}
      {layers.easements.on ? (
        <rect
          x={2}
          y={88}
          width={96}
          height={10}
          fill="var(--overlay-easement)"
          opacity={layers.easements.opacity / 100}
        />
      ) : null}
    </svg>
  );
}
