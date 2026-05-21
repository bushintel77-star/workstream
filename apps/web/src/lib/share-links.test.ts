import { describe, expect, it } from "vitest";
import { buildWhatsAppShareUrl } from "./share-links";

describe("buildWhatsAppShareUrl", () => {
  it("encodes quote and portal in message text", () => {
    const url = buildWhatsAppShareUrl({
      address: "12 High St, Prahran",
      quoteUrl: "https://api.example/outputs/q1",
      portalUrl: "https://app.example/portal/t1",
      clientName: "Sam",
    });
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    const text = decodeURIComponent(url.replace("https://wa.me/?text=", ""));
    expect(text).toContain("Sam");
    expect(text).toContain("12 High St");
    expect(text).toContain("https://api.example/outputs/q1");
    expect(text).toContain("https://app.example/portal/t1");
  });
});
