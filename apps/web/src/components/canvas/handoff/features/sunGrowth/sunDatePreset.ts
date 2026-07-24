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

export function sunDateFromPreset(
  preset: SunDatePreset,
  sunMin: number,
  now = new Date(),
): Date {
  const date = new Date(now);
  if (preset === "march-equinox") date.setMonth(2, 20);
  if (preset === "winter") date.setMonth(5, 21);
  if (preset === "september-equinox") date.setMonth(8, 22);
  if (preset === "summer") date.setMonth(11, 21);
  date.setHours(Math.floor(sunMin / 60), sunMin % 60, 0, 0);
  return date;
}

export function sunDatePresetLabel(preset: SunDatePreset): string {
  if (preset === "march-equinox") return "20 Mar";
  if (preset === "winter") return "21 Jun";
  if (preset === "september-equinox") return "22 Sep";
  if (preset === "summer") return "21 Dec";
  return "Today";
}
