import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "@workstream/db";

vi.mock("./design-job", () => ({
  runDesign: vi.fn().mockRejectedValue(new Error("design stage exploded")),
}));

import { runFullPipeline } from "./pipeline-job";

describe("runFullPipeline failure states", { timeout: 20000 }, () => {
  let store: ReturnType<typeof createMemoryStore>;
  const owner = "pipeline-failure-test";

  beforeEach(async () => {
    store = createMemoryStore();
    await store.seedDefaults();
  });

  it("leaves the project at a visible *_failed status, not stuck on processing", async () => {
    const project = await store.createProject(owner, {
      address: "12 Failure Test St, Fitzroy VIC 3065",
      lat: -37.798,
      lng: 144.979,
    });

    const result = await runFullPipeline(store, owner, project.id);

    expect(result.ok).toBe(false);
    expect(
      result.events.some(
        (e) => e.status === "error" && e.stage === "design",
      ),
    ).toBe(true);

    const after = await store.getProject(owner, project.id);
    expect(after?.status).toBe("design_failed");
  });
});
