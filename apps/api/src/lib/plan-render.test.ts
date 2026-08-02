import { describe, expect, it } from "vitest";
import type { DesignCanvas } from "@workstream/contracts";
import { renderPlanSvg, renderSvgToPng } from "./plan-render";

function makeCanvas(overrides: Partial<DesignCanvas> = {}): DesignCanvas {
  return {
    project_id: "test",
    owner_id: "test",
    revision: 1,
    updated_at: new Date().toISOString(),
    placements: [],
    strokes: [],
    site_frame: undefined,
    ...overrides,
  } as DesignCanvas;
}

describe("renderPlanSvg", () => {
  it("renders an empty canvas with a parchment background", () => {
    const svg = renderPlanSvg(makeCanvas());
    expect(svg).toContain("<svg");
    expect(svg).toContain('fill="#f5f0e6"');
    expect(svg).toContain("</svg>");
  });

  it("renders a boundary polygon when site_frame has 3+ points", () => {
    const svg = renderPlanSvg(
      makeCanvas({
        site_frame: {
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
          drainage_runs: [],
          byda_assets: [],
          keyless_overlays: [],
          neighbour_buildings: [],
        } as DesignCanvas["site_frame"],
      }),
    );
    expect(svg).toContain("<polygon");
    expect(svg).toContain("#3d6b4f");
  });

  it("renders a building polygon when site_frame has building points", () => {
    const svg = renderPlanSvg(
      makeCanvas({
        site_frame: {
          boundary: [],
          building: [
            { x_pct: 30, y_pct: 30 },
            { x_pct: 60, y_pct: 30 },
            { x_pct: 60, y_pct: 60 },
          ],
          easements: [],
          services: [],
          levels: [],
          drainage_runs: [],
          byda_assets: [],
          keyless_overlays: [],
          neighbour_buildings: [],
        } as DesignCanvas["site_frame"],
      }),
    );
    expect(svg).toContain("#2a1e18");
  });

  it("renders placements as circles", () => {
    const svg = renderPlanSvg(
      makeCanvas({
        placements: [
          {
            id: "p1",
            symbol_id: "canopy",
            x_pct: 50,
            y_pct: 50,
            rotation_deg: 0,
            scale: 1,
          },
        ],
      }),
    );
    expect(svg).toContain("<circle");
  });

  it("renders strokes as polylines", () => {
    const svg = renderPlanSvg(
      makeCanvas({
        strokes: [
          {
            id: "s1",
            points: [
              { x_pct: 10, y_pct: 10 },
              { x_pct: 50, y_pct: 50 },
            ],
            color: "#ff2ef6",
            width_px: 2,
          },
        ],
      }),
    );
    expect(svg).toContain("<polyline");
    expect(svg).toContain("#ff2ef6");
  });

  it("renders a north arrow when north_bearing is set", () => {
    const svg = renderPlanSvg(
      makeCanvas({
        site_frame: {
          boundary: [],
          building: [],
          easements: [],
          services: [],
          levels: [],
          drainage_runs: [],
          byda_assets: [],
          keyless_overlays: [],
          neighbour_buildings: [],
          north_bearing: 90,
        } as DesignCanvas["site_frame"],
      }),
    );
    expect(svg).toContain(">N<");
  });

  it("does not render a north arrow when north_bearing is absent", () => {
    const svg = renderPlanSvg(makeCanvas());
    expect(svg).not.toContain(">N<");
  });
});

describe("renderSvgToPng", () => {
  it("converts an SVG string to a PNG buffer", async () => {
    const svg = renderPlanSvg(makeCanvas());
    const png = await renderSvgToPng(svg);
    expect(png).toBeInstanceOf(Buffer);
    // PNG magic bytes: 89 50 4E 47
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
  });
});
