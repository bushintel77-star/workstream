import { describe, expect, it } from "vitest";
import type { StudioItem, StudioItemType } from "../../studioCatalog";
import {
  elevationBars,
  elevationBuildingBox,
  elevationCeilingM,
  elevationParcelWidthM,
  elevationSpan,
  type ElevationPlot,
} from "./elevationBars";

function item(over: Partial<StudioItem> & { t: StudioItemType }): StudioItem {
  return {
    id: "i1",
    x: 50,
    y: 50,
    rot: 0,
    scale: 1,
    ghost: false,
    ...over,
  };
}

/** A square parcel filling the plan — span 100 along either axis. */
const boundary = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

/** The elevation board's plot: 78 units wide, ground at 36, 30 units tall. */
const boardPlot: ElevationPlot = { x0: 10, w: 78, groundY: 36, h: 30 };
const fallbackWidth = { ghost: 1.6, wide: 3.2, narrow: 2.2 };

const opts = {
  look: "N" as const,
  boundary,
  scaleM: 100,
  plot: boardPlot,
  ceilingM: 10,
  fallbackWidth,
};

describe("elevationSpan", () => {
  it("samples x looking north and y looking east", () => {
    expect(elevationSpan(boundary, "N").proj.axis).toBe("x");
    expect(elevationSpan(boundary, "E").proj.axis).toBe("y");
  });

  it("mirrors the reverse looks so left→right is the looker's left", () => {
    const wide = [
      { x: 20, y: 0 },
      { x: 60, y: 100 },
    ];
    expect(elevationSpan(wide, "N")).toMatchObject({ minC: 20, span: 40 });
    // Looking south, x=60 becomes 40 and x=20 becomes 80.
    expect(elevationSpan(wide, "S")).toMatchObject({ minC: 40, span: 40 });
  });

  it("never divides by a zero span", () => {
    expect(elevationSpan([], "N").span).toBe(100);
    expect(elevationSpan([{ x: 5, y: 5 }], "N").span).toBe(1);
  });
});

describe("elevationCeilingM", () => {
  it("clears the dwelling eave when the garden is low", () => {
    const ceiling = elevationCeilingM([item({ t: "hedge" })]);
    // 5 m eave with headroom — never 1.2 m of hedge.
    expect(ceiling).toBeGreaterThan(5);
    expect(ceiling).toBeCloseTo(6, 6);
  });

  it("rises above the tallest placement", () => {
    const ceiling = elevationCeilingM([
      item({ t: "canopy", symbolId: "curtis-tree-780" }),
    ]);
    expect(ceiling).toBeGreaterThan(7.8);
  });

  it("ignores placements with no vertical presence", () => {
    expect(elevationCeilingM([item({ t: "lawn" }), item({ t: "paving" })])).toBe(
      elevationCeilingM([]),
    );
  });

  it("caps so one freak tree cannot squash the garden", () => {
    expect(elevationCeilingM([item({ t: "exist", scale: 4 })])).toBe(14);
  });
});

