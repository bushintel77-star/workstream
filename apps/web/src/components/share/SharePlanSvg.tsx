import type { DesignCanvas } from "@workstream/contracts";
import css from "./sharePlan.module.css";

type Props = {
  canvas: DesignCanvas | null;
  address: string;
};

/**
 * Lightweight read-only plan from the frozen share snapshot.
 * Avoids mounting the full studio; SVG from placements + site_frame.
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
    >
      <rect x="0" y="0" width="100" height="100" fill="#faf6f2" />
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
              fill="rgba(194,69,95,0.35)"
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
              stroke="rgba(194,69,95,0.55)"
              strokeWidth="0.4"
            />
          );
        }
        return (
          <polygon
            key={f.id}
            points={pts}
            fill="rgba(194,69,95,0.12)"
            stroke="rgba(194,69,95,0.45)"
            strokeWidth="0.35"
          />
        );
      })}
      {boundaryPts ? (
        <polygon
          points={boundaryPts}
          fill="none"
          stroke="#241318"
          strokeWidth="0.55"
        />
      ) : null}
      {buildingPts ? (
        <polygon
          points={buildingPts}
          fill="rgba(36,19,24,0.08)"
          stroke="#241318"
          strokeWidth="0.4"
        />
      ) : null}
      {strokes.map((s) => {
        const d = s.points
          .map((p, i) => `${i === 0 ? "M" : "L"}${p.x_pct} ${p.y_pct}`)
          .join(" ");
        return (
          <path
            key={s.id}
            d={d}
            fill="none"
            stroke={s.color || "#c2455f"}
            strokeWidth={Math.max(0.2, (s.width_px ?? 2) / 20)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
      {placements.map((p) => (
        <g key={p.id} transform={`translate(${p.x_pct} ${p.y_pct})`}>
          <circle
            r={1.1 * (p.scale ?? 1)}
            fill="#c2455f"
            opacity={0.85}
          />
          {p.label ? (
            <text
              y={2.4}
              textAnchor="middle"
              fontSize="1.6"
              fill="#7a5560"
              fontFamily="IBM Plex Mono, monospace"
            >
              {p.label.slice(0, 12)}
            </text>
          ) : null}
        </g>
      ))}
      {!boundaryPts && placements.length === 0 && strokes.length === 0 ? (
        <text
          x="50"
          y="50"
          textAnchor="middle"
          fontSize="3.2"
          fill="#b08a95"
          fontFamily="Sora, system-ui, sans-serif"
        >
          Plan snapshot
        </text>
      ) : null}
    </svg>
  );
}
