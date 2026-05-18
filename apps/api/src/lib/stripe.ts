/**
 * Stripe Checkout for deposit collection on a quote.
 *
 * Live mode: server creates a Checkout Session with mode=payment for the
 * configured deposit % of the project's Standard scenario total. Dev
 * fallback returns a fake URL so the UI flow can be exercised zero-keys.
 */

import type { Costing, Project } from "@construct/contracts";

const STRIPE_API = "https://api.stripe.com/v1";

export function isStripeLive(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export type DepositArgs = {
  project: Project;
  costing: Costing;
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
      checkout_url: `https://construct.example/portal/dev-checkout/${Date.now()}`,
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
  form.set("metadata[deposit_pct]", String(pct));

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
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
