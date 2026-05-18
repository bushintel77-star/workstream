import { z } from "zod";

export const XeroContactSchema = z.object({
  contact_id: z.string(),
  name: z.string(),
  email_address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});
export type XeroContact = z.infer<typeof XeroContactSchema>;

export const XeroItemSchema = z.object({
  item_id: z.string(),
  code: z.string(),
  name: z.string(),
  sales_unit_price: z.number().nonnegative(),
  unit_of_measure: z.string().nullable().optional(),
});
export type XeroItem = z.infer<typeof XeroItemSchema>;

export const XeroSyncStatusSchema = z.object({
  connected: z.boolean(),
  mode: z.enum(["live", "dev_fallback"]),
  tenant_id: z.string().nullable(),
  contacts_cached: z.number().int().nonnegative(),
  items_cached: z.number().int().nonnegative(),
  last_sync_at: z.string().datetime().nullable(),
});
export type XeroSyncStatus = z.infer<typeof XeroSyncStatusSchema>;
