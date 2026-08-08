import { z } from "zod";
import { DesignCanvasSchema } from "./catalog";

/** Doc-control letter: A, B, … Z, then AA, AB, … */
export const ShareRevisionLetterSchema = z
  .string()
  .regex(/^[A-Z]{1,3}$/, "Revision letter must be A–Z (up to 3 chars)");
export type ShareRevisionLetter = z.infer<typeof ShareRevisionLetterSchema>;

export const ShareRevisionStatusSchema = z.enum([
  "shared",
  "accepted",
  "declined",
  "superseded",
]);
export type ShareRevisionStatus = z.infer<typeof ShareRevisionStatusSchema>;

/** Immutable quote line captured at share time (AUD totals, incl. GST roll-up). */
export const ShareQuoteLineSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  unit: z.string().min(1).max(40),
  qty: z.number().nonnegative(),
  total: z.number().nonnegative(),
});
export type ShareQuoteLine = z.infer<typeof ShareQuoteLineSchema>;

/**
 * Frozen at share time — never mutated after create.
 * `canvas` may be null when the live BOM exists without a persisted canvas row.
 */
export const ShareSnapshotSchema = z.object({
  canvas: DesignCanvasSchema.nullable(),
  quoteLines: z.array(ShareQuoteLineSchema).min(1),
  totalInclGst: z.number().positive(),
  address: z.string().min(3).max(300),
  /** Site coords for client sun scrub (digital-twin step 1). */
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});
export type ShareSnapshot = z.infer<typeof ShareSnapshotSchema>;

export const ShareDecisionKindSchema = z.enum(["accepted", "declined"]);
export type ShareDecisionKind = z.infer<typeof ShareDecisionKindSchema>;

export const ShareDecisionSchema = z.object({
  kind: ShareDecisionKindSchema,
  clientName: z.string().trim().min(2).max(80),
  note: z.string().trim().max(500).optional(),
  decidedAt: z.string().datetime(),
});
export type ShareDecision = z.infer<typeof ShareDecisionSchema>;

export const ShareRevisionSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  owner_id: z.string().min(1),
  revision: ShareRevisionLetterSchema,
  /** 32-byte url-safe token (base64url). */
  token: z.string().min(40).max(64),
  status: ShareRevisionStatusSchema,
  created_at: z.string().datetime(),
  snapshot: ShareSnapshotSchema,
  decision: ShareDecisionSchema.optional(),
});
export type ShareRevision = z.infer<typeof ShareRevisionSchema>;

/** Owner creates a new share — server stamps canvas + address + letter + token. */
export const CreateShareRevisionInputSchema = z.object({
  quoteLines: z.array(ShareQuoteLineSchema).min(1),
  totalInclGst: z.number().positive(),
});
export type CreateShareRevisionInput = z.infer<
  typeof CreateShareRevisionInputSchema
>;

/** Public client accept / decline body. */
export const ShareDecisionInputSchema = z.object({
  kind: ShareDecisionKindSchema,
  clientName: z.string().trim().min(2).max(80),
  note: z.string().trim().max(500).optional(),
});
export type ShareDecisionInput = z.infer<typeof ShareDecisionInputSchema>;

/** Public GET payload — no token, no owner_id (avoid leaking internals). */
export const PublicSharePayloadSchema = z.object({
  revision: ShareRevisionLetterSchema,
  status: z.enum(["shared", "accepted", "declined"]),
  created_at: z.string().datetime(),
  snapshot: ShareSnapshotSchema,
  decision: ShareDecisionSchema.optional(),
});
export type PublicSharePayload = z.infer<typeof PublicSharePayloadSchema>;

/** Stable fingerprint of snapshot content (detect “nothing changed”). */
export function shareSnapshotFingerprint(
  snapshot: Pick<
    ShareSnapshot,
    "quoteLines" | "totalInclGst" | "address" | "canvas" | "lat" | "lng"
  >,
): string {
  const canvasKey = snapshot.canvas
    ? {
        placements: snapshot.canvas.placements,
        strokes: snapshot.canvas.strokes,
        features: snapshot.canvas.features ?? [],
        site_frame: snapshot.canvas.site_frame ?? null,
        irrigation_zones: snapshot.canvas.irrigation_zones ?? [],
        annotations: snapshot.canvas.annotations ?? [],
      }
    : null;
  return JSON.stringify({
    address: snapshot.address,
    lat: snapshot.lat ?? null,
    lng: snapshot.lng ?? null,
    totalInclGst: snapshot.totalInclGst,
    quoteLines: snapshot.quoteLines.map((l) => ({
      id: l.id,
      label: l.label,
      unit: l.unit,
      qty: l.qty,
      total: l.total,
    })),
    canvas: canvasKey,
  });
}

/** Next revision letter after the highest existing (0 → A). */
export function nextShareRevisionLetter(existingCount: number): string {
  if (existingCount < 0) existingCount = 0;
  let n = existingCount;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}
