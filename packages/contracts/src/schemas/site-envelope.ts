import { z } from "zod";

/**
 * Site Envelope — the fused growing-conditions summary (sun × season ×
 * wetness × slope × soil indicators) that turns plant selection into an
 * aesthetic decision: everything that will NOT thrive is filtered or
 * down-ranked before the operator ever sees the palette.
 *
 * Honest data model (zero-mock law): every field carries its basis. Soil is
 * an INDICATOR (overlay flags + EVC context), never an invented grid; sun
 * classes come from the indicative shade grid at seasonal presets; wetness
 * from Vicmap overlays + terrain-derived ponding/streams.
 */

/** Sun exposure class — aligned with the flora exposure bands. */
export const SiteSunClassSchema = z.enum(["full_sun", "part_shade", "shade"]);
export type SiteSunClass = z.infer<typeof SiteSunClassSchema>;

/**
 * Wetness class. `flood_prone` (Vicmap flood/overland-flow overlay or real
 * ponding) dominates; `wet` (wetland overlay / deep ponding); `moist`
 * (streams present / shallow ponding); `dry` (no wetness drivers).
 */
export const SiteWetnessClassSchema = z.enum(["dry", "moist", "wet", "flood_prone"]);
export type SiteWetnessClass = z.infer<typeof SiteWetnessClassSchema>;

/** Seasonal sun summary at one preset. */
export const SeasonalSunSchema = z.object({
  /** Sun preset — winter (Jun 21) and summer (Dec 21) are the design bounds. */
  preset: z.enum(["winter", "summer"]),
  /** Mean indicative sun hours across the lot at this preset (0–12). */
  meanHours: z.number().min(0).max(12),
  /** Fraction of lot cells in each sun class (sums to ~1). */
  classFractions: z.record(SiteSunClassSchema, z.number().min(0).max(1)),
});
export type SeasonalSun = z.infer<typeof SeasonalSunSchema>;

/** One wetness driver with its evidence — never an assertion without basis. */
export const WetnessDriverSchema = z.object({
  kind: z.enum(["flood_overlay", "wetland_overlay", "ponding", "streams"]),
  /** Human evidence line — e.g. "LSIO overland flow (Vicmap)" or "2 ponding points, max 0.11 m". */
  evidence: z.string().min(1),
});
export type WetnessDriver = z.infer<typeof WetnessDriverSchema>;

/** Wetness class + its drivers (the class is the worst driver present). */
export const SiteWetnessSummarySchema = z.object({
  class: SiteWetnessClassSchema,
  drivers: z.array(WetnessDriverSchema),
});
export type SiteWetnessSummary = z.infer<typeof SiteWetnessSummarySchema>;

export const SiteEnvelopeSchema = z.object({
  /** Month the envelope was computed for (1–12, Melbourne season follows). */
  month: z.number().int().min(1).max(12),
  /** Winter + summer sun bounds (length 2, order: winter, summer). */
  seasonalSun: z.array(SeasonalSunSchema).length(2),
  /** Worst-of-seasons sun class used for palette filtering (winter-bound). */
  plantingSunClass: SiteSunClassSchema,
  wetness: SiteWetnessSummarySchema,
  slope: z
    .object({
      slopeDeg: z.number().min(0).max(90),
      aspect: z.enum(["N", "S", "E", "W"]),
    })
    .nullable(),
  /** Acid-sulfate soils flagged — excavation/planting constraint. */
  acidSulfate: z.boolean(),
  /** EVC (native vegetation class) label when the overlay hydrated — soil
   * moisture/nutrient CONTEXT, pass-through from NatureKit, never inferred. */
  nativeVegetationLabel: z.string().nullable(),
  /** Free-text summary line for chips ("Part shade · moist · 4.2° S slope"). */
  summaryLine: z.string().min(1),
});
export type SiteEnvelope = z.infer<typeof SiteEnvelopeSchema>;
