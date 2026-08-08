import { describe, expect, it } from "vitest";
import { createMemoryStore } from "./memory";

describe("presentation document issue freeze", () => {
  it("refuses content edits after issue", async () => {
    const store = createMemoryStore();
    await store.seedDefaults();
    const project = await store.createProject("owner-1", {
      address: "12 Issue Freeze St, Carlton VIC 3053",
    });
    const doc = await store.createPresentationDocument("owner-1", project.id, {
      title: "Freeze pack",
    });

    const issued = await store.updatePresentationDocument(
      "owner-1",
      project.id,
      doc.id,
      {
        status: "issued",
        estimate_snapshot: {
          totalInclGst: 12000,
          materialsExGst: 10000,
          gst: 1000,
          hardscapeM2: 40,
          excavateM3: 2,
          lines: [
            {
              id: "line-1",
              label: "Paving",
              unit: "m2",
              qty: 40,
              total: 8000,
            },
          ],
          captured_at: new Date().toISOString(),
        },
      },
    );
    expect(issued?.status).toBe("issued");
    expect(issued?.estimate_snapshot?.totalInclGst).toBe(12000);

    await expect(
      store.updatePresentationDocument("owner-1", project.id, doc.id, {
        title: "Should not stick",
      }),
    ).rejects.toMatchObject({
      message: "Deck is issued; edits are blocked",
      statusCode: 409,
    });
  });
});
