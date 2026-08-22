import type { Store } from "@workstream/db";
import { isStripeLive } from "./stripe";
import { getOwnerEnv } from "./owner-secrets";

const STRIPE_API = "https://api.stripe.com/v1";

export type StudioCheckoutResult = {
  checkout_url: string;
  session_id: string;
  mode: "live" | "dev_fallback";
};

export function studioPriceConfigured(): boolean {
  return !!process.env.STRIPE_STUDIO_PRICE_ID?.trim();
}

export function seatPriceConfigured(): boolean {
  return !!process.env.STRIPE_SEAT_PRICE_ID?.trim();
}

export type SeatCheckoutResult = {
  checkout_url: string;
  session_id: string;
  mode: "live" | "dev_fallback";
  seat_limit: number;
};

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
    throw new Error(`Stripe checkout ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { id: string; url: string };
  return {
    checkout_url: json.url,
    session_id: json.id,
    mode: "live",
  };
}

export async function createSeatCheckout(
  store: Store,
  ownerId: string,
  successUrl: string,
  cancelUrl: string,
  extraSeats = 1,
): Promise<SeatCheckoutResult> {
  const qty = Math.max(1, Math.min(20, Math.floor(extraSeats)));
  const priceId = process.env.STRIPE_SEAT_PRICE_ID?.trim();
  const billing = await store.getWorkspaceBilling(ownerId);

  if (billing.plan !== "studio") {
    throw new Error("Add seats requires an active Design & Build License (Studio)");
  }

  if (!isStripeLive() || !priceId) {
    const nextLimit = billing.seat_limit + qty;
    await store.patchWorkspaceBilling(ownerId, { seat_limit: nextLimit });
    return {
      checkout_url: `${successUrl}${successUrl.includes("?") ? "&" : "?"}seats=dev`,
      session_id: `dev-seats-${Date.now()}`,
      mode: "dev_fallback",
      seat_limit: nextLimit,
    };
  }

  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("success_url", successUrl);
  form.set("cancel_url", cancelUrl);
  form.set("line_items[0][price]", priceId);
  form.set("line_items[0][quantity]", String(qty));
  form.set("metadata[owner_id]", ownerId);
  form.set("metadata[purpose]", "seat_add");
  form.set("metadata[extra_seats]", String(qty));
  form.set("subscription_data[metadata][owner_id]", ownerId);
  form.set("subscription_data[metadata][purpose]", "seat_add");
  if (billing.stripe_customer_id) {
    form.set("customer", billing.stripe_customer_id);
  }

  const seatSecretKey = getOwnerEnv("STRIPE_SECRET_KEY");
  if (!seatSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured for this workspace");
  }
  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${seatSecretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Stripe seat checkout ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { id: string; url: string };
  return {
    checkout_url: json.url,
    session_id: json.id,
    mode: "live",
    seat_limit: billing.seat_limit,
  };
}

export async function applyStudioFromCheckoutSession(
  store: Store,
  session: {
    metadata?: {
      owner_id?: string;
      purpose?: string;
      extra_seats?: string;
    };
    customer?: string;
    subscription?: string;
  },
): Promise<boolean> {
  const purpose = session.metadata?.purpose;
  if (purpose !== "studio_upgrade" && purpose !== "seat_add") return false;
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

  if (purpose === "seat_add") {
    const extra = Math.max(
      1,
      Math.min(20, Number(session.metadata?.extra_seats ?? "1") || 1),
    );
    await store.patchWorkspaceBilling(ownerId, {
      plan: "studio",
      seat_limit: billing.seat_limit + extra,
      stripe_customer_id:
        typeof session.customer === "string"
          ? session.customer
          : billing.stripe_customer_id,
      stripe_subscription_id:
        typeof session.subscription === "string"
          ? session.subscription
          : billing.stripe_subscription_id,
    });
    return true;
  }

  await store.patchWorkspaceBilling(ownerId, {
    plan: "studio",
    seat_limit: Math.max(1, billing.seat_limit),
    stripe_customer_id:
      typeof session.customer === "string" ? session.customer : null,
    stripe_subscription_id:
      typeof session.subscription === "string" ? session.subscription : null,
  });
  return true;
}
