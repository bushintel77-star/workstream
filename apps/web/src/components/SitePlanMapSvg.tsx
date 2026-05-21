import {
  fitSurveyToPercentView,
  gardenPolygonToSvgPath,
  ringToSvgPoints,
  type SitePlanSurveyLike,
} from "@workstream/domain";
import type { Survey } from "../lib/api";
import sp from "./sitePlan.module.css";

function metresFormat(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

export function SitePlanMapSvg({
  survey,
  showEdgeLabels = true,
  className,
  sunMarker,
}: {
  survey: Survey | SitePlanSurveyLike;
  showEdgeLabels?: boolean;
  className?: string;
  sunMarker?: {
    x_pct: number;
    y_pct: number;
    azimuth_label: string;
    altitude_deg: number;
  };
}) {
  const project = fitSurveyToPercentView(survey, 12);
  const lotRing = survey.title_polygon.coordinates[0] ?? [];
  const houseRing = survey.house_polygon.coordinates[0] ?? [];
  const lotPoints = ringToSvgPoints(lotRing, project);
  const housePoints = ringToSvgPoints(houseRing, project);
  const gardenPath = gardenPolygonToSvgPath(survey.garden_polygon, project);

  const closedLot =
    lotRing.length >= 2 &&
    lotRing[0][0] === lotRing[lotRing.length - 1][0] &&
    lotRing[0][1] === lotRing[lotRing.length - 1][1];
  const lotEdges = closedLot ? lotRing.slice(0, -1) : lotRing;

  const edgeLabels: Array<{ x: number; y: number; text: string }> = [];
  if (showEdgeLabels && "measurements" in survey) {
    for (let i = 0; i < lotEdges.length; i++) {
      const a = lotEdges[i];
      const b = lotEdges[(i + 1) % lotEdges.length];
      if (!a || !b) continue;
      const [ax, ay] = project(a[0], a[1]);
      const [bx, by] = project(b[0], b[1]);
      const measurement = survey.measurements[i];
      if (!measurement) continue;
      edgeLabels.push({
        x: (ax + bx) / 2,
        y: (ay + by) / 2,
        text: `${metresFormat(measurement.length_m)} m`,
      });
    }
  }

  return (
    <>
      <svg
        className={className ?? sp.overlay}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        {gardenPath ? (
          <path
            d={gardenPath}
            className={sp.gardenPoly}
            fillRule="evenodd"
          />
        ) : null}
        <polygon points={lotPoints} className={sp.lotGlow} />
        <polygon
          points={lotPoints}
          className={sp.lotPoly}
          vectorEffect="non-scaling-stroke"
        />
        <polygon points={housePoints} className={sp.housePoly} />
        {sunMarker ? (
          <>
            <path
              d={`M 8 72 A 42 42 0 0 1 92 72`}
              className={sp.sunArc}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={sunMarker.x_pct}
              cy={sunMarker.y_pct}
              r={2.4}
              className={sp.sunDot}
            />
          </>
        ) : null}
      </svg>
      {sunMarker ? (
        <span
          className={sp.sunLabel}
          style={{
            left: `${sunMarker.x_pct}%`,
            top: `${sunMarker.y_pct}%`,
          }}
        >
          Sun {sunMarker.azimuth_label} · {sunMarker.altitude_deg}°
        </span>
      ) : null}
      {edgeLabels.map((m, i) => (
        <span
          key={i}
          className={sp.edgeLabel}
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
        >
          {m.text}
        </span>
      ))}
    </>
  );
}
