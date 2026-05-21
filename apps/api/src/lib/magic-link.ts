import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Stateless HMAC-signed magic-link tokens for the client portal.
 *
 * Format: <payload-b64url>.<sig-b64url>
 * Payload: JSON { project_id, scope, exp, nonce }
 *
 * Scope discriminates what the link unlocks (quote view, deposit checkout,
 * change request). Expiry is enforced in verify(). The secret is
 * WORKSTREAM_PORTAL_SECRET — generate a long random string per deploy.
 */

export type PortalScope = "quote_view" | "deposit_checkout" | "change_request";

export type PortalTokenPayload = {
  project_id: string;
  scope: PortalScope;
  exp: number; // epoch ms
  nonce: string;
};

function secret(): string {
  const s =
    process.env.WORKSTREAM_PORTAL_SECRET ??
    process.env.CONSTRUCT_PORTAL_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "WORKSTREAM_PORTAL_SECRET is required in production to sign portal links.",
      );
    }
    return "dev-portal-secret-do-not-use-in-prod";
  }
  return s;
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

export function signPortalToken(args: {
  project_id: string;
  scope: PortalScope;
  ttl_ms?: number;
}): string {
  const ttl = args.ttl_ms ?? 7 * 24 * 60 * 60 * 1000;
  const payload: PortalTokenPayload = {
    project_id: args.project_id,
    scope: args.scope,
    exp: Date.now() + ttl,
    nonce: randomBytes(8).toString("hex"),
  };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = createHmac("sha256", secret()).update(payloadB64).digest();
  return `${payloadB64}.${b64url(sig)}`;
}

export function verifyPortalToken(
  token: string,
): { ok: true; payload: PortalTokenPayload } | { ok: false; reason: string } {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed token" };
  const [payloadB64, sigB64] = parts;

  const expected = createHmac("sha256", secret()).update(payloadB64).digest();
  let got: Buffer;
  try {
    got = b64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: "bad signature encoding" };
  }
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    return { ok: false, reason: "signature mismatch" };
  }

  let payload: PortalTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
  } catch {
    return { ok: false, reason: "bad payload encoding" };
  }
  if (Date.now() > payload.exp) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload };
}
