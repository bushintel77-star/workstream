import { describe, expect, it } from "vitest";
import { airLockSnapToHardscape } from "./airLockSnap";

const BOX = [
  { x: 20, y: 20 },
  { x: 80, y: 20 },
  { x: 80, y: 80 },
  { x: 20, y: 80 },
];

describe("airLockSnapToHardscape", () => {
  it("snaps when within ~15px of a hard ring", () => {
    /* 1% of 1000px board ≈ 10px — inside 15px lock. */
    const q = airLockSnapToHardscape({ x: 50, y: 21 }, [BOX], 1000, 1000);
    expect(q.y).toBeCloseTo(20, 0);
  });

  it("leaves far points alone", () => {
    const p = { x: 50, y: 50 };
    const q = airLockSnapToHardscape(p, [BOX], 1000, 1000);
    expect(q).toEqual(p);
  });
});
