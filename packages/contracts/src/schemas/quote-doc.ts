import { z } from "zod";
import { LineItemSchema } from "./costing";

export const QuoteSectionIdSchema = z.enum([
  "sitework",
  "hardscape",
  "planting",
  "drainage",
  "provisional",
  "custom",
]);
export type QuoteSectionId = z.infer<typeof QuoteSectionIdSchema>;

/**
 * Operator override over a live estimate line.
 * Prefer stable engine `line_id`; optional `sku` aids re-merge / display.
 */
export const QuoteOverrideSchema = z.object({
  line_id: z.string().min(1),
  sku: z.string().min(1).optional(),
  qty: z.number().positive().optional(),
  rate: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
  excluded: z.boolean().optional(),
  is_provisional: z.boolean().optional(),
  section: QuoteSectionIdSchema.optional(),
  /** When set, this line is an alternate of another engine/custom line id. */
  alternate_of: z.string().min(1).optional(),
  /** Selected alternate contributes to base total. */
  alternate_selected: z.boolean().optional(),
});
export type QuoteOverride = z.infer<typeof QuoteOverrideSchema>;

export const QuoteCustomLineSchema = LineItemSchema.extend({
  id: z.string().min(1),
  section: QuoteSectionIdSchema.default("custom"),
});
export type QuoteCustomLine = z.infer<typeof QuoteCustomLineSchema>;

export const QuoteMarginSchema = z.object({
  global_pct: z.number().min(0).max(100).default(0),
  by_section: z
    .record(QuoteSectionIdSchema, z.number().min(0).max(100))
    .default({}),
});
export type QuoteMargin = z.infer<typeof QuoteMarginSchema>;

export const QuoteDocSchema = z.object({
  project_id: z.string().uuid(),
  design_id: z.string().uuid().nullable().optional(),
  overrides: z.array(QuoteOverrideSchema).default([]),
  custom_lines: z.array(QuoteCustomLineSchema).default([]),
  margin: QuoteMarginSchema.default({ global_pct: 0, by_section: {} }),
  updated_at: z.string().datetime(),
});
export type QuoteDoc = z.infer<typeof QuoteDocSchema>;

export const UpsertQuoteDocInputSchema = QuoteDocSchema.omit({
  updated_at: true,
}).partial({
  overrides: true,
  custom_lines: true,
  margin: true,
  design_id: true,
});
export type UpsertQuoteDocInput = z.infer<typeof UpsertQuoteDocInputSchema>;
