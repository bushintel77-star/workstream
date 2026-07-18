import { describe, expect, it } from "vitest";
import {
  canAddWorkspaceSeat,
  canUseLiveIntegration,
  isStudioLiveKey,
  licenseLabel,
} from "./plan";

describe("plan", () => {
  it("studio live keys are gated on studio plan", () => {
    expect(isStudioLiveKey("CRM_WEBHOOK_URL")).toBe(true);
    expect(isStudioLiveKey("CLERK_SECRET_KEY")).toBe(false);
    expect(canUseLiveIntegration("lite", "CRM_WEBHOOK_URL")).toBe(false);
    expect(canUseLiveIntegration("studio", "CRM_WEBHOOK_URL")).toBe(true);
    expect(canUseLiveIntegration("lite", "CLERK_SECRET_KEY")).toBe(true);
  });

  it("enforces seat limits", () => {
    expect(canAddWorkspaceSeat(1, 0)).toBe(true);
    expect(canAddWorkspaceSeat(1, 1)).toBe(false);
    expect(canAddWorkspaceSeat(3, 2)).toBe(true);
  });

  it("labels Design & Build License", () => {
    expect(licenseLabel("lite")).toContain("Lite");
    expect(licenseLabel("studio")).toContain("Studio");
  });
});
