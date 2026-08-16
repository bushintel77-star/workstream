import { describe, expect, it } from "vitest";
import type {
  StudioEstimateLine,
  StudioEstimateReport,
  TradeTelemetry,
} from "@workstream/domain";
import {
  buildEstimateArgsFromStudio,
  summarizeFitSheet,
  fmtAud,
} from "./fitSheet";
import type { RenderItem } from "./sceneItems";

/* -------------------------------------------------------------------------- */
/* buildEstimateArgsFromStudio                                                */
/* -------------------------------------------------------------------------- */

const ITEM = (t: RenderItem["t"], id: string): RenderItem => ({
  id,
  t,
  x: 50,
  y: 50,
  rot: 0,
  scale: 1,
  ghost: false,
});

describe("buildEstimateArgsFromStudio", () => {
  it("maps RenderItems to compliance items with BY_TYPE meta", () => {
    const args = buildEstimateArgsFromStudio({
      items: [ITEM("canopy", "a"), ITEM("paving", "b")],
      boundaryPct: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
      constructionTrenches: [],
      irrigationZones: [],
      scaleM: 100,
      outdoorM2: 250,
    });
    expect(args.items).toEqual([
      { id: "a", t: "canopy", x: 50, y: 50, scale: 1, ghost: false },
      { id: "b", t: "paving", x: 50, y: 50, scale: 1, ghost: false },
    ]);
    expect(args.metaByType!.canopy!.rate).toBeGreaterThan(0);
    expect(args.metaByType!.paving!.areaKind).toBe("rect");
    expect(args.outdoorM2).toBe(250);
    expect(args.accessConstrained).toBe(false); // 250 ≤ 400
  });

  it("flags access-constrained sites over 400 m²", () => {
    const args = buildEstimateArgsFromStudio({
      items: [],
      boundaryPct: [],
      constructionTrenches: [],
      irrigationZones: [],
      scaleM: 100,
      outdoorM2: 500,
    });
    expect(args.accessConstrained).toBe(true);
  });

  it("excludes bollards (no engine type) and filters ghost trenches", () => {
    const args = buildEstimateArgsFromStudio({
      items: [ITEM("bollard", "b1"), ITEM("hedge", "h1")],
      boundaryPct: [],
      constructionTrenches: [
        {
          id: "t1",
          kind: "drainage",
          name: "Drain",
          source: "traced",
          depth_mm: 400,
          points: [
            { x_pct: 0, y_pct: 0 },
            { x_pct: 10, y_pct: 10 },
          ],
          ghost: true,
        },
        {
          id: "t2",
          kind: "irrig_main",
          name: "Main",
          source: "auto",
          depth_mm: 300,
          points: [
            { x_pct: 0, y_pct: 0 },
            { x_pct: 20, y_pct: 20 },
          ],
        },
      ],
      irrigationZones: [],
      scaleM: 100,
      outdoorM2: 100,
    });
    expect(args.items.map((i) => i.id)).toEqual(["h1"]);
    expect(args.constructionTrenches!.map((t) => t.id)).toEqual(["t2"]);
  });
});

/* -------------------------------------------------------------------------- */
/* summarizeFitSheet                                                          */
/* -------------------------------------------------------------------------- */

function line(
  id: string,
  label: string,
  total: number,
  tier: StudioEstimateLine["tier"] = "primary",
): StudioEstimateLine {
  return { id, tier, label, unit: "ea", qty: 1, rate: total, total, sourceIds: [] };
}

function report(lines: StudioEstimateLine[]): StudioEstimateReport {
  return {
    lines,
    materialsExGst: lines.reduce((s, l) => s + l.total, 0),
    gst: 10,
    totalInclGst: lines.reduce((s, l) => s + l.total, 0) + 10,
    hardscapeM2: 42.5,
    excavateM3: 8.2,
    spoilTonnes: 13.1,
    tipperLoads: 2,
    horizon: [],
    compliance: {
      outdoorM2: 0,
      permeablePct: 0,
      canopyPct: 0,
      permeableOk: true,
      canopyOk: true,
      outdoorOk: true,
      pass: true,
      canvasSignal: "ok",
      alerts: [],
      setbackM: 0,
      permeableMinPct: 0,
      canopyTargetPct: 0,
    },
  };
}

