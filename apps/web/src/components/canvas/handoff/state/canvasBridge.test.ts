import { describe, expect, it } from "vitest";
import {
  canvasToStrokes,
  itemsToPlacements,
  placementsToItems,
  strokesToCanvas,
  TYPE_TO_SYMBOL,
  withContractIds,
} from "./canvasBridge";
import type { StudioItem } from "../studioCatalog";

describe("canvasBridge", () => {
  it("maps accepted items to catalog placements and back", () => {
    const id = crypto.randomUUID();
    const items: StudioItem[] = [
      {
        id,
        t: "paving",
        x: 40,
        y: 55,
        rot: 15,
        scale: 1.2,
        ghost: false,
      },
      {
        id: crypto.randomUUID(),
        t: "canopy",
        x: 20,
        y: 30,
        rot: 0,
        scale: 1,
        ghost: true,
      },
    ];
    const placements = itemsToPlacements(items);
    expect(placements).toHaveLength(1);
    expect(placements[0]!.symbol_id).toBe(TYPE_TO_SYMBOL.paving);
    expect(placements[0]!.x_pct).toBe(40);
    const roundTrip = placementsToItems(placements);
    expect(roundTrip[0]!.t).toBe("paving");
    expect(roundTrip[0]!.ghost).toBe(false);
  });

  it("remaps non-uuid ids for contracts", () => {
    const { items, remapped } = withContractIds({
      items: [
        {
          id: "p1",
          t: "lawn",
          x: 10,
          y: 10,
          rot: 0,
          scale: 1,
          ghost: false,
        },
      ],
      strokes: [{ id: "s1", points: [{ x: 1, y: 2 }] }],
    });
    expect(remapped).toBe(true);
    expect(items[0]!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("round-trips strokes", () => {
    const id = crypto.randomUUID();
    const strokes = [{ id, points: [{ x: 12, y: 34 }, { x: 56, y: 78 }] }];
    const canvas = strokesToCanvas(strokes);
    expect(canvas[0]!.points[0]).toEqual({ x_pct: 12, y_pct: 34 });
    expect(canvasToStrokes(canvas)[0]!.points[1]).toEqual({ x: 56, y: 78 });
  });
});