describe("elevationBars", () => {
  it("draws only placements with vertical presence", () => {
    const bars = elevationBars(
      [
        item({ id: "tree", t: "canopy" }),
        item({ id: "turf", t: "lawn" }),
        item({ id: "pav", t: "paving" }),
      ],
      opts,
    );
    expect(bars.map((b) => b.item.id)).toEqual(["tree"]);
  });

  it("takes height from the placed symbol, not the coarse type", () => {
    const [bar] = elevationBars(
      [item({ t: "canopy", symbolId: "curtis-tree-780" })],
      { ...opts, ceilingM: 10 },
    );
    // BY_TYPE.canopy is 6 m — the symbol's 7.8 m must win.
    expect(bar!.heightM).toBeCloseTo(7.8, 6);
    expect(bar!.box.h).toBeCloseTo((7.8 / 10) * 30, 6);
  });

  it("applies placement scale to the height", () => {
    const [bar] = elevationBars([item({ t: "canopy", scale: 0.5 })], opts);
    expect(bar!.heightM).toBeCloseTo(3, 6);
  });

  it("stands every bar on the ground line and inside the plot", () => {
    const bars = elevationBars(
      [
        item({ id: "a", t: "canopy" }),
        item({ id: "b", t: "hedge", x: 10 }),
        item({ id: "c", t: "deck", x: 90 }),
        item({ id: "d", t: "exist", scale: 3 }),
      ],
      opts,
    );
    for (const bar of bars) {
      expect(bar.box.y + bar.box.h).toBeCloseTo(boardPlot.groundY, 6);
      expect(bar.box.y).toBeGreaterThanOrEqual(
        boardPlot.groundY - boardPlot.h - 1e-9,
      );
      expect(bar.box.h).toBeGreaterThan(0);
      expect(bar.box.w).toBeGreaterThan(0);
    }
  });

  it("sizes the bar from catalogued spread — a canopy is wider than a stem", () => {
    // 100 m across 78 units: a 6 m canopy is 4.68 units.
    const [canopy] = elevationBars([item({ t: "canopy" })], opts);
    expect(canopy!.box.w).toBeCloseTo((6 / 100) * 78, 6);
    const [existing] = elevationBars([item({ t: "exist" })], opts);
    expect(existing!.box.w).toBeCloseTo((7 / 100) * 78, 6);
    expect(existing!.box.w).toBeGreaterThan(canopy!.box.w);
  });

  it("falls back to indicative widths when nothing knows the spread", () => {
    // BY_TYPE.hedge / deck carry no canopyM, so the family fallback applies.
    const [hedge] = elevationBars([item({ t: "hedge" })], opts);
    expect(hedge!.box.w).toBe(fallbackWidth.wide);
    const [ghost] = elevationBars([item({ t: "hedge", ghost: true })], opts);
    expect(ghost!.box.w).toBe(fallbackWidth.ghost);
  });

  it("clamps so a huge spread cannot flood the board", () => {
    const [bar] = elevationBars([item({ t: "exist", scale: 20 })], opts);
    expect(bar!.box.w).toBeCloseTo(78 * 0.4, 6);
  });

  it("centres the bar on the projected plan position", () => {
    const [bar] = elevationBars([item({ t: "canopy", x: 25 })], opts);
    // 25% along a full-width parcel → 10 + 0.25 * 78.
    expect(bar!.box.x + bar!.box.w / 2).toBeCloseTo(10 + 0.25 * 78, 6);
  });

  it("names the callout from the placed symbol", () => {
    const [named] = elevationBars(
      [item({ t: "hedge", symbolId: "hornbeam-pleached" })],
      opts,
    );
    expect(named!.tag).toBe("Pleached hornbeam");
    expect(named!.family).toBe("screen");
    const [plain] = elevationBars([item({ t: "hedge" })], opts);
    expect(plain!.tag).toBe("Hedge");
    expect(plain!.family).toBe("hedge");
  });

  it("never marks a ghost as selected", () => {
    const [ghost] = elevationBars([item({ id: "g", t: "canopy", ghost: true })], {
      ...opts,
      selectedId: "g",
    });
    expect(ghost!.selected).toBe(false);
  });

  it("mirrors the board and the sheet — same height share of each plot", () => {
    const placement = item({ t: "canopy", symbolId: "curtis-tree-780" });
    const ceilingM = elevationCeilingM([placement]);
    const sheetPlot: ElevationPlot = { x0: 2, w: 96, groundY: 30, h: 30 };
    const [onBoard] = elevationBars([placement], { ...opts, ceilingM });
    const [onSheet] = elevationBars([placement], {
      ...opts,
      ceilingM,
      plot: sheetPlot,
    });
    expect(onBoard!.heightM).toBe(onSheet!.heightM);
    expect(onBoard!.box.h / boardPlot.h).toBeCloseTo(
      onSheet!.box.h / sheetPlot.h,
      6,
    );
  });
});

describe("elevationBuildingBox", () => {
  const building = [
    { x: 30, y: 20 },
    { x: 70, y: 20 },
    { x: 70, y: 60 },
    { x: 30, y: 60 },
  ];

  it("stands the dwelling on the datum at eave height", () => {
    const box = elevationBuildingBox(building, {
      look: "N",
      boundary,
      plot: boardPlot,
      ceilingM: 10,
    });
    expect(box.y + box.h).toBeCloseTo(boardPlot.groundY, 6);
    // 5 m eave on a 10 m datum is exactly half the plot.
    expect(box.h).toBeCloseTo(15, 6);
    expect(box.x).toBeCloseTo(10 + 0.3 * 78, 6);
    expect(box.w).toBeCloseTo(0.4 * 78, 6);
  });

  it("is overtopped by a taller tree on the same datum", () => {
    const tree = item({ t: "canopy", symbolId: "curtis-tree-780" });
    const ceilingM = elevationCeilingM([tree]);
    const [bar] = elevationBars([tree], { ...opts, ceilingM });
    const box = elevationBuildingBox(building, {
      look: "N",
      boundary,
      plot: boardPlot,
      ceilingM,
    });
    expect(bar!.box.y).toBeLessThan(box.y);
  });

  it("keeps an indicative mass when the dwelling is untraced", () => {
    const box = elevationBuildingBox([], {
      look: "N",
      boundary,
      plot: boardPlot,
      ceilingM: 10,
    });
    expect(box.w).toBeGreaterThan(0);
    expect(box.h).toBeCloseTo(15, 6);
  });
});

describe("elevationParcelWidthM", () => {
  it("scales the along-axis span onto board metres", () => {
    expect(elevationParcelWidthM(50, 110)).toBeCloseTo(55, 6);
  });
});
