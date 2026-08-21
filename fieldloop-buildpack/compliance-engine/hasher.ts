// FieldLoop v0.1 — compliance-engine/hasher.ts
// Dispute-Shield SHA-256 signature lock.
//
// The original spec rendered `e3b0c44298fc1c149afbf4c8996fb92427ae41e…`, which
// is the SHA-256 of the empty string — a placeholder. This implementation uses a
// canonical serialization and never hashes an empty payload for a real job.

import { createHash } from 'node:crypto';

export interface SignoffPayload {
  jobId: string;
  signatureBase64: string;
  photoIds: string[];
  totalIncGst: number;
  timestamp: string; // ISO-8601, e.g. 2026-08-19T09:30:00.000Z
}

/**
 * Canonical serialization. Photo ids are sorted so the same evidence set always
 * hashes identically regardless of capture order. The total is fixed to 2 dp.
 */
function serialize(payload: SignoffPayload): string {
  return [
    payload.jobId,
    payload.signatureBase64,
    [...payload.photoIds].sort().join(','),
    payload.totalIncGst.toFixed(2),
    payload.timestamp,
  ].join('|');
}

/** Produce the Dispute-Shield SHA-256 (hex) for a signoff payload. */
export function generateDisputeShieldHash(payload: SignoffPayload): string {
  return createHash('sha256').update(serialize(payload)).digest('hex');
}

/** Verify a stored hash matches a recomputed hash (constant-time compare). */
export function verifyDisputeShieldHash(
  payload: SignoffPayload,
  expectedHash: string,
): boolean {
  const actual = generateDisputeShieldHash(payload);
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return createHash('sha256').update(a).digest().equals(
    createHash('sha256').update(b).digest(),
  );
}
