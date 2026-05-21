import { z } from "zod";

export const PlanningBadgeCategorySchema = z.enum([
  "tree_protection",
  "stormwater",
  "heritage",
  "permit",
  "council",
]);

export const PlanningBadgeSeveritySchema = z.enum([
  "likely",
  "review",
  "clear",
]);

export const TitlePlanningBadgeSchema = z.object({
  id: z.string(),
  category: PlanningBadgeCategorySchema,
  label: z.string(),
  severity: PlanningBadgeSeveritySchema,
});

export const SiteSeasonSchema = z.object({
  label: z.string(),
  month: z.string(),
  day_of_year: z.number().int(),
});

export const SiteSunSchema = z.object({
  date_iso: z.string(),
  sunrise_local: z.string(),
  sunset_local: z.string(),
  daylight_hours: z.number(),
  solar_noon_altitude_deg: z.number(),
  now_altitude_deg: z.number(),
  now_azimuth_deg: z.number(),
  now_azimuth_label: z.string(),
  marker_x_pct: z.number(),
  marker_y_pct: z.number(),
});

export const SiteContextSchema = z.object({
  fetched_at: z.string().datetime(),
  season: SiteSeasonSchema,
  sun: SiteSunSchema,
  planning_badges: z.array(TitlePlanningBadgeSchema),
  weather_note: z.string().nullable().optional(),
});

export type SiteContext = z.infer<typeof SiteContextSchema>;
