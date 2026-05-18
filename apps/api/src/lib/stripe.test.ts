import { createHmac } from "crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { verifyStripeWebhook } from "./stripe";

const SECRET = "whsec_test_1234567890abcdef";

beforeAll(() => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  process.env.NODE_ENV = "production"; // force secret-required path
});

afterEach(() => {
  // restore
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
});

function sign(body: string, ts = Math.floor(Date.now() / 1000)): string {
  const sig = createHmac("sha256", SECRET)
    .update(`${ts}.${body}`)
    .digest("hex");
  return `t=${ts},v1=${sig}`;
}

describe("verifyStripeWebhook", () => {
  it("accepts a correctly signed payload", () => {
    const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
    const result = verifyStripeWebhook(body, sign(body));
    expect(result.ok).toBe(true);
  });

  it("rejects a signature that doesn't match the body", () => {
    const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
    const sig = sign("different-body");
    const result = verifyStripeWebhook(body, sig);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("signature mismatch");
  });

  it("rejects a stale timestamp", () => {
    const body = "test";
    const tenMinAgo = Math.floor(Date.now() / 1000) - 600;
    const sig = sign(body, tenMinAgo);
    const result = verifyStripeWebhook(body, sig);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("stale signature");
  });

  it("rejects a missing signature header", () => {
    const result = verifyStripeWebhook("body", undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no signature header");
  });

  it("rejects a malformed signature header", () => {
    const result = verifyStripeWebhook("body", "not-a-real-sig");
    expect(result.ok).toBe(false);
  });

  it("skips verification in dev when no secret is set", () => {
    const previous = process.env.STRIPE_WEBHOOK_SECRET;
    const previousEnv = process.env.NODE_ENV;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.NODE_ENV = "development";
    const result = verifyStripeWebhook("anything", "no-sig");
    expect(result.ok).toBe(true);
    process.env.STRIPE_WEBHOOK_SECRET = previous;
    process.env.NODE_ENV = previousEnv;
  });
});
