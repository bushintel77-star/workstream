import { describe, expect, it } from "vitest";
import {
  acceptScheduleCalloutGhosts,
  proposeScheduleCalloutGhosts,
} from "./schedule-callouts";

describe("schedule callouts", () => {
  it("proposes planting and trench ghosts then accepts to annotations", () => {
    const ghosts = proposeScheduleCalloutGhosts({
      placements: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          symbol_id: "hornbeam-pleached",
          x_pct: 20,
          y_pct: 30,
          rotation_deg: 0,
          scale: 1,
        },
      ],
      construction_trenches: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          name: "Main",
          kind: "irrig_main",
          points: [
            { x_pct: 10, y_pct: 10 },
            { x_pct: 50, y_pct: 10 },
          ],
          depth_mm: 400,
          source: "auto",
        },
      ],
      annotations: [],
    });
    expect(ghosts.length).toBeGreaterThanOrEqual(2);
    const notes = acceptScheduleCalloutGhosts(ghosts);
    expect(notes).toHaveLength(ghosts.length);
    expect(notes[0]?.anchor.kind).toBe("point");
  });
});
