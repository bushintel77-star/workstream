import { describe, expect, it } from "vitest";
import {
  LOCAL_ACTION_PX,
  LOCAL_ARC_SPAN_DEG,
  LOCAL_HUB_PX,
} from "./fittsProximity";

describe("fittsProximity", () => {
  it("keeps local actions short of a long pointer travel", () => {
    expect(LOCAL_ACTION_PX).toBeLessThanOrEqual(72);
    expect(LOCAL_HUB_PX).toBeLessThanOrEqual(LOCAL_ACTION_PX);
    expect(LOCAL_ARC_SPAN_DEG).toBeLessThanOrEqual(160);
  });
});
