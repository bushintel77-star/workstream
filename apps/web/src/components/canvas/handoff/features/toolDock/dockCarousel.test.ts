import { describe, expect, it } from "vitest";
import {
  DOCK_CURVE,
  clampDockFocus,
  dockChipPose,
  dockFocusFromPointer,
  dockRailPath,
  spinDockFocus,
} from "./dockCarousel";

describe("dockChipPose", () => {
  it("crest chip gets full lean, scale, opacity and depth", () => {
    const pose = dockChipPose(3, 3);
    expect(pose.leanPx).toBeCloseTo(DOCK_CURVE.reachPx);
    expect(pose.scale).toBeCloseTo(DOCK_CURVE.maxScale);
    expect(pose.opacity).toBeCloseTo(1);
    expect(pose.depthPx).toBeCloseTo(DOCK_CURVE.depthPx);
    expect(pose.yawDeg).toBeCloseTo(0);
  });

  it("far chips stay at the rest floor", () => {
    const pose = dockChipPose(0, 8);
    expect(pose.leanPx).toBe(0);
    expect(pose.scale).toBeCloseTo(DOCK_CURVE.minScale);
    expect(pose.opacity).toBeCloseTo(DOCK_CURVE.minOpacity);
    expect(pose.depthPx).toBe(0);
  });

  it("neighbours get a partial lean with signed yaw", () => {
    const above = dockChipPose(2, 3);
    const below = dockChipPose(4, 3);
    expect(above.leanPx).toBeGreaterThan(0);
    expect(above.leanPx).toBeLessThan(DOCK_CURVE.reachPx);
    expect(above.yawDeg).toBeLessThan(0);
    expect(below.yawDeg).toBeGreaterThan(0);
  });

  it("amplitude scales the whole pose", () => {
    const full = dockChipPose(3, 3, 1);
    const half = dockChipPose(3, 3, 0.5);
    expect(half.leanPx).toBeCloseTo(full.leanPx * 0.5);
    expect(half.depthPx).toBeCloseTo(full.depthPx * 0.5);
  });
});

describe("crest tracking", () => {
  it("clamps focus into the chip range", () => {
    expect(clampDockFocus(-2, 9)).toBe(0);
    expect(clampDockFocus(42, 9)).toBe(8);
  });

  it("pointer y maps into a fractional crest", () => {
    // Mid of chip 2 at pitch 48 → index ≈ 2
    expect(dockFocusFromPointer(2 * 48 + 24, 48, 9)).toBeCloseTo(2, 1);
    expect(dockFocusFromPointer(0, 0, 9)).toBe(0);
  });

  it("wheel spin travels the crest and clamps at the ends", () => {
    const spun = spinDockFocus(2, 100, 9);
    expect(spun).toBeCloseTo(2 + 100 * DOCK_CURVE.wheelGain);
    expect(spinDockFocus(8, 9_999, 9)).toBe(8);
  });
});

describe("dockRailPath — the dock shell curve", () => {
  it("emits an SVG path that bulges at the crest", () => {
    const path = dockRailPath(5, 2, 1, 48, 64);
    expect(path.startsWith("M ")).toBe(true);
    expect(path).toMatch(/ L /);

    // Parse "M/L x y" pairs — crest (middle of 5 chips) must lean further
    // toward +x than either end of the rail.
    const pairs = [...path.matchAll(/(?:M|L) ([\d.]+) ([\d.]+)/g)].map(
      (m) => ({ x: Number(m[1]), y: Number(m[2]) }),
    );
    expect(pairs.length).toBeGreaterThan(4);
    const first = pairs[0]!;
    const last = pairs[pairs.length - 1]!;
    const mid = pairs[Math.floor(pairs.length / 2)]!;
    expect(mid.x).toBeGreaterThan(first.x);
    expect(mid.x).toBeGreaterThan(last.x);
    expect(mid.y).toBeGreaterThan(first.y);
    expect(mid.y).toBeLessThan(last.y);
  });

  it("returns empty for degenerate input", () => {
    expect(dockRailPath(0, 0, 1, 48, 64)).toBe("");
    expect(dockRailPath(5, 2, 1, 0, 64)).toBe("");
  });
});
