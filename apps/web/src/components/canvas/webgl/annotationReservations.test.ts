import { beforeEach, describe, expect, it } from "vitest";
import {
  RESERVATION_MAX_AGE_MS,
  clearAnnotationRects,
  publishAnnotationRects,
  readAnnotationRects,
} from "./annotationReservations";
import type { AnnotationRect } from "./annotationLayout";

const CHIP: AnnotationRect = { x: 10, y: 20, width: 190, height: 18 };

describe("annotationReservations", () => {
  beforeEach(() => {
    clearAnnotationRects();
  });

  it("hands a producer's rects to the consumer", () => {
    publishAnnotationRects("dimensionChip", [CHIP], 1000);
    expect(readAnnotationRects(1000)).toEqual([CHIP]);
  });

  it("keeps rects for a frame or two of lag", () => {
    publishAnnotationRects("dimensionChip", [CHIP], 1000);
    // ~1 frame at 60fps: ordering between sibling useFrame callbacks is not
    // guaranteed, so a one-frame-stale rect has to still count.
    expect(readAnnotationRects(1016)).toEqual([CHIP]);
  });

  it("ages stale rects out, so an unmounted producer stops being avoided", () => {
    publishAnnotationRects("dimensionChip", [CHIP], 1000);
    expect(readAnnotationRects(1000 + RESERVATION_MAX_AGE_MS + 1)).toEqual([]);
  });

  it("lets a producer retract by publishing nothing", () => {
    publishAnnotationRects("dimensionChip", [CHIP], 1000);
    publishAnnotationRects("dimensionChip", [], 1010);
    expect(readAnnotationRects(1010)).toEqual([]);
  });

  it("replaces rather than accumulates per family", () => {
    publishAnnotationRects("dimensionChip", [CHIP], 1000);
    publishAnnotationRects("dimensionChip", [CHIP, CHIP], 1010);
    expect(readAnnotationRects(1010)).toHaveLength(2);
  });

  it("clears on request", () => {
    publishAnnotationRects("dimensionChip", [CHIP], 1000);
    clearAnnotationRects("dimensionChip");
    expect(readAnnotationRects(1000)).toEqual([]);
  });
});
