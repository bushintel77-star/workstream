export type SunDatePreset =
  | "today"
  | "march-equinox"
  | "winter"
  | "september-equinox"
  | "summer";

export const SUN_DATE_PRESETS: SunDatePreset[] = [
  "today",
  "march-equinox",
  "winter",
  "september-equinox",
  "summer",
];

const MELBOURNE_TZ = "Australia/Melbourne";

type MelParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function melbourneParts(when: Date): MelParts {
  const raw = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: MELBOURNE_TZ,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(when)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>;
  return {
    year: raw.year!,
    month: raw.month!,
    day: raw.day!,
    hour: raw.hour!,
    minute: raw.minute!,
  };
}

/**
 * Convert Melbourne civil wall-clock → UTC instant.
 * Probes DST (+10 / +11) so winter noon is daytime on CI runners in UTC.
 */
function melbourneLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  // Initial guess: AEST (UTC+10).
  let utcMs = Date.UTC(year, month - 1, day, hour - 10, minute, 0, 0);
  for (let i = 0; i < 4; i += 1) {
    const got = melbourneParts(new Date(utcMs));
    const wantMs = Date.UTC(year, month - 1, day, hour, minute);
    const gotMs = Date.UTC(
      got.year,
      got.month - 1,
      got.day,
      got.hour,
      got.minute,
    );
    const delta = wantMs - gotMs;
    if (delta === 0) break;
    utcMs += delta;
  }
  return new Date(utcMs);
}

/**
 * Build the sun clock for shade / cast.
 * `sunMin` is Australia/Melbourne wall-clock minutes from midnight on the
 * preset calendar day (not the runner's local TZ).
 */
export function sunDateFromPreset(
  preset: SunDatePreset,
  sunMin: number,
  now = new Date(),
): Date {
  const mel = melbourneParts(now);
  const { year } = mel;
  let { month, day } = mel;
  if (preset === "march-equinox") {
    month = 3;
    day = 20;
  } else if (preset === "winter") {
    month = 6;
    day = 21;
  } else if (preset === "september-equinox") {
    month = 9;
    day = 22;
  } else if (preset === "summer") {
    month = 12;
    day = 21;
  }
  const hour = Math.floor(sunMin / 60);
  const minute = sunMin % 60;
  return melbourneLocalToUtc(year, month, day, hour, minute);
}

export function sunDatePresetLabel(preset: SunDatePreset): string {
  if (preset === "march-equinox") return "20 Mar";
  if (preset === "winter") return "21 Jun";
  if (preset === "september-equinox") return "22 Sep";
  if (preset === "summer") return "21 Dec";
  return "Today";
}
