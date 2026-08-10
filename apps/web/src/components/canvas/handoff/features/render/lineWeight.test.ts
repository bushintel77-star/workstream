import { describe, expect, it } from "vitest";
import {
  LINE_WEIGHT,
  ROLE_WEIGHT,
  nearestRung,
  printWeightFor,
  weightFor,
  type DrawingRole,
  type LineWeightName,
} from "./lineWeight";

const RUNGS = Object.keys(LINE_WEIGHT) as LineWeightName[];

describe("line-weight ladder", () => {
  it("ascends monotonically", () => {
    const values = RUNGS.map((r) => LINE_WEIGHT[r]);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });

  it("steps by root-2, so it doubles every two rungs", () => {
    const values = RUNGS.map((r) => LINE_WEIGHT[r]);
    for (let i = 1; i < values.length; i += 1) {
      // Rungs are rounded to 2dp for legibility in call sites, so allow drift.
      expect(values[i]! / values[i - 1]!).toBeCloseTo(Math.SQRT2, 1);
    }
    for (let i = 2; i < values.length; i += 1) {
      expect(values[i]! / values[i - 2]!).toBeCloseTo(2, 1);
    }
  });

  it("anchors on 0.4 — the value STUDIO-STYLING-AND-UX mandates for leaders", () => {
    // docs/STUDIO-STYLING-AND-UX.md: "Leaders follow the planting line-weight
    // ladder (0.4)". If this fails, the doc and the code have diverged.
    expect(LINE_WEIGHT.thin).toBe(0.4);
    expect(weightFor("leader")).toBe(0.4);
  });
});

describe("print scaling", () => {
  it("scales every rung by the sheet denominator", () => {
    expect(printWeightFor("thin", 100)).toBe(0.4);
    expect(printWeightFor("thin", 200)).toBe(0.2);
    expect(printWeightFor("heavy", 50)).toBeCloseTo(2.24);
  });

  it("preserves hierarchy ratios and ignores invalid denominators", () => {
    expect(printWeightFor("heavy", 200) / printWeightFor("thin", 200)).toBe(
      LINE_WEIGHT.heavy / LINE_WEIGHT.thin,
    );
    expect(printWeightFor("medium", 0)).toBe(LINE_WEIGHT.medium);
  });
});

describe("role mapping", () => {
  it("covers every role", () => {
    const roles: DrawingRole[] = [
      "boundary",
      "building",
      "region",
      "canopy",
      "leader",
      "grid",
      "hatch",
      "construction",
      "dimension",
      "annotation",
      "easement",
      "emphasis",
    ];
    for (const role of roles) {
      expect(ROLE_WEIGHT[role]).toBeDefined();
      expect(weightFor(role)).toBeGreaterThan(0);
    }
  });

  it("keeps boundary firmer than canopy", () => {
    // handDrawnPen.ts states the intent directly: "Role-tuned pencil weight —
    // boundary firmer than canopy."
    expect(weightFor("boundary")).toBeGreaterThan(weightFor("canopy"));
  });

  it("orders the drawing hierarchy: boundary > building > region > dimension > grid", () => {
    expect(weightFor("boundary")).toBeGreaterThan(weightFor("building"));
    expect(weightFor("building")).toBeGreaterThan(weightFor("region"));
    expect(weightFor("region")).toBeGreaterThan(weightFor("dimension"));
    expect(weightFor("dimension")).toBeGreaterThan(weightFor("grid"));
  });

  it("reserves the heaviest rung for explicit emphasis, not the boundary", () => {
    expect(weightFor("emphasis")).toBeGreaterThan(weightFor("boundary"));
  });
});

describe("nearestRung — migration helper", () => {
  it("returns the exact rung for a value already on the ladder", () => {
    for (const rung of RUNGS) {
      expect(nearestRung(LINE_WEIGHT[rung])).toBe(rung);
    }
  });

  it("maps the legacy values actually found in the canvas", () => {
    // Sampled from the 175 existing strokeWidth call sites.
    expect(nearestRung(0.25)).toBe("fine");
    expect(nearestRung(0.28)).toBe("fine");
    expect(nearestRung(0.35)).toBe("thin");
    expect(nearestRung(0.45)).toBe("thin");
    expect(nearestRung(0.55)).toBe("medium");
    expect(nearestRung(0.9)).toBe("thick");
    expect(nearestRung(1.25)).toBe("heavy");
    expect(nearestRung(1.8)).toBe("accent");
  });

  it("chooses by ratio, not linear distance", () => {
    // The two methods disagree between the geometric midpoint of 0.28 and 0.4
    // (0.3347) and their linear midpoint (0.34). At 0.337, linear distance picks
    // 0.28 (0.057 vs 0.063) but ratio picks 0.4 — and ratio is correct, because
    // a multiplicative ladder is perceived multiplicatively.
    expect(nearestRung(0.337)).toBe("thin");
    // Just below the geometric midpoint both agree on the lower rung.
    expect(nearestRung(0.334)).toBe("fine");
  });

  it("falls back to the reading baseline for nonsense input", () => {
    expect(nearestRung(0)).toBe("thin");
    expect(nearestRung(-1)).toBe("thin");
    expect(nearestRung(Number.NaN)).toBe("thin");
  });
});
