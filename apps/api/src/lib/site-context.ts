import type { SiteContext } from "@workstream/contracts";
import {
  approximateDaylight,
  assessTitlePlanningBadges,
  fitSurveyToPercentView,
  melbourneSeason,
  ringCentroid,
  sunMarkerOnPlanPercent,
  sunPositionAt,
  type SitePlanSurveyLike,
} from "@workstream/domain";
import { fetchForecast } from "./weather";

const OPEN_METEO =
  "https://api.open-meteo.com/v1/forecast";

function parseLocalTime(iso: string): string {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : iso;
}

async function fetchOpenMeteoSun(
  lat: number,
  lng: number,
): Promise<{
  sunrise_local: string;
  sunset_local: string;
  daylight_hours: number;
} | null> {
  if (process.env.WEATHER_DISABLED === "true") return null;
  const url =
    `${OPEN_METEO}?latitude=${lat}&longitude=${lng}` +
    `&daily=sunrise,sunset,daylight_duration` +
    `&forecast_days=1&timezone=Australia%2FMelbourne`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      daily?: {
        sunrise?: string[];
        sunset?: string[];
        daylight_duration?: number[];
      };
    };
    const d = json.daily;
    const sunrise = d?.sunrise?.[0];
    const sunset = d?.sunset?.[0];
    const durSec = d?.daylight_duration?.[0];
    if (!sunrise || !sunset) return null;
    return {
      sunrise_local: parseLocalTime(sunrise),
      sunset_local: parseLocalTime(sunset),
      daylight_hours:
        durSec != null
          ? Math.round((durSec / 3600) * 10) / 10
          : approximateDaylight(lat).daylight_hours,
    };
  } catch {
    return null;
  }
}

export async function buildSiteContext(args: {
  address: string;
  lat: number;
  lng: number;
  survey?: SitePlanSurveyLike | null;
  when?: Date;
}): Promise<SiteContext> {
  const when = args.when ?? new Date();
  const season = melbourneSeason(when);
  const sunNow = sunPositionAt(args.lat, args.lng, when);
  const approx = approximateDaylight(args.lat, when);
  const apiSun = await fetchOpenMeteoSun(args.lat, args.lng);

  const sunrise_local = apiSun?.sunrise_local ?? approx.sunrise_local;
  const sunset_local = apiSun?.sunset_local ?? approx.sunset_local;
  const daylight_hours = apiSun?.daylight_hours ?? approx.daylight_hours;

  let marker_x_pct = 50;
  let marker_y_pct = 22;
  if (args.survey) {
    const project = fitSurveyToPercentView(args.survey, 12);
    const lotRing = args.survey.title_polygon.coordinates[0] ?? [];
    const c = ringCentroid(lotRing);
    const [cx, cy] = project(c.lng, c.lat);
    const [mx, my] = sunMarkerOnPlanPercent(
      [cx, cy],
      sunNow.azimuth_deg,
    );
    marker_x_pct = mx;
    marker_y_pct = my;
  }

  const forecast = await fetchForecast(args.lat, args.lng, 1);
  let weather_note: string | null = null;
  const today = forecast.days[0];
  if (today) {
    weather_note = `${Math.round(today.temp_max_c)}° / ${Math.round(today.temp_min_c)}°`;
    if (today.precipitation_mm > 1) {
      weather_note += ` · ${today.precipitation_mm.toFixed(0)} mm rain`;
    }
  }

  return {
    fetched_at: when.toISOString(),
    season,
    sun: {
      date_iso: approx.date_iso,
      sunrise_local,
      sunset_local,
      daylight_hours,
      solar_noon_altitude_deg: approx.solar_noon_altitude_deg,
      now_altitude_deg: sunNow.altitude_deg,
      now_azimuth_deg: sunNow.azimuth_deg,
      now_azimuth_label: sunNow.azimuth_label,
      marker_x_pct,
      marker_y_pct,
    },
    planning_badges: assessTitlePlanningBadges(args.address),
    weather_note,
  };
}
