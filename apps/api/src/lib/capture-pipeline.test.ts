import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMemoryStore } from "@workstream/db";
import { runCapturePipeline } from "./capture-pipeline";

vi.mock("./transcription-job", () => ({
  runTranscription: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./survey-job", () => ({
  runSurvey: vi.fn().mockResolvedValue({
    id: "s1",
    title_polygon: { type: "Polygon", coordinates: [[]] },
    house_polygon: { type: "Polygon", coordinates: [] },
    garden_polygon: { type: "Polygon", coordinates: [] },
    lot_area_m2: 450,
    house_area_m2: 120,
    garden_area_m2: 330,
    measurements: [],
    aerial_uri: "https://example.com/aerial.jpg",
  }),
}));

vi.mock("./design-job", () => ({
  runDesign: vi.fn().mockResolvedValue({
    id: "d1",
    project_id: "p1",
    version: 1,
    mode: "auto",
    proposal: {
      zones: [
        {
          id: "z1",
          name: "Front garden",
          treatment: "mixed",
          plantings: [{ species: "test", common_name: "Test", count: 1, form: "shrub", sku: "PLT-TEST-001" }],
          hardscape: [],
          lighting: [],
          irrigation: [],
        },
      ],
      estimated_complexity: "standard",
    },
    gaps: [],
    rationale: "rationale",
  }),
}));

vi.mock("./cost-job", () => ({
  runCosting: vi.fn().mockResolvedValue([
    { scenario: "lean", line_items: [], subtotal: 0, gst: 0, total: 0 },
    { scenario: "standard", line_items: [{ sku: "PLT-TEST-001", label: "Test", unit: "ea", qty: 1, rate: 100, total: 100 }], subtotal: 100, gst: 10, total: 110 },
    { scenario: "buffer", line_items: [], subtotal: 0, gst: 0, total: 0 },
  ]),
}));

vi.mock("./audit-job", () => ({
  runProjectAudit: vi.fn().mockResolvedValue({
    id: "a1",
    design_id: "d1",
    findings: [],
    blocking_count: 0,
    advisory_count: 0,
    passed: true,
  }),
}));

vi.mock("./output-job", () => ({
  runOutput: vi.fn().mockResolvedValue({
    id: "o1",
    project_id: "p1",
    kind: "quote",
    uri: "https://example.com/outputs/o1.html",
    generated_at: new Date().toISOString(),
  }),
}));

describe("runCapturePipeline", () => {
  const owner = "owner-capture-test";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs all stages and sets complete", async () => {
    const store = createMemoryStore();
    await store.seedDefaults();
    const project = await store.createProject(owner, {
      address: "36 Wrights Terrace, Prahran VIC 3181",
      lat: -37.85,
      lng: 145.0,
    });
    const recording = await store.createRecording(owner, project.id, "https://example.com/audio.m4a", 120);
    if (!recording) throw new Error("recording missing");
    await store.updateRecordingTranscript(recording.id, "fake transcript for testing", 0.95);

    const logs = await runCapturePipeline(
      store,
      owner,
      project.id,
      recording.id,
      "/tmp/fake.m4a",
      "https://example.com",
    );

    const updated = await store.getProject(owner, project.id);
    expect(updated?.status).toBe("complete");
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every((l) => l.passed)).toBe(true);
  });

  it("fails fast with stage log on guard failure", async () => {
    const { runTranscription } = await import("./transcription-job.js");
    vi.mocked(runTranscription).mockImplementationOnce(async (_store, _recordingId) => {
      const store = await import("@workstream/db").then((m) => m.createMemoryStore());
      await store.seedDefaults();
      // Cannot update transcript without owner; rely on default recording having no transcript
      return undefined;
    });

    const store = createMemoryStore();
    await store.seedDefaults();
    const project = await store.createProject(owner, {
      address: "12 Test St, Melbourne VIC 3000",
    });
    const recording = await store.createRecording(owner, project.id, "", 60);
    if (!recording) throw new Error("recording missing");

    const logs = await runCapturePipeline(
      store,
      owner,
      project.id,
      recording.id,
      "/tmp/fake.m4a",
      "https://example.com",
    );

    const updated = await store.getProject(owner, project.id);
    expect(updated?.status).toBe("transcription_failed");
    expect(logs[0]?.passed).toBe(false);
  });
});
