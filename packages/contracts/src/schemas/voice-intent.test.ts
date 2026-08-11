import { describe, expect, it } from "vitest";
import {
  VoiceIntentClassificationResponseSchema,
  VoiceIntentRequestSchema,
} from "./voice-intent";

describe("VoiceIntentRequestSchema", () => {
  it("requires confidence and DIL consent", () => {
    expect(
      VoiceIntentRequestSchema.safeParse({
        transcript: "Create a bluestone path",
        confidence: 0.91,
        dil_consent: true,
      }).success,
    ).toBe(true);

    expect(
      VoiceIntentRequestSchema.safeParse({
        transcript: "Create a bluestone path",
        dil_consent: true,
      }).success,
    ).toBe(false);
  });

  it("normalises transcript whitespace and defaults the source", () => {
    const result = VoiceIntentRequestSchema.safeParse({
      transcript: "  Check the gate  ",
      confidence: 0.72,
      dil_consent: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.transcript).toBe("Check the gate");
      expect(result.data.source).toBe("mobile_recording");
    }
  });

  it("rejects confidence outside the inclusive range", () => {
    expect(
      VoiceIntentRequestSchema.safeParse({
        transcript: "Check the gate",
        confidence: 1.1,
        dil_consent: true,
      }).success,
    ).toBe(false);
    expect(
      VoiceIntentRequestSchema.safeParse({
        transcript: "Check the gate",
        confidence: -0.1,
        dil_consent: true,
      }).success,
    ).toBe(false);
  });
});

describe("VoiceIntentClassificationResponseSchema", () => {
  it("validates a server-backed classification response", () => {
    const result = VoiceIntentClassificationResponseSchema.safeParse({
      kind: "design",
      transcript: "Create a bluestone path",
      confidence: 0.91,
      source: "mobile_recording",
      classifier: "anthropic",
      dil_recorded: false,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unknown classifier", () => {
    const result = VoiceIntentClassificationResponseSchema.safeParse({
      kind: "design",
      transcript: "Create a bluestone path",
      confidence: 0.91,
      source: "mobile_recording",
      classifier: "heuristic",
      dil_recorded: false,
    });

    expect(result.success).toBe(false);
  });
});
