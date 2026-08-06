/**
 * Stripe Checkout for deposit collection on a quote.
 *
 * Live mode: server creates a Checkout Session with mode=payment for the
 * configured deposit % of the project's Standard scenario total. Dev
 * fallback returns a fake URL so the UI flow can be exercised zero-keys.
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { Costing, Project } from "@workstream/contracts";
import { getOwnerEnv } from "./owner-secrets";

const STRIPE_API = "https://api.stripe.com/v1";

export function isStripeLive(): boolean {
  return !!getOwnerEnv("STRIPE_SECRET_KEY");
}

export type StripeKeyCheck =
  | { ok: true; livemode: boolean }
  | { ok: false; status: number; message: string };

/**
 * Verify a Stripe secret key by hitting GET /v1/balance. Fails fast when an
 * operator pastes a bad key in settings instead of waiting for the first
 * Checkout call to blow up.
 */
export async function validateStripeKey(
  secretKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<StripeKeyCheck> {
  const key = secretKey.trim();
  if (!key.startsWith("sk_")) {
    return { ok: false, status: 400, message: "Key must start with sk_" };
  }
  let res: Response;
  try {
    res = await fetchImpl(`${STRIPE_API}/balance`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "network error";
    return { ok: false, status: 502, message };
  }
  if (!res.ok) {
    let message = `Stripe rejected key (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      /* response not JSON */
    }
    return { ok: false, status: res.status, message };
  }
  const body = (await res.json()) as { livemode?: boolean };
  return { ok: true, livemode: !!body.livemode };
}

/**
 * Verify a Stripe webhook signature. Stripe sends a header:
 *   Stripe-Signature: t=<timestamp>,v1=<sig>[,v1=<sig>...]
 * The signed payload is `<t>.<rawBody>`, HMAC-SHA256 with the endpoint
 * secret as the key. Tolerance defaults to 5 minutes.
 */
export function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | undefined,
  toleranceMs = 5 * 60 * 1000,
): { ok: true } | { ok: false; reason: string } {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "STRIPE_WEBHOOK_SECRET not configured" };
    }
    return { ok: true };
  }
  if (!signatureHeader) return { ok: false, reason: "no signature header" };

  const parts = Object.fromEntries(
    signatureHeader
      .split(",")
      .map((p) => p.trim().split("="))
      .filter((pair): pair is [string, string] => pair.length === 2),
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return { ok: false, reason: "malformed signature" };

  const ageMs = Date.now() - Number(timestamp) * 1000;
  if (Number.isNaN(ageMs) || Math.abs(ageMs) > toleranceMs) {
    return { ok: false, reason: "stale signature" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature mismatch" };
  }
  return { ok: true };
}

export type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export type DepositArgs = {
  project: Project;
  costing: Costing;
  owner_id?: string;
  deposit_pct?: number; // default 20%
  success_url: string;
  cancel_url: string;
};

export type DepositResult = {
  session_id: string;
  checkout_url: string;
  deposit_amount_aud: number;
  mode: "live" | "dev_fallback";
};

export async function createDepositSession(
  args: DepositArgs,
): Promise<DepositResult> {
  const pct = args.deposit_pct ?? 20;
  const depositAud = Math.round((args.costing.total * pct) / 100);

  if (!isStripeLive()) {
    return {
      session_id: `dev-cs-${Date.now()}`,
      checkout_url: `https://web-production-3c194.up.railway.app/portal/dev-checkout/${Date.now()}`,
      deposit_amount_aud: depositAud,
      mode: "dev_fallback",
    };
  }

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", args.success_url);
  form.set("cancel_url", args.cancel_url);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "aud");
  form.set(
    "line_items[0][price_data][product_data][name]",
    `Curtis & Co · Deposit · ${args.project.address}`,
  );
  form.set(
    "line_items[0][price_data][unit_amount]",
    String(depositAud * 100), // Stripe wants cents
  );
  form.set("payment_method_types[0]", "card");
  form.set("metadata[project_id]", args.project.id);
  if (args.owner_id) {
    form.set("metadata[owner_id]", args.owner_id);
  }
  form.set("metadata[deposit_pct]", String(pct));

  const secretKey = getOwnerEnv("STRIPE_SECRET_KEY");
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured for this workspace");
  }

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Stripe ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { id: string; url: string };
  return {
    session_id: json.id,
    checkout_url: json.url,
    deposit_amount_aud: depositAud,
    mode: "live",
  };
}
