import { describe, expect, it } from "vitest";
import {
  itemsToPlacements,
  placementsToItems,
  resolveHydratedBuilding,
  siteFrameToSnapshot,
  snapshotToSiteFrame,
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
    });
    expect(frame.boundary[0]).toEqual({ x_pct: 10, y_pct: 10 });
    expect(frame.levels[0]).toEqual({ x_pct: 40, y_pct: 40, z_m: 12.5 });

    const snap = siteFrameToSnapshot(frame);
    expect(snap.boundary).toHaveLength(4);
    expect(snap.building).toHaveLength(4);
    expect(snap.easements).toHaveLength(1);
    expect(snap.levels?.[0]).toEqual({ x: 40, y: 40, z: 12.5 });
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
});
