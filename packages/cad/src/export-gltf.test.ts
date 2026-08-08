import { describe, expect, it } from "vitest";
import type { CadDocument } from "@workstream/contracts";
import { DEFAULT_CAD_LAYERS } from "./defaults";
import { cadDocumentToGltf } from "./export-gltf";

function docWith(entities: CadDocument["entities"]): CadDocument {
  return {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    project_id: "22222222-2222-2222-2222-222222222222",
    version: 1,
    units: "m",
    origin: { x: 0, y: 0 },
    width_m: 40,
    height_m: 30,
    layers: DEFAULT_CAD_LAYERS.map((l) => ({ ...l })),
    entities,
    blocks: [],
    ai_run_id: null,
    source_sketch_id: null,
    updated_at: new Date().toISOString(),
  };
}

describe("cadDocumentToGltf", () => {
  it("emits glTF 2.0 JSON with working-plan honesty", () => {
    const gltf = JSON.parse(
      cadDocumentToGltf(
        docWith([
          {
            id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            kind: "polyline",
            layer: "STRUCTURES",
            ghost: false,
            verification_state: "VERIFIED",
            closed: true,
            points: [
              { x: 2, y: 2 },
              { x: 38, y: 2 },
              { x: 38, y: 28 },
              { x: 2, y: 28 },
            ],
          },
          {
            id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
            kind: "insert",
            layer: "PLANTING",
            ghost: false,
            verification_state: "VERIFIED",
            block_name: "tree",
            position: { x: 20, y: 15 },
            scale: 1,
            rotation_deg: 0,
          },
        ]),
      ),
    );
    expect(gltf.asset.version).toBe("2.0");
    expect(gltf.asset.copyright).toMatch(/Working plan metres/);
    expect(gltf.asset.extras.honesty).toBe("working_plan");
    expect(Array.isArray(gltf.asset.extras.sync_assets)).toBe(true);
    expect(gltf.asset.extras.sync_assets.length).toBeGreaterThan(0);
    expect(gltf.meshes.length).toBeGreaterThan(0);
    expect(gltf.buffers[0].uri).toMatch(/^data:application\/octet-stream;base64,/);
  });

  it("skips ghost entities", () => {
    const withGhost = cadDocumentToGltf(
      docWith([
        {
          id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
          kind: "circle",
          layer: "PLANTING",
          ghost: true,
          verification_state: "UNVERIFIED",
          center: { x: 10, y: 10 },
          radius: 2,
        },
      ]),
    );
    const without = cadDocumentToGltf(docWith([]));
    // Ghost-only doc still has ground plane — mesh count matches empty.
    expect(JSON.parse(withGhost).meshes.length).toBe(
      JSON.parse(without).meshes.length,
    );
  });
});
