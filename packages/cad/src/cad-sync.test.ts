import { describe, expect, it } from "vitest";
import type { CadDocument } from "@workstream/contracts";
import { DEFAULT_CAD_LAYERS } from "./defaults";
import { buildCadSyncManifest, collectCadSyncAssets } from "./cad-sync";

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
    blocks: [
      {
        name: "pleached-hornbeam",
        symbol_id: "pleached-hornbeam",
        entities: [],
      },
    ],
    ai_run_id: null,
    source_sketch_id: null,
    updated_at: "2026-07-28T12:00:00.000Z",
  };
}

describe("buildCadSyncManifest", () => {
  it("publishes stable symbol ids and working-plan honesty", () => {
    const manifest = buildCadSyncManifest(
      docWith([
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          kind: "insert",
          layer: "PLANTING",
          ghost: false,
          verification_state: "VERIFIED",
          block_name: "pleached-hornbeam",
          position: { x: 12, y: 8 },
          scale: 1,
          rotation_deg: 0,
        },
        {
          id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
          kind: "polyline",
          layer: "STRUCTURES",
          ghost: false,
          verification_state: "VERIFIED",
          closed: true,
          points: [
            { x: 1, y: 1 },
            { x: 39, y: 1 },
            { x: 39, y: 29 },
            { x: 1, y: 29 },
          ],
        },
      ]),
    );
    expect(manifest.version).toBe("cad-sync/1");
    expect(manifest.honesty).toBe("working_plan");
    expect(manifest.gltf_path).toContain("/cad.gltf");
    expect(manifest.assets).toHaveLength(2);
    const plant = manifest.assets.find((a) => a.kind === "insert");
    expect(plant?.symbol_id).toBe("pleached-hornbeam");
    expect(plant?.proxy).toBe("cylinder");
    const wall = manifest.assets.find((a) => a.kind === "polyline");
    expect(wall?.proxy).toBe("wall");
  });

  it("omits ghosts from the sync asset list", () => {
    const assets = collectCadSyncAssets(
      docWith([
        {
          id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
          kind: "circle",
          layer: "PLANTING",
          ghost: true,
          verification_state: "UNVERIFIED",
          center: { x: 5, y: 5 },
          radius: 1,
        },
      ]),
    );
    expect(assets).toHaveLength(0);
  });
});
