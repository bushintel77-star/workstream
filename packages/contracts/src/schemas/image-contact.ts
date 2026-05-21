import { z } from "zod";

/** Email/name read from a photo (card, plan title block, site sign) — not sent as email attachment. */
export const ImageContactScanSchema = z.object({
  client_name: z.string().nullable(),
  client_email: z.string().email().nullable(),
  notes: z.string().nullable(),
});
export type ImageContactScan = z.infer<typeof ImageContactScanSchema>;
