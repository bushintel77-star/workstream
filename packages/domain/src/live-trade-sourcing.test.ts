import { describe, expect, it } from "vitest";
import { estimateStudioDrawing } from "./studio-preemptive-estimate";
import {
  solveLiveTradeEstimate,
  tradeTagForItem,
} from "./live-trade-sourcing";

const boundary = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
];

describe("solveLiveTradeEstimate", () => {
  it("matches paving to ANL trade and includes freight", () => {
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      items: [
        {
          id: "p1",
          t: "paving",
          x: 50,
          y: 50,
          scale: 1.2,
          areaKind: "rect",
          wPx: 110,
          hPx: 80,
        },
      ],
    });
    const trade = solveLiveTradeEstimate({ report });
    expect(trade.matchedLines.length).toBeGreaterThan(0);
    expect(trade.freightExGst).toBeGreaterThan(0);
    expect(trade.totalInclGst).toBeGreaterThan(trade.tradeExGst);
    expect(trade.mode).toBe("live_matched");
    expect(trade.honesty).toMatch(/trade hubs/i);
  });

  it("falls back to AI estimated when forced unverified", () => {
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      items: [
        {
          id: "p1",
          t: "paving",
          x: 50,
          y: 50,
          scale: 1,
          areaKind: "rect",
          wPx: 110,
          hPx: 80,
        },
      ],
    });
    const trade = solveLiveTradeEstimate({
      report,
      forceUnverified: true,
    });
    expect(trade.mode).toBe("ai_estimated");
    expect(trade.honesty).toMatch(/Wholesale Unverified/i);
  });

  it("flags over budget", () => {
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      items: [
        {
          id: "p1",
          t: "paving",
          x: 50,
          y: 50,
          scale: 2,
          areaKind: "rect",
          wPx: 200,
          hPx: 160,
        },
      ],
    });
    const trade = solveLiveTradeEstimate({
      report,
      budgetLimitAud: 100,
    });
    expect(trade.overBudget).toBe(true);
  });

  it("resolves trade tag for selected item", () => {
    const report = estimateStudioDrawing({
      outdoorM2: 230,
      boundary,
      items: [
        {
          id: "h1",
          t: "hedge",
          x: 40,
          y: 40,
          scale: 1,
        },
      ],
    });
    const trade = solveLiveTradeEstimate({ report });
    const tag = tradeTagForItem(trade, "h1");
    expect(tag).toBeTruthy();
    expect(tag!.offer.hubLabel).toMatch(/Dinsan|Warners|Plantmark/i);
  });
});
