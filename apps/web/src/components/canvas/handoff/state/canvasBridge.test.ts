import { describe, expect, it } from "vitest";
import {
  canvasToStrokes,
  featuresOntoItems,
  itemsToFeatures,
  mergeCanvasFeatures,
  orphanLandscapeFeatures,
  itemsToPlacements,
  placementsToItems,
  resolveHydratedBuilding,
  siteFrameToSnapshot,
  snapshotToSiteFrame,
  strokesToCanvas,
} from "./canvasBridge";
import type { StudioItem } from "../studioCatalog";

describe("site_frame bridge", () => {
  it("round-trips boundary / building / levels", () => {
    const frame = snapshotToSiteFrame({
      boundary: [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
        { x: 10, y: 90 },
      ],
      building: [
        { x: 30, y: 30 },
        { x: 60, y: 30 },
        { x: 60, y: 55 },
        { x: 30, y: 55 },
      ],
      easements: [
        [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 100 },
          { x: 0, y: 100 },
        ],
      ],
      services: [],
      levels: [{ x: 40, y: 40, z: 12.5 }],
      boardWidthM: 35.7,
    });
    expect(frame.boundary[0]).toEqual({ x_pct: 10, y_pct: 10 });
    expect(frame.levels[0]).toEqual({ x_pct: 40, y_pct: 40, z_m: 12.5, source: "authored" });
    expect(frame.board_width_m).toBeCloseTo(35.7, 6);

    const snap = siteFrameToSnapshot(frame);
    expect(snap.boundary).toHaveLength(4);
    expect(snap.building).toHaveLength(4);
    expect(snap.easements).toHaveLength(1);
    expect(snap.levels?.[0]).toEqual({ x: 40, y: 40, z: 12.5 });
    expect(snap.boardWidthM).toBeCloseTo(35.7, 6);
  });

  it("omits the board scale when unset or invalid", () => {
    const frame = snapshotToSiteFrame({
      boundary: [],
      building: [],
      easements: [],
      services: [],
      levels: [],
      boardWidthM: null,
    });
    expect(frame.board_width_m).toBeUndefined();
    expect(siteFrameToSnapshot(frame).boardWidthM).toBeUndefined();
  });

  it("ignores empty frames on hydrate", () => {
    expect(siteFrameToSnapshot(undefined)).toEqual({});
    expect(
      siteFrameToSnapshot({
        boundary: [],
        building: [],
        easements: [],
        services: [],
        levels: [],
        byda_assets: [],
        keyless_overlays: [],
      }),
    ).toEqual({});
  });

  it("does not leak a seed footprint into a real frame without a building", () => {
    const frame = {
      boundary: [
        { x_pct: 10, y_pct: 10 },
        { x_pct: 90, y_pct: 10 },
        { x_pct: 90, y_pct: 90 },
        { x_pct: 10, y_pct: 90 },
      ],
      building: [],
      easements: [],
      services: [],
      levels: [],
      byda_assets: [],
      keyless_overlays: [],
    };
    const seedBuilding = [
      { x: 30, y: 30 },
      { x: 60, y: 30 },
      { x: 60, y: 55 },
      { x: 30, y: 55 },
    ];
    const hydrated = siteFrameToSnapshot(frame);

    expect(
      resolveHydratedBuilding(frame, hydrated.building, seedBuilding),
    ).toEqual([]);
    expect(resolveHydratedBuilding(undefined, undefined, seedBuilding)).toBe(
      seedBuilding,
    );
    // Live projects never boot with the demo dwelling.
    expect(
      resolveHydratedBuilding(undefined, undefined, seedBuilding, {
        liveProject: true,
      }),
    ).toEqual([]);
  });

  it("persists building_source on site_frame", () => {
    const frame = snapshotToSiteFrame({
      boundary: [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
        { x: 10, y: 90 },
      ],
      building: [
        { x: 30, y: 30 },
        { x: 60, y: 30 },
        { x: 60, y: 55 },
        { x: 30, y: 55 },
      ],
      easements: [],
      services: [],
      levels: [],
      buildingSource: "vicmap",
    });
    expect(frame.building_source).toBe("vicmap");
    expect(siteFrameToSnapshot(frame).buildingSource).toBe("vicmap");
  });

  it("clamps keyless overlay rings into 0–100 board %", () => {
    const frame = snapshotToSiteFrame({
      boundary: [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
        { x: 10, y: 90 },
      ],
      building: [],
      easements: [],
      services: [],
      levels: [],
      keylessOverlays: [
        {
          kind: "flood",
          rings: [
            [
              { x_pct: -12, y_pct: -4 },
              { x_pct: 110, y_pct: 50 },
              { x_pct: 40, y_pct: 140 },
            ],
          ],
        },
      ],
    });
    expect(frame.keyless_overlays?.[0]?.rings[0]).toEqual([
      { x_pct: 0, y_pct: 0 },
      { x_pct: 100, y_pct: 50 },
      { x_pct: 40, y_pct: 100 },
    ]);
  });

  it("round-trips authored DBH on existing trees", () => {
    const items: StudioItem[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        t: "exist",
        x: 40,
        y: 50,
        rot: 0,
        scale: 1,
        ghost: false,
        dbhM: 0.62,
      },
    ];
    const placements = itemsToPlacements(items);
    expect(placements[0]!.label).toBe("exist:dbh=0.62");
    const back = placementsToItems(placements);
    expect(back[0]!.dbhM).toBeCloseTo(0.62, 5);
  });

  /*
   * Provenance survives acceptance — a Vicmap urban tree and a vision-detected
   * canopy keep their `source` after a reload so the plan, elevation, fit sheet
   * and client share still distinguish them. Before Part 2 the source lived
   * only in the ghost id prefix (`ai-canopy-7`), which is stripped on accept.
   */
  it("round-trips tree source (vicmap_tree / canopy) through placements", () => {
    const items: StudioItem[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        t: "exist",
        x: 40,
        y: 50,
        rot: 0,
        scale: 1,
        ghost: false,
        source: "vicmap_tree",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        t: "exist",
        x: 60,
        y: 50,
        rot: 0,
        scale: 1,
        ghost: false,
        source: "canopy",
      },
    ];
    const placements = itemsToPlacements(items);
    expect(placements[0]!.source).toBe("vicmap_tree");
    expect(placements[1]!.source).toBe("canopy");

    const back = placementsToItems(placements);
    expect(back[0]!.source).toBe("vicmap_tree");
    expect(back[1]!.source).toBe("canopy");
  });

  it("never persists ghost items (silent-write guard)", () => {
    const placements = itemsToPlacements([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        t: "canopy",
        x: 40,
        y: 40,
        rot: 0,
        scale: 1,
        ghost: true,
        why: "AI proposal",
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        t: "deck",
        x: 50,
        y: 50,
        rot: 0,
        scale: 1,
        ghost: false,
      },
    ]);
    expect(placements).toHaveLength(1);
    expect(placements[0]!.id).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  it("round-trips multi-stem DBH via placement label", () => {
    const placements = itemsToPlacements([
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        t: "exist",
        x: 30,
        y: 30,
        rot: 0,
        scale: 1,
        ghost: false,
        dbhM: Math.sqrt(0.3 * 0.3 + 0.25 * 0.25),
        stemDbhM: [0.3, 0.25],
      },
    ]);
    expect(placements[0]!.label).toMatch(/^exist:stems=/);
    const back = placementsToItems(placements)[0]!;
    expect(back.stemDbhM).toEqual([0.3, 0.25]);
    expect(back.dbhM).toBeCloseTo(Math.sqrt(0.3 * 0.3 + 0.25 * 0.25), 5);
  });

  it("omits source on the wire when the item has no provenance (operator)", () => {
    const placements = itemsToPlacements([
      {
        id: "33333333-3333-4333-8333-333333333333",
        t: "paving",
        x: 20,
        y: 20,
        rot: 0,
        scale: 1,
        ghost: false,
      },
    ]);
    expect(placements[0]).not.toHaveProperty("source");
    expect(placementsToItems(placements)[0]!.source).toBeUndefined();
  });

  it("re-derives mature height from the persisted symbol", () => {
    const items: StudioItem[] = [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        t: "canopy",
        x: 30,
        y: 40,
        rot: 0,
        scale: 1,
        ghost: false,
        symbolId: "curtis-tree-780",
        heightM: 7.8,
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        t: "hedge",
        x: 50,
        y: 60,
        rot: 0,
        scale: 1,
        ghost: false,
        symbolId: "curtis-hedge-140",
        heightM: 1.4,
      },
    ];
    // Height is not written to the wire — the symbol carries it.
    const placements = itemsToPlacements(items);
    expect(placements[0]!.symbol_id).toBe("curtis-tree-780");
    expect(placements[0]).not.toHaveProperty("height_m");

    const back = placementsToItems(placements);
    expect(back[0]!.heightM).toBe(7.8);
    expect(back[1]!.heightM).toBe(1.4);
    expect(back[0]!.symbolId).toBe("curtis-tree-780");
  });

  it("leaves heightM unset for symbols with no catalogued height", () => {
    const placements = itemsToPlacements([
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        t: "paving",
        x: 20,
        y: 20,
        rot: 0,
        scale: 1,
        ghost: false,
        symbolId: "bluestone-paver",
      },
    ]);
    expect(placementsToItems(placements)[0]!.heightM).toBeUndefined();
  });

  /*
   * Known limit of deriving height from the symbol (no height field on
   * CatalogPlacement): an unpaired heightM is not preserved — it is replaced by
   * the height of the type's default symbol (canopy → olive-standard → 5 m).
   * The invariant that keeps this harmless is enforced at the write sites:
   * heightM is only ever stamped alongside a symbolId, so the two travel
   * together. This test pins the boundary so the limit stays deliberate and
   * visible rather than surfacing later as a "height changed itself" bug.
   */
  it("replaces an unpaired height with the type's default symbol height", () => {
    const placements = itemsToPlacements([
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        t: "canopy",
        x: 20,
        y: 20,
        rot: 0,
        scale: 1,
        ghost: false,
        heightM: 7.8,
      },
    ]);
    expect(placements[0]!.symbol_id).toBe("olive-standard");
    expect(placementsToItems(placements)[0]!.heightM).toBe(5);
  });

  it("keeps heightM paired with symbolId on every accepted placement", () => {
    const placements = itemsToPlacements([
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        t: "canopy",
        x: 20,
        y: 20,
        rot: 0,
        scale: 1,
        ghost: false,
        symbolId: "curtis-tree-690",
        heightM: 6.9,
      },
    ]);
    const back = placementsToItems(placements);
    for (const it of back) {
      if (it.heightM != null) expect(it.symbolId).toBeTruthy();
    }
    expect(back[0]!.heightM).toBe(6.9);
  });

  it("round-trips drawn region outlines as LandscapeFeatures", () => {
    const items: StudioItem[] = [
      {
        id: "22222222-2222-4222-8222-222222222222",
        t: "bed",
        x: 50,
        y: 60,
        rot: 0,
        scale: 1,
        ghost: false,
        outlinePct: [
          { x: 40, y: 55 },
          { x: 60, y: 55 },
          { x: 58, y: 70 },
          { x: 42, y: 68 },
        ],
      },
      // Ghost with outline must not persist.
      {
        id: "33333333-3333-4333-8333-333333333333",
        t: "lawn",
        x: 20,
        y: 20,
        rot: 0,
        scale: 1,
        ghost: true,
        outlinePct: [
          { x: 10, y: 10 },
          { x: 30, y: 10 },
          { x: 20, y: 30 },
        ],
      },
      // No outline → no feature.
      {
        id: "44444444-4444-4444-8444-444444444444",
        t: "canopy",
        x: 70,
        y: 30,
        rot: 0,
        scale: 1,
        ghost: false,
      },
    ];
    const features = itemsToFeatures(items);
    expect(features).toHaveLength(1);
    const f = features[0]!;
    expect(f.id).toBe("22222222-2222-4222-8222-222222222222");
    expect(f.type).toBe("LandscapeFeature");
    expect(f.metadata.layer).toBe("softscape_beds");
    expect(f.metadata.source_attribution).toBe("human_drawn");
    expect(f.metadata.user_modification_state).toBe("accepted");
    expect(f.geometry.type).toBe("Polygon");
    expect(f.geometry.points).toHaveLength(4);
    expect(f.geometry.points[0]).toMatchObject({
      id: "v0",
      pct: { x_pct: 40, y_pct: 55 },
    });
    expect(f.material_fill?.sku).toBe("lomandra-mass");

    // Hydrate: outlines re-attach onto items by id.
    const bare = items.map(({ outlinePct: _o, ...rest }) => ({ ...rest }));
    const hydrated = featuresOntoItems(bare, features);
    expect(hydrated[0]!.outlinePct).toEqual(items[0]!.outlinePct);
    expect(hydrated[1]!.outlinePct).toBeUndefined();
    expect(hydrated[2]!.outlinePct).toBeUndefined();
  });

  it("keeps structured Instant Planner features that are not mirrored by items", () => {
    const itemFeat = itemsToFeatures([
      {
        id: "22222222-2222-4222-8222-222222222222",
        t: "bed",
        x: 50,
        y: 60,
        rot: 0,
        scale: 1,
        ghost: false,
        outlinePct: [
          { x: 40, y: 55 },
          { x: 60, y: 55 },
          { x: 60, y: 72 },
          { x: 40, y: 72 },
        ],
      },
    ])[0]!;
    const orphan: typeof itemFeat = {
      ...itemFeat,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      metadata: {
        ...itemFeat.metadata,
        friendly_name: "Ditch A",
      },
    };
    const items = [
      {
        id: "22222222-2222-4222-8222-222222222222",
        t: "bed" as const,
        x: 50,
        y: 60,
        rot: 0,
        scale: 1,
        ghost: false,
      },
    ];
    expect(orphanLandscapeFeatures([itemFeat, orphan], items)).toEqual([
      orphan,
    ]);
    expect(mergeCanvasFeatures([itemFeat], [orphan, itemFeat])).toEqual([
      itemFeat,
      orphan,
    ]);
  });

  it("maps hardscape region types to the hardscape feature layer", () => {
    const deck: StudioItem = {
      id: "55555555-5555-4555-8555-555555555555",
      t: "deck",
      x: 50,
      y: 65,
      rot: 0,
      scale: 1,
      ghost: false,
      outlinePct: [
        { x: 40, y: 55 },
        { x: 60, y: 55 },
        { x: 60, y: 72 },
      ],
    };
    const features = itemsToFeatures([deck]);
    expect(features[0]!.metadata.layer).toBe("hardscape");
    expect(features[0]!.material_fill?.sku).toBe("deck");
  });

  it("preserves sketch ink width and colour through persistence", () => {
    const canvas = strokesToCanvas([
      {
        id: "sketch-1",
        points: [{ x: 20, y: 30 }, { x: 40, y: 50 }],
        color: "#241318",
        widthPx: 3.2,
      },
    ]);
    expect(canvas[0]?.width_px).toBe(3.2);
    expect(canvas[0]?.color).toBe("#241318");
    const roundTrip = canvasToStrokes(canvas);
    expect(roundTrip[0]?.widthPx).toBe(3.2);
    expect(roundTrip[0]?.color).toBe("#241318");
  });

  it("round-trips shape-tool crisp geometry (kind/shapeTool/start/end) through persistence", () => {
    const canvas = strokesToCanvas([
      {
        id: "sketch-2",
        points: [
          { x: 10, y: 10 },
          { x: 60, y: 10 },
          { x: 60, y: 40 },
          { x: 10, y: 40 },
          { x: 10, y: 10 },
        ],
        color: "#2450c7",
        widthPx: 2.4,
        kind: "shape",
        shapeTool: "rect",
        shapeStart: { x: 10, y: 10 },
        shapeEnd: { x: 60, y: 40 },
      },
    ]);
    expect(canvas[0]?.kind).toBe("shape");
    expect(canvas[0]?.shape_tool).toBe("rect");
    expect(canvas[0]?.shape_start).toEqual({ x_pct: 10, y_pct: 10 });
    expect(canvas[0]?.shape_end).toEqual({ x_pct: 60, y_pct: 40 });

    const roundTrip = canvasToStrokes(canvas);
    expect(roundTrip[0]?.kind).toBe("shape");
    expect(roundTrip[0]?.shapeTool).toBe("rect");
    expect(roundTrip[0]?.shapeStart).toEqual({ x: 10, y: 10 });
    expect(roundTrip[0]?.shapeEnd).toEqual({ x: 60, y: 40 });
  });

  it("leaves legacy ink strokes without shape fields on the wire", () => {
    const canvas = strokesToCanvas([
      { id: "sketch-3", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] },
    ]);
    expect(canvas[0]?.kind).toBeUndefined();
    expect(canvas[0]?.shape_tool).toBeUndefined();
    expect(canvas[0]?.shape_start).toBeUndefined();
    expect(canvas[0]?.shape_end).toBeUndefined();
  });
});
