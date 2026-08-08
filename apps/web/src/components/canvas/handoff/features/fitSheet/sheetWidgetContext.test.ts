import { describe, expect, it } from "vitest";
import { buildSheetWidgetContext } from "./sheetWidgetContext";
import type { StudioItem } from "../../studioCatalog";

const item = (t: StudioItem["t"], id?: string): StudioItem => ({
  id: id ?? t,
  t,
  x: 40,
  y: 40,
  rot: 0,
  scale: 1,
  ghost: false,
});

describe("buildSheetWidgetContext", () => {
  it("summarises irrigation zones by name", () => {
    const ctx = buildSheetWidgetContext({
      items: [],
      irrigationZones: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Front drip",
          kind: "drip",
          points: [
            { x_pct: 10, y_pct: 10 },
            { x_pct: 20, y_pct: 20 },
          ],
          emitter_spacing_cm: 30,
          emitter_flow_lph: 2,
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Rear spray",
          kind: "spray",
          points: [
            { x_pct: 30, y_pct: 30 },
            { x_pct: 40, y_pct: 40 },
          ],
          emitter_spacing_cm: 30,
          emitter_flow_lph: 2,
        },
      ],
    });
    expect(ctx.zoneFace).toBe("Front drip · Rear spray");
    expect(ctx.zoneDetail).toMatch(/zones/i);
  });

  it("falls back to placement massing when no zones", () => {
    const ctx = buildSheetWidgetContext({
      items: [item("bed"), item("paving"), item("canopy")],
    });
    expect(ctx.zoneFace).toContain("Plant massing");
    expect(ctx.zoneFace).toContain("Hardscape");
    expect(ctx.materialChips.length).toBeGreaterThanOrEqual(2);
    expect(ctx.materialLabels).toMatch(/Bluestone|Plant bed|Canopy/i);
  });

  it("stays honest when the board is empty", () => {
    const ctx = buildSheetWidgetContext({ items: [] });
    expect(ctx.zoneFace).toBe("No zones drawn yet");
    expect(ctx.materialLabels).toMatch(/Place materials/i);
    expect(ctx.materialChips).toHaveLength(0);
  });

  it("ignores ghosts and existing trees for materials", () => {
    const ctx = buildSheetWidgetContext({
      items: [
        { ...item("paving", "g1"), ghost: true },
        item("exist", "e1"),
      ],
    });
    expect(ctx.materialChips).toHaveLength(0);
  });
});
