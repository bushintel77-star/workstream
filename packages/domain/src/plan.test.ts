import { describe, expect, it } from "vitest";
import { canUseLiveIntegration, isStudioLiveKey } from "./plan";

describe("plan", () => {
  it("studio live keys are gated on studio plan", () => {
    expect(isStudioLiveKey("CRM_WEBHOOK_URL")).toBe(true);
    expect(isStudioLiveKey("CLERK_SECRET_KEY")).toBe(false);
    expect(canUseLiveIntegration("lite", "CRM_WEBHOOK_URL")).toBe(false);
    expect(canUseLiveIntegration("studio", "CRM_WEBHOOK_URL")).toBe(true);
    expect(canUseLiveIntegration("lite", "CLERK_SECRET_KEY")).toBe(true);
  });
});
