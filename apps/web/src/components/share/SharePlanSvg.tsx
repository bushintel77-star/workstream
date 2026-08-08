import type { CSSProperties } from "react";
import type { DesignCanvas } from "@workstream/contracts";
import { freehandPath } from "@/lib/freehandPath";
import { SEMANTIC_LIGHT, mixOnHex } from "../../styles/colorTokens";
import css from "./sharePlan.module.css";

type Props = {
  canvas: DesignCanvas | null;
  address: string;
};

const L = SEMANTIC_LIGHT;

/**
 * Lightweight read-only plan from the frozen share snapshot.
 * Avoids mounting the full studio; SVG from placements + site_frame.
 * Light parchment plate — semantic tokens (not blush chrome).
 */
export function SharePlanSvg({ canvas, address }: Props) {
  const boundary = canvas?.site_frame?.boundary ?? [];
  const building = canvas?.site_frame?.building ?? [];
  const placements = canvas?.placements ?? [];
  const strokes = canvas?.strokes ?? [];
  const features = canvas?.features ?? [];

  const boundaryPts = boundary
    .map((p) => `${p.x_pct},${p.y_pct}`)
    .join(" ");
  const buildingPts = building
    .map((p) => `${p.x_pct},${p.y_pct}`)
    .join(" ");

  return (
    <svg
      className={css.plan}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Site plan for ${address}`}
      data-testid="share-plan-svg"
      data-theme="light"
      style={
        {
          ["--canvas"]: L.canvas,
          ["--existing-stroke"]: L.existingStroke,
          ["--proposed-stroke"]: L.proposedStroke,
          ["--easement-stroke"]: L.easementStroke,
          ["--text-primary"]: L.textPrimary,
          ["--text-secondary"]: L.textSecondary,
          ["--text-muted"]: L.textMuted,
          ["--fill-structure"]: "8%",
        } as CSSProperties
      }
    >
      <rect x="0" y="0" width="100" height="100" fill={L.canvas} />
      {features.map((f) => {
        const pts = f.geometry.points
          .map((v) => `${v.pct.x_pct},${v.pct.y_pct}`)
          .join(" ");
        if (!pts || f.geometry.type === "Point") {
          const p = f.geometry.points[0]?.pct;
          if (!p) return null;
          return (
            <circle
              key={f.id}
              cx={p.x_pct}
              cy={p.y_pct}
              r={1.2}
              fill={mixOnHex(L.easementStroke, 35, L.canvas)}
            />
          );
        }
        if (f.geometry.type === "LineString") {
          const d = f.geometry.points
            .map(
              (v, i) =>
                `${i === 0 ? "M" : "L"}${v.pct.x_pct} ${v.pct.y_pct}`,
            )
            .join(" ");
          return (
            <path
              key={f.id}
              d={d}
              fill="none"
              stroke={L.easementStroke}
              strokeWidth="0.4"
            />
          );
        }
        return (
          <polygon
            key={f.id}
            points={pts}
            fill={mixOnHex(L.easementStroke, 12, L.canvas)}
            stroke={L.easementStroke}
            strokeWidth="0.35"
          />
        );
      })}
      {boundaryPts ? (
        <polygon
          points={boundaryPts}
          fill="none"
          stroke={L.textPrimary}
          strokeWidth="0.55"
        />
      ) : null}
      {buildingPts ? (
        <polygon
          points={buildingPts}
          fill={mixOnHex(L.existingStroke, 8, L.canvas)}
          stroke={L.existingStroke}
          strokeWidth="0.4"
        />
      ) : null}
      {strokes.map((s) => {
        const points = s.points.map((p) => ({ x: p.x_pct, y: p.y_pct }));
        const d = freehandPath(points, {
          size: Math.max(0.2, (s.width_px ?? 2) * 0.15),
          thinning: 0.7,
          smoothing: 0.7,
          streamline: 0.5,
        });
        if (!d) return null;
        return (
          <path
            key={s.id}
            d={d}
            fill={s.color || L.proposedStroke}
          />
        );
      })}
      {placements.map((p) => {
        // Existing-tree provenance survives acceptance (CatalogPlacement.source).
        // A detected canopy reads as indicative — dashed, lighter ink — never
        // the same weight as a surveyed or council-recorded tree. Same honesty
        // discipline as "Vicmap building footprint" vs "operator-traced envelope".
        const indicative = p.source === "canopy";
        const r = 1.1 * (p.scale ?? 1);
        return (
          <g key={p.id} transform={`translate(${p.x_pct} ${p.y_pct})`}>
            <circle
              r={r}
              fill={indicative ? "none" : L.proposedStroke}
              stroke={indicative ? L.proposedStroke : "none"}
              strokeWidth={indicative ? 0.35 : 0}
              strokeDasharray={indicative ? "0.6 0.5" : undefined}
              opacity={indicative ? 0.7 : 0.85}
            />
            {p.label ? (
              <text
                y={2.4}
                textAnchor="middle"
                fontSize="1.6"
                fill={L.textSecondary}
                fontFamily="IBM Plex Mono, monospace"
              >
                {p.label.slice(0, 12)}
              </text>
            ) : null}
          </g>
        );
      })}
      {!boundaryPts && placements.length === 0 && strokes.length === 0 ? (
        <text
          x="50"
          y="50"
          textAnchor="middle"
          fontSize="3.2"
          fill={L.textMuted}
          fontFamily="Sora, system-ui, sans-serif"
        >
          Plan snapshot
        </text>
      ) : null}
    </svg>
  );
}
