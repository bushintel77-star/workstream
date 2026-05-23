import { beforeAll, describe, expect, it } from "vitest";
import { signPortalToken, verifyPortalToken } from "./magic-link";

beforeAll(() => {
  process.env.WORKSTREAM_PORTAL_SECRET =
    "test-secret-key-with-sufficient-entropy-1234";
});

describe("portal tokens", () => {
  it("signs and verifies a token round-trip", () => {
    const token = signPortalToken({
      project_id: "11111111-1111-1111-1111-111111111111",
      scope: "quote_view",
    });
    const verified = verifyPortalToken(token);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.payload.project_id).toBe(
        "11111111-1111-1111-1111-111111111111",
      );
      expect(verified.payload.scope).toBe("quote_view");
      expect(verified.payload.exp).toBeGreaterThan(Date.now());
    }
  });

  it("rejects a tampered payload", () => {
    const token = signPortalToken({
      project_id: "11111111-1111-1111-1111-111111111111",
      scope: "quote_view",
    });
    const [payload, sig] = token.split(".");
    // Swap one character in the payload — sig won't match
    const tampered = payload.slice(0, -1) + (payload.slice(-1) === "A" ? "B" : "A");
    const verified = verifyPortalToken(`${tampered}.${sig}`);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.reason).toMatch(/signature|payload/);
    }
  });

  it("rejects a malformed token", () => {
    const verified = verifyPortalToken("notatokenatall");
    expect(verified.ok).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = signPortalToken({
      project_id: "11111111-1111-1111-1111-111111111111",
      scope: "quote_view",
      ttl_ms: -1000, // already expired
    });
    const verified = verifyPortalToken(token);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.reason).toBe("expired");
    }
  });

  it("generates different tokens each time (nonce)", () => {
    const a = signPortalToken({ project_id: "p", scope: "quote_view" });
    const b = signPortalToken({ project_id: "p", scope: "quote_view" });
    expect(a).not.toBe(b);
  });
});
