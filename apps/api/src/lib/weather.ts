/**
 * Open-Meteo weather fetcher. Free, no API key, AU coverage.
 * https://open-meteo.com/en/docs
 */

const BASE = "https://api.open-meteo.com/v1/forecast";

export type DailyForecast = {
  date: string; // YYYY-MM-DD, Melbourne TZ
  precipitation_mm: number;
  temp_max_c: number;
  temp_min_c: number;
  wind_max_kph: number;
  /** Daily mean relative humidity (%), when Open-Meteo provides it. */
  humidity_pct: number | null;
};

export type ForecastResult = {
  fetched_at: string;
  days: DailyForecast[];
  rain_within_24h: boolean;
  wind_warning: boolean; // > 40 km/h sustained
  source: "open-meteo" | "dev_fallback";
};

const DEV_FORECAST: DailyForecast[] = [
  {
    date: "2026-01-01",
    precipitation_mm: 0.2,
    temp_max_c: 28,
    temp_min_c: 17,
    wind_max_kph: 18,
    humidity_pct: 58,
  },
  {
    date: "2026-01-02",
    precipitation_mm: 6.4,
    temp_max_c: 24,
    temp_min_c: 16,
    wind_max_kph: 32,
    humidity_pct: 72,
  },
  {
    date: "2026-01-03",
    precipitation_mm: 0.0,
    temp_max_c: 30,
    temp_min_c: 18,
    wind_max_kph: 14,
    humidity_pct: 45,
  },
  {
    date: "2026-01-04",
    precipitation_mm: 0.0,
    temp_max_c: 33,
    temp_min_c: 20,
    wind_max_kph: 12,
    humidity_pct: 38,
  },
  {
    date: "2026-01-05",
    precipitation_mm: 12.8,
    temp_max_c: 22,
    temp_min_c: 15,
    wind_max_kph: 45,
    humidity_pct: 80,
  },
];

export async function fetchForecast(
  lat: number,
  lng: number,
  days = 5,
): Promise<ForecastResult> {
  if (process.env.WEATHER_DISABLED === "true") {
    return {
      fetched_at: new Date().toISOString(),
      days: DEV_FORECAST.slice(0, days),
      rain_within_24h: DEV_FORECAST[0]?.precipitation_mm > 1,
      wind_warning: DEV_FORECAST.slice(0, days).some(
        (d) => d.wind_max_kph > 40,
      ),
      source: "dev_fallback",
    };
  }

  const url =
    `${BASE}?latitude=${lat}&longitude=${lng}` +
    `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,relative_humidity_2m_mean` +
    `&forecast_days=${days}&timezone=Australia%2FMelbourne&wind_speed_unit=kmh`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const json = (await res.json()) as {
      daily?: {
        time?: string[];
        precipitation_sum?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        wind_speed_10m_max?: number[];
        relative_humidity_2m_mean?: number[];
      };
    };
    const d = json.daily ?? {};
    const out: DailyForecast[] = (d.time ?? []).map((date, i) => {
      const hum = d.relative_humidity_2m_mean?.[i];
      return {
        date,
        precipitation_mm: d.precipitation_sum?.[i] ?? 0,
        temp_max_c: d.temperature_2m_max?.[i] ?? 0,
        temp_min_c: d.temperature_2m_min?.[i] ?? 0,
        wind_max_kph: d.wind_speed_10m_max?.[i] ?? 0,
        humidity_pct:
          hum != null && Number.isFinite(hum) ? Math.round(hum) : null,
      };
    });
    return {
      fetched_at: new Date().toISOString(),
      days: out,
      rain_within_24h: (out[0]?.precipitation_mm ?? 0) > 1,
      wind_warning: out.some((day) => day.wind_max_kph > 40),
      source: "open-meteo",
    };
  } catch {
    return {
      fetched_at: new Date().toISOString(),
      days: DEV_FORECAST.slice(0, days),
      rain_within_24h: DEV_FORECAST[0]?.precipitation_mm > 1,
      wind_warning: DEV_FORECAST.slice(0, days).some(
        (day) => day.wind_max_kph > 40,
      ),
      source: "dev_fallback",
    };
  }
}
