import { z } from "zod";

// Minimal subset of MYOB AccountRight / MYOB Business entities Workstream
// actually reads from or writes to. Mirrors the field names the MYOB REST API
// returns so the serialiser is the identity function.

export const MyobCustomerSchema = z.object({
  uid: z.string(),
  display_id: z.string().optional(),
  company_name: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
});
export type MyobCustomer = z.infer<typeof MyobCustomerSchema>;

export const MyobItemSchema = z.object({
  uid: z.string(),
  number: z.string(),
  name: z.string(),
  base_selling_price: z.number().nonnegative(),
  unit_of_measure: z.string().nullable().optional(),
});
export type MyobItem = z.infer<typeof MyobItemSchema>;

export const SkuLinkSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string(),
  rate_card_sku: z.string(),
  myob_uid: z.string(),
  myob_item_number: z.string(),
  last_synced_at: z.string().datetime(),
});
export type SkuLink = z.infer<typeof SkuLinkSchema>;

export const ProjectMyobLinkSchema = z.object({
  project_id: z.string().uuid(),
  myob_customer_uid: z.string(),
  myob_job_number: z.string().nullable(),
  invoice_uid: z.string().nullable(),
  last_synced_at: z.string().datetime(),
});
export type ProjectMyobLink = z.infer<typeof ProjectMyobLinkSchema>;

export const MyobSyncStatusSchema = z.object({
  connected: z.boolean(),
  mode: z.enum(["live", "dev_fallback"]),
  company_file_id: z.string().nullable(),
  customers_cached: z.number().int().nonnegative(),
  items_cached: z.number().int().nonnegative(),
  sku_match_pct: z.number().min(0).max(100),
  last_sync_at: z.string().datetime().nullable(),
});
export type MyobSyncStatus = z.infer<typeof MyobSyncStatusSchema>;

export const LinkCustomerInputSchema = z.object({
  myob_customer_uid: z.string().min(1),
});
export type LinkCustomerInput = z.infer<typeof LinkCustomerInputSchema>;

export const UpsertSkuLinkInputSchema = z.object({
  rate_card_sku: z.string().min(1),
  myob_uid: z.string().min(1),
  myob_item_number: z.string().min(1),
});
export type UpsertSkuLinkInput = z.infer<typeof UpsertSkuLinkInputSchema>;
