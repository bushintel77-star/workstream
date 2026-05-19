import { createHmac } from "crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { validateStripeKey, verifyStripeWebhook } from "./stripe";

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

describe("validateStripeKey", () => {
  it("rejects keys that don't start with sk_ without making a request", async () => {
    const fetchImpl = (() => {
      throw new Error("should not be called");
    }) as unknown as typeof fetch;
    const result = await validateStripeKey("pk_live_abc", fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("accepts a key that Stripe's /v1/balance accepts", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ livemode: false }), {
        status: 200,
      })) as unknown as typeof fetch;
    const result = await validateStripeKey("sk_test_abc", fetchImpl);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.livemode).toBe(false);
  });

  it("surfaces Stripe's rejection message when /v1/balance returns 401", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({ error: { message: "Invalid API Key provided" } }),
        { status: 401 },
      )) as unknown as typeof fetch;
    const result = await validateStripeKey("sk_test_bad", fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.message).toBe("Invalid API Key provided");
    }
  });

  it("returns a 502 when the network call throws", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const result = await validateStripeKey("sk_test_abc", fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(502);
      expect(result.message).toBe("ECONNREFUSED");
    }
  });
});
