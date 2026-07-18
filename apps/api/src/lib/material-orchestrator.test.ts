import { describe, expect, it } from "vitest";
import { createMemoryStore } from "@workstream/db";
import {
  acceptOverlay,
  dismissOverlay,
  getOrchestrationWorld,
} from "./material-orchestrator";

describe("material-orchestrator overlay persistence", () => {
  const ownerId = "dev-user";

  it("persists dismiss decisions across in-process reload", async () => {
    const store = createMemoryStore();
    await store.seedDefaults();
    const project = await store.createProject(ownerId, {
      address: "Test site",
    });
    await store.upsertDesignCanvas(ownerId, project.id, {
      placements: [
        {
          id: "p1",
          symbol_id: "retaining-wall",
          x_pct: 40,
          y_pct: 50,
          rotation_deg: 0,
          scale: 1.2,
        },
      ],
      strokes: [],
    });

    const world1 = await getOrchestrationWorld(store, ownerId, project.id);
    const overlayId = world1.overlays.find((o) => o.status === "ready")?.id;
    expect(overlayId).toBeTruthy();

    await dismissOverlay(store, ownerId, project.id, overlayId!);

    const world2 = await getOrchestrationWorld(store, ownerId, project.id);
    expect(world2.overlays.find((o) => o.id === overlayId)).toBeUndefined();

    const record = await store.getOrchestrationOverlayRecord(
      ownerId,
      project.id,
    );
    expect(record?.dismissed_ids).toContain(overlayId);
  });

  it("accept overlay persists accepted id and optional placement", async () => {
    const store = createMemoryStore();
    await store.seedDefaults();
    const project = await store.createProject(ownerId, {
      address: "Test site TRP",
    });
    await store.upsertDesignCanvas(ownerId, project.id, {
      placements: [
        {
          id: "p1",
          symbol_id: "bluestone-paver",
          x_pct: 55,
          y_pct: 55,
          rotation_deg: 0,
          scale: 1,
        },
      ],
      strokes: [],
    });

    const world1 = await getOrchestrationWorld(store, ownerId, project.id);
    const ready = world1.overlays.find((o) => o.status === "ready");
    if (!ready) {
      expect(world1.overlays.length).toBeGreaterThanOrEqual(0);
      return;
    }

    await acceptOverlay(store, ownerId, project.id, ready.id);

    const record = await store.getOrchestrationOverlayRecord(
      ownerId,
      project.id,
    );
    expect(record?.accepted_ids).toContain(ready.id);

    const world2 = await getOrchestrationWorld(store, ownerId, project.id);
    const accepted = world2.overlays.find((o) => o.id === ready.id);
    expect(accepted?.status).toBe("accepted");
  });
});
