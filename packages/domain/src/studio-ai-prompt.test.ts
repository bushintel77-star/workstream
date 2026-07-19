import { describe, expect, it } from "vitest";
import { buildStudioSystemPrompt } from "./studio-ai-prompt";

describe("buildStudioSystemPrompt", () => {
  it("grounds the model with workable area and easement honesty", () => {
    const prompt = buildStudioSystemPrompt(
      { name: "Test", address: "12 Demo St, Melbourne VIC 3000" },
      4,
      {
        width_m: 12,
        height_m: 28,
        workable_m2: 186,
        easement_count: 1,
        service_count: 2,
        scale_m: 110,
      },
    );
    expect(prompt).toContain("Workable outdoor canvas");
    expect(prompt).toContain("186");
    expect(prompt).toContain("easement hatch");
    expect(prompt).toContain("service corridor");
    expect(prompt).toContain("outside easement hatch");
    expect(prompt).toContain("Curtis & Co palette");
  });
});
