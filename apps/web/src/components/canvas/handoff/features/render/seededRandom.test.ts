import { describe, expect, it } from "vitest";
import {
  fnv1a32,
  seededRandom,
  wobbledCirclePath,
  wobbledLeaderControl,
} from "./seededRandom";

describe("seededRandom", () => {
  it("hashes the same string to the same FNV-1a value", () => {
    expect(fnv1a32("item-a")).toBe(fnv1a32("item-a"));
    expect(fnv1a32("item-a")).not.toBe(fnv1a32("item-b"));
  });

  it("yields an identical sequence for the same item id (run twice)", () => {
    const a = seededRandom("canopy-e2e-1");
    const b = seededRandom("canopy-e2e-1");
    const seqA = Array.from({ length: 12 }, () => a());
    const seqB = Array.from({ length: 12 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("diverges for different item ids", () => {
    const a = seededRandom("tree-1");
    const b = seededRandom("tree-2");
    expect(Array.from({ length: 6 }, () => a())).not.toEqual(
      Array.from({ length: 6 }, () => b()),
    );
  });

  it("produces identical wobble paths for the same id", () => {
    const path1 = wobbledCirclePath(50, 50, 40, seededRandom("wobble-x"));
    const path2 = wobbledCirclePath(50, 50, 40, seededRandom("wobble-x"));
    expect(path1).toBe(path2);
    expect(path1.startsWith("M ")).toBe(true);
  });

  it("wobbles leader controls deterministically", () => {
    const c1 = wobbledLeaderControl(10, 10, 90, 40, seededRandom("lead-1"));
    const c2 = wobbledLeaderControl(10, 10, 90, 40, seededRandom("lead-1"));
    expect(c1).toEqual(c2);
  });
});
