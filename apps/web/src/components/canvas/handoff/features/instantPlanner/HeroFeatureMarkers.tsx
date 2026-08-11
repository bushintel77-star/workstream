"use client";

import type { DesignCanvas, ProjectOrchestrationWorld } from "@workstream/contracts";
import type { HeroFeatureTarget } from "./HeroDetailOverlay";
import css from "./heroFeatureMarkers.module.css";
import { formatFeatureTitle } from "./formatFeatureTitle";

type Marker = HeroFeatureTarget & { x_pct: number; y_pct: number };

type Props = {
  canvas: DesignCanvas | null;
  world: ProjectOrchestrationWorld | null;
  onOpen: (feature: HeroFeatureTarget) => void;
};

function kindFromLabel(label: string): HeroFeatureTarget["kind"] {
  const l = label.toLowerCase();
  if (l.includes("wall")) return "wall";
  if (l.includes("deck")) return "deck";
  if (l.includes("patio") || l.includes("pave") || l.includes("path"))
    return "patio";
  if (l.includes("water") || l.includes("pool")) return "water";
  if (l.includes("bed") || l.includes("plant") || l.includes("tree"))
    return "planting";
  return "other";
}

/** Magnifier markers on plan features for hero detail overlay. */
export function HeroFeatureMarkers({ canvas, world, onOpen }: Props) {
  const markers: Marker[] = [];

  for (const f of canvas?.features ?? []) {
    const pts = f.geometry.points;
    if (pts.length === 0) continue;
    const mid = pts[Math.floor(pts.length / 2)]!.pct;
    markers.push({
      id: f.id,
      title: formatFeatureTitle(f.metadata.friendly_name ?? "Feature"),
      kind: kindFromLabel(f.metadata.friendly_name ?? ""),
      depth_m: f.material_fill?.depth_m,
      material: f.material_fill?.sku,
      height_m: f.metadata.friendly_name?.toLowerCase().includes("wall")
        ? 0.9
        : undefined,
      x_pct: mid.x_pct,
      y_pct: mid.y_pct,
    });
  }

  if (markers.length === 0 && world) {
    for (const s of world.spatial_facts) {
      if (s.x_pct == null || s.y_pct == null) continue;
      if (
        s.layer !== "structure" &&
        s.layer !== "hardscape" &&
        s.layer !== "softscape"
      ) {
        continue;
      }
      if (s.area_m2 < 2 && s.length_m < 3 && s.layer !== "structure") continue;
      markers.push({
        id: s.id,
        title: formatFeatureTitle(s.label),
        kind: kindFromLabel(s.label),
        depth_m: s.depth_m,
        height_m: s.height_m,
        material: s.symbol_id,
        qty_note:
          s.area_m2 > 0
            ? `${s.area_m2.toFixed(1)} m²`
            : s.length_m > 0
              ? `${s.length_m.toFixed(1)} m`
              : undefined,
        x_pct: s.x_pct,
        y_pct: s.y_pct,
      });
    }
  }

  if (markers.length === 0) return null;

  return (
    <div className={css.layer} data-testid="hero-feature-markers">
      {markers.slice(0, 12).map((m) => (
        <button
          key={m.id}
          type="button"
          className={css.marker}
          style={{ left: `${m.x_pct}%`, top: `${m.y_pct}%` }}
          title={`Detail: ${m.title}`}
          aria-label={`Open detail for ${m.title}`}
          data-testid={`hero-marker-${m.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(m);
          }}
        >
          +
        </button>
      ))}
    </div>
  );
}
