/** Fit survey rings into a 0–100 % view (north-up) for schematic / title maps. */

type LngLat = [number, number];

export type GeoJsonPolygonLike = {
  type: "Polygon";
  coordinates: LngLat[][];
};

export type SitePlanSurveyLike = {
  title_polygon: GeoJsonPolygonLike;
  house_polygon: GeoJsonPolygonLike;
  garden_polygon: GeoJsonPolygonLike;
  garden_area_m2: number;
  lot_area_m2: number;
  house_area_m2: number;
};

export type PercentProjector = (lng: number, lat: number) => [number, number];

export function ringCentroid(ring: LngLat[]): { lng: number; lat: number } {
  const closed = closedRing(ring);
  const pts =
    closed.length >= 2 &&
    closed[0][0] === closed[closed.length - 1][0] &&
    closed[0][1] === closed[closed.length - 1][1]
      ? closed.slice(0, -1)
      : closed;
  if (pts.length === 0) return { lng: 0, lat: 0 };
  const lng = pts.reduce((s, c) => s + c[0], 0) / pts.length;
  const lat = pts.reduce((s, c) => s + c[1], 0) / pts.length;
  return { lng, lat };
}

function closedRing(ring: LngLat[]): LngLat[] {
  if (ring.length < 2) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function allRings(survey: SitePlanSurveyLike): LngLat[][] {
  const rings: LngLat[][] = [];
  rings.push(closedRing(survey.title_polygon.coordinates[0] ?? []));
  rings.push(closedRing(survey.house_polygon.coordinates[0] ?? []));
  for (const ring of survey.garden_polygon.coordinates) {
    rings.push(closedRing(ring));
  }
  return rings.filter((r) => r.length >= 3);
}

/** Uniform scale; letterboxes in 0–100 with `insetPct` margin. */
export function fitSurveyToPercentView(
  survey: SitePlanSurveyLike,
  insetPct = 10,
): PercentProjector {
  const rings = allRings(survey);
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }
  const spanLng = Math.max(maxLng - minLng, 1e-9);
  const spanLat = Math.max(maxLat - minLat, 1e-9);
  const inner = 100 - 2 * insetPct;

  return (lng: number, lat: number): [number, number] => {
    const xNorm = (lng - minLng) / spanLng;
    const yNorm = (maxLat - lat) / spanLat;
    const boxAspect = spanLng / spanLat;
    let x = xNorm;
    let y = yNorm;
    if (boxAspect > 5 / 3) {
      const scale = (3 / 5) / boxAspect;
      y = (y - 0.5) * scale + 0.5;
    } else {
      const scale = boxAspect / (5 / 3);
      x = (x - 0.5) * scale + 0.5;
    }
    return [insetPct + x * inner, insetPct + y * inner];
  };
}

export function ringToSvgPoints(
  ring: LngLat[],
  project: PercentProjector,
): string {
  const pts = closedRing(ring);
  return pts
    .map(([lng, lat]) => {
      const [x, y] = project(lng, lat);
      return `${x},${y}`;
    })
    .join(" ");
}

/** GeoJSON polygon with optional holes — backyard = lot minus house. */
export function gardenPolygonToSvgPath(
  garden: GeoJsonPolygonLike,
  project: PercentProjector,
): string {
  return garden.coordinates
    .map((ring) => {
      const pts = closedRing(ring);
      if (pts.length < 3) return "";
      const [first, ...rest] = pts;
      const [fx, fy] = project(first[0], first[1]);
      const segments = rest
        .map(([lng, lat]) => {
          const [x, y] = project(lng, lat);
          return `L ${x} ${y}`;
        })
        .join(" ");
      return `M ${fx} ${fy} ${segments} Z`;
    })
    .filter(Boolean)
    .join(" ");
}
