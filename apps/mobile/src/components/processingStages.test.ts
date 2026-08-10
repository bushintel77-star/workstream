import { describe, expect, it } from "vitest";
import { buildProcessingStages } from "./processingStages";

describe("buildProcessingStages", () => {
  const empty = {
    hasTranscript: false,
    hasSurvey: false,
    hasDesign: false,
    hasCosting: false,
    hasAudit: false,
    hasOutputs: false,
  };

  it("activates the failed stage and preserves completed stages", () => {
    const stages = buildProcessingStages({
      ...empty,
      hasTranscript: true,
      hasSurvey: true,
      status: "design_failed",
    });

    expect(stages.find((stage) => stage.key === "transcription")).toMatchObject({
      done: true,
      active: false,
      failed: false,
    });
    expect(stages.find((stage) => stage.key === "design")).toMatchObject({
      done: false,
      active: true,
      failed: true,
    });
  });

  it("marks the first incomplete stage active while processing", () => {
    const stages = buildProcessingStages({
      ...empty,
      hasTranscript: true,
      status: "processing",
    });

    expect(stages.find((stage) => stage.key === "survey")).toMatchObject({
      active: true,
      failed: false,
    });
  });

  it("marks every stage complete after the pipeline completes", () => {
    const stages = buildProcessingStages({
      hasTranscript: true,
      hasSurvey: true,
      hasDesign: true,
      hasCosting: true,
      hasAudit: true,
      hasOutputs: true,
      status: "complete",
    });

    expect(stages.every((stage) => stage.done)).toBe(true);
    expect(stages.some((stage) => stage.active || stage.failed)).toBe(false);
  });
});
