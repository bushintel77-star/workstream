import type { Store } from "@workstream/db";
import { isStripeLive } from "./stripe";

const STRIPE_API = "https://api.stripe.com/v1";

export type StudioCheckoutResult = {
  checkout_url: string;
  session_id: string;
  mode: "live" | "dev_fallback";
};

export function studioPriceConfigured(): boolean {
  return !!process.env.STRIPE_STUDIO_PRICE_ID?.trim();
}

export async function createStudioCheckout(
  store: Store,
  ownerId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<StudioCheckoutResult> {
  const priceId = process.env.STRIPE_STUDIO_PRICE_ID?.trim();

  if (!isStripeLive() || !priceId) {
    await store.setWorkspacePlan(ownerId, "studio");
    return {
      checkout_url: `${successUrl}${successUrl.includes("?") ? "&" : "?"}studio=dev`,
      session_id: `dev-studio-${Date.now()}`,
      mode: "dev_fallback",
    };
  }

  const billing = await store.getWorkspaceBilling(ownerId);
  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("success_url", successUrl);
  form.set("cancel_url", cancelUrl);
  form.set("line_items[0][price]", priceId);
  form.set("line_items[0][quantity]", "1");
  form.set("metadata[owner_id]", ownerId);
  form.set("metadata[purpose]", "studio_upgrade");
  form.set("subscription_data[metadata][owner_id]", ownerId);
  form.set("subscription_data[metadata][purpose]", "studio_upgrade");
  if (billing.stripe_customer_id) {
    form.set("customer", billing.stripe_customer_id);
  }

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Stripe checkout ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { id: string; url: string };
  return {
    checkout_url: json.url,
    session_id: json.id,
    mode: "live",
  };
}

export async function applyStudioFromCheckoutSession(
  store: Store,
  session: {
    metadata?: { owner_id?: string; purpose?: string };
    customer?: string;
    subscription?: string;
  },
): Promise<boolean> {
  if (session.metadata?.purpose !== "studio_upgrade") return false;
  const ownerId = session.metadata?.owner_id;
  if (!ownerId) return false;
  const billing = await store.getWorkspaceBilling(ownerId);
  const customer =
    typeof session.customer === "string" ? session.customer : null;
  if (
    billing.stripe_customer_id &&
    customer &&
    billing.stripe_customer_id !== customer
  ) {
    return false;
  }
  await store.patchWorkspaceBilling(ownerId, {
    plan: "studio",
    seat_limit: 1,
    stripe_customer_id:
      typeof session.customer === "string" ? session.customer : null,
    stripe_subscription_id:
      typeof session.subscription === "string" ? session.subscription : null,
  });
  return true;
}
