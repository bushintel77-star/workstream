import { describe, expect, it } from "vitest";
import {
  placeScheduleCards,
  scheduleCardTransform,
  SCHEDULE_CARD_STACK_PX,
} from "./scheduleCardLayout";

describe("placeScheduleCards", () => {
  it("leaves a lone card unoffset", () => {
    expect(placeScheduleCards([{ id: "title", x: 100, y: 100 }])).toEqual([
      { id: "title", offsetX: 0, offsetY: 0 },
    ]);
  });

  it("stacks cards that share a point", () => {
    const out = placeScheduleCards([
      { id: "title", x: 200, y: 200 },
      { id: "outdoor", x: 200, y: 200 },
      { id: "dwelling", x: 200, y: 200 },
    ]);
    expect(out.map((p) => p.offsetY)).toEqual([
      0,
      SCHEDULE_CARD_STACK_PX,
      SCHEDULE_CARD_STACK_PX * 2,
    ]);
    expect(out.every((p) => p.offsetX === 0)).toBe(true);
  });

  it("does not stack distant cards", () => {
    const out = placeScheduleCards([
      { id: "title", x: 100, y: 100 },
      { id: "dwelling", x: 400, y: 400 },
    ]);
    expect(out).toEqual([
      { id: "title", offsetX: 0, offsetY: 0 },
      { id: "dwelling", offsetX: 0, offsetY: 0 },
    ]);
  });

  it("nudges left clear of the right data lane", () => {
    const out = placeScheduleCards([{ id: "title", x: 900, y: 200 }], {
      viewportW: 960,
      safeRightPx: 304,
    });
    // maxCentre = 960 - 304 - 54 - 8 = 594 → offsetX = 594 - 900
    expect(out[0]!.offsetX).toBe(594 - 900);
    expect(out[0]!.offsetY).toBe(0);
  });

  it("still stacks cards that meet only after the lane clamp", () => {
    // Both anchors sit beyond the lane-safe edge (zoom-out shared centroid):
    // the clamp pushes them to the same centre, so they must still stack.
    const out = placeScheduleCards(
      [
        { id: "title", x: 1500, y: 500 },
        { id: "outdoor", x: 1500, y: 500 },
      ],
      { viewportW: 960, safeRightPx: 304 },
    );
    expect(out[0]!.offsetY).toBe(0);
    expect(out[1]!.offsetY).toBe(SCHEDULE_CARD_STACK_PX);
    expect(out[0]!.offsetX).toBe(out[1]!.offsetX);
  });

  it("builds a translate for non-zero offsets only", () => {
    expect(scheduleCardTransform(0, 0)).toBeUndefined();
    expect(scheduleCardTransform(0, 56)).toBe(
      "translate(calc(-50% + 0px), calc(-50% + 56px))",
    );
    expect(scheduleCardTransform(-40, 56)).toBe(
      "translate(calc(-50% + -40px), calc(-50% + 56px))",
    );
  });
});
