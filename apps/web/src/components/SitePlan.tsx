import {
  fitSurveyToPercentView,
  gardenPolygonToSvgPath,
  ringToSvgPoints,
} from "@workstream/domain";
import type { Survey } from "../lib/api";
import {
  projectLngLatToPercent,
  resolveStaticMapView,
} from "../lib/mapView";
import sp from "./sitePlan.module.css";

function isRealAerial(uri: string): boolean {
  return uri.startsWith("http") && !uri.startsWith("https://placeholder");
}

function metresFormat(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

type Ring = [number, number][];

export function SitePlan({
  survey,
  caption = "Site plan",
  onAerialLoad,
}: {
  survey: Survey;
  caption?: string;
  onAerialLoad?: () => void;
}) {
  const lotCoords = survey.title_polygon.coordinates[0];
  const houseCoords = survey.house_polygon.coordinates[0];
  const mapView = resolveStaticMapView(survey.aerial_uri, lotCoords);

  const lotPoints = ringToSvgPoints(lotCoords, (lng, lat) =>
    projectLngLatToPercent(lng, lat, mapView),
  );
  const housePoints = ringToSvgPoints(houseCoords, (lng, lat) =>
    projectLngLatToPercent(lng, lat, mapView),
  );
  const gardenPath = gardenPolygonToSvgPath(survey.garden_polygon, (lng, lat) =>
    projectLngLatToPercent(lng, lat, mapView),
  );

  const closedLot =
    lotCoords.length >= 2 &&
    lotCoords[0][0] === lotCoords[lotCoords.length - 1][0] &&
    lotCoords[0][1] === lotCoords[lotCoords.length - 1][1];
  const lotEdges = closedLot ? lotCoords.slice(0, -1) : lotCoords;

  const edgeLabels: Array<{ x: number; y: number; text: string }> = [];
  for (let i = 0; i < lotEdges.length; i++) {
    const a = lotEdges[i];
    const b = lotEdges[(i + 1) % lotEdges.length];
    const [ax, ay] = projectLngLatToPercent(a[0], a[1], mapView);
    const [bx, by] = projectLngLatToPercent(b[0], b[1], mapView);
    const measurement = survey.measurements[i];
    if (!measurement) continue;
    edgeLabels.push({
      x: (ax + bx) / 2,
      y: (ay + by) / 2,
      text: `${metresFormat(measurement.length_m)} m`,
    });
  }

  const hasAerial = isRealAerial(survey.aerial_uri);

  return (
    <figure className={sp.figure}>
      <div className={sp.frame} aria-label={caption}>
        {hasAerial ? (
          // eslint-disable-next-line @next/next/no-img-element -- Mapbox static URL
          <img
            src={survey.aerial_uri}
            alt=""
            className={sp.aerial}
            decoding="async"
            onLoad={onAerialLoad}
          />
        ) : (
          <div className={sp.placeholder}>
            <span className={sp.placeholderKicker}>Site plan</span>
            <span className={sp.placeholderText}>
              Add Mapbox in Settings for satellite imagery
            </span>
          </div>
        )}

        <svg
          className={sp.overlay}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
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
        </svg>

        {edgeLabels.map((m, i) => (
          <span
            key={i}
            className={sp.edgeLabel}
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
          >
            {m.text}
          </span>
        ))}
      </div>

      <figcaption className={sp.caption}>
        <span>{caption}</span>
        <span className={sp.legend}>
          <span className={sp.legendLot}>Lot boundary</span>
          <span className={sp.legendGarden}>Backyard</span>
          <span className={sp.legendHouse}>Building</span>
        </span>
        <span className={sp.areas}>
          Lot {Math.round(survey.lot_area_m2)} m² · House{" "}
          {Math.round(survey.house_area_m2)} m² · Garden{" "}
          {Math.round(survey.garden_area_m2)} m²
        </span>
      </figcaption>
    </figure>
  );
}