describe("summarizeFitSheet", () => {
  it("returns null for an empty estimate", () => {
    expect(summarizeFitSheet(report([]), null)).toBeNull();
  });

  it("groups lines into quote sections in canonical order", () => {
    const s = summarizeFitSheet(
      report([
        line("1", "Canopy tree supply", 650),
        line("2", "Bluestone paving base", 320),
        line("3", "Ag pipe drainage run", 180),
        line("4", "Site labour", 400, "labour"),
      ]),
      null,
    )!;
    expect(s.sections.map((x) => x.id)).toEqual([
      "sitework",
      "hardscape",
      "planting",
      "drainage",
    ]);
    expect(s.sections[0]!.lines[0]!.label).toBe("Site labour");
    expect(s.sections[1]!.subtotal).toBe(320);
  });

  it("carries the report totals and stats verbatim", () => {
    const r = report([line("1", "Hedge", 100)]);
    const s = summarizeFitSheet(r, null)!;
    expect(s.subtotal).toBe(r.materialsExGst);
    expect(s.gst).toBe(r.gst);
    expect(s.total).toBe(r.totalInclGst);
    expect(s.stats).toEqual({
      hardscapeM2: 42.5,
      excavateM3: 8.2,
      spoilTonnes: 13.1,
      tipperLoads: 2,
    });
  });

  it("top lines are the six largest by total", () => {
    const lines = Array.from({ length: 8 }, (_, i) =>
      line(String(i), `Item ${i}`, (i + 1) * 10),
    );
    const s = summarizeFitSheet(report(lines), null)!;
    expect(s.topLines).toHaveLength(6);
    expect(s.topLines[0]!.line.total).toBe(80);
    expect(s.topLines[5]!.line.total).toBe(30);
  });

  it("joins stock offers and raises the procurement alert only for live-matched out-of-stock", () => {
    const telemetry = {
      mode: "live_matched",
      matchedLines: [
        {
          estimateLineId: "1",
          sourceIds: [],
          studioHint: "hedge",
          qty: 10,
          unit: "ea",
          offer: {
            hubId: "warners",
            hubLabel: "Warners Nurseries",
            sku: "X",
            label: "Syzygium australe",
            botanicalOrSpec: "Syzygium",
            container: "45L",
            unit: "ea",
            wholesaleExGst: 185,
            inStock: false,
            hubKmFromPrahran: 28,
            studioTypes: ["hedge"],
          },
          tierMultiplier: 1,
          lineExGst: 1850,
          mode: "live_matched",
          alternatives: [],
        },
        {
          estimateLineId: "2",
          sourceIds: [],
          studioHint: "canopy",
          qty: 1,
          unit: "ea",
          offer: {
            hubId: "plantmark_wantirna",
            hubLabel: "Plantmark · Wantirna",
            sku: "Y",
            label: "Pleached hornbeam",
            botanicalOrSpec: "Carpinus",
            container: "100L",
            unit: "ea",
            wholesaleExGst: 465,
            inStock: true,
            hubKmFromPrahran: 32,
            studioTypes: ["hedge", "canopy"],
          },
          tierMultiplier: 1,
          lineExGst: 465,
          mode: "live_matched",
          alternatives: [],
        },
      ],
      materialsTradeExGst: 2315,
      freightExGst: 100,
      tradeExGst: 2415,
      gst: 241.5,
      totalInclGst: 2656.5,
      matchRatio: 1,
      budgetLimitAud: null,
      overBudget: false,
      honesty: "cached hub catalog",
    } as unknown as TradeTelemetry;

    const s = summarizeFitSheet(report([line("1", "Hedge", 1850)]), telemetry)!;
    expect(s.stockLines).toHaveLength(2);
    expect(s.lowStockCount).toBe(1);
    expect(s.procurementAlert).toContain("Syzygium australe");
    expect(s.procurementAlert).toContain("48h");
  });

  it("no alert when everything is in stock", () => {
    const s = summarizeFitSheet(report([line("1", "Hedge", 100)]), {
      mode: "ai_estimated",
      matchedLines: [],
      materialsTradeExGst: 0,
      freightExGst: 0,
      tradeExGst: 0,
      gst: 0,
      totalInclGst: 0,
      matchRatio: 0,
      budgetLimitAud: null,
      overBudget: false,
      honesty: "",
    } as TradeTelemetry)!;
    expect(s.procurementAlert).toBeNull();
    expect(s.lowStockCount).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* fmtAud                                                                     */
/* -------------------------------------------------------------------------- */

describe("fmtAud", () => {
  it("formats with thousands separators and 2dp", () => {
    expect(fmtAud(58410.35)).toBe("$58,410.35");
    expect(fmtAud(0)).toBe("$0.00");
    expect(fmtAud(999.999)).toBe("$1,000.00");
  });
});
