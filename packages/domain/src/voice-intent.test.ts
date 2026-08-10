import { describe, expect, it } from "vitest";
import { classifyVoiceIntent } from "./voice-intent";

describe("classifyVoiceIntent", () => {
  it("routes constrained design language to canvas assist", () => {
    expect(
      classifyVoiceIntent("Create a 2.4 metre bluestone path along the north boundary"),
    ).toBe("design");
  });

  it("keeps operational site notes on the dictation path", () => {
    expect(classifyVoiceIntent("Sam, check the delivery before the rain")).toBe(
      "dictation",
    );
  });
});
