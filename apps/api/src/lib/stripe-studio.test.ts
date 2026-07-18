import { describe, expect, it } from "vitest";
import { createMemoryStore } from "@workstream/db";
import { applyStudioFromCheckoutSession } from "./stripe-studio";

describe("applyStudioFromCheckoutSession", () => {
  it("rejects owner when Stripe customer does not match billing", async () => {
    const store = createMemoryStore();
    const ownerId = "user_a";
    await store.patchWorkspaceBilling(ownerId, {
      stripe_customer_id: "cus_real",
    });

    const ok = await applyStudioFromCheckoutSession(store, {
      metadata: { owner_id: ownerId, purpose: "studio_upgrade" },
      customer: "cus_attacker",
      subscription: "sub_1",
    });

    expect(ok).toBe(false);
    const billing = await store.getWorkspaceBilling(ownerId);
    expect(billing.plan).toBe("lite");
  });

  it("activates studio when customer matches", async () => {
    const store = createMemoryStore();
    const ownerId = "user_b";
    await store.patchWorkspaceBilling(ownerId, {
      stripe_customer_id: "cus_match",
    });

    const ok = await applyStudioFromCheckoutSession(store, {
      metadata: { owner_id: ownerId, purpose: "studio_upgrade" },
      customer: "cus_match",
      subscription: "sub_2",
    });

    expect(ok).toBe(true);
    const billing = await store.getWorkspaceBilling(ownerId);
    expect(billing.plan).toBe("studio");
    expect(billing.stripe_subscription_id).toBe("sub_2");
  });

  it("adds seats on seat_add checkout", async () => {
    const store = createMemoryStore();
    const ownerId = "user_c";
    await store.patchWorkspaceBilling(ownerId, {
      plan: "studio",
      seat_limit: 1,
      stripe_customer_id: "cus_c",
    });

    const ok = await applyStudioFromCheckoutSession(store, {
      metadata: {
        owner_id: ownerId,
        purpose: "seat_add",
        extra_seats: "2",
      },
      customer: "cus_c",
      subscription: "sub_seats",
    });

    expect(ok).toBe(true);
    const billing = await store.getWorkspaceBilling(ownerId);
    expect(billing.seat_limit).toBe(3);
  });
});
