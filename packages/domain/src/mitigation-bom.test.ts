import { describe, expect, it } from "vitest";
import { buildAcceptedMitigationLines } from "./mitigation-bom";
import type { OverlayProposal } from "@workstream/contracts";

const overlays: OverlayProposal[] = [
  {
    id: "ov-trp-1",
    kind: "trp_ring",
    status: "accepted",
    title: "TRP",
    detail: "Ring",
    source_object_ids: ["t1"],
    bom_line_ids: [],
    x_pct: 40,
    y_pct: 40,
    radius_m: 3,
  },
  {
    id: "ov-drain-1",
    kind: "drainage",
    status: "ready",
    title: "Drain",
    detail: "Allow",
    source_object_ids: [],
    bom_line_ids: [],
  },
];

describe("buildAcceptedMitigationLines", () => {
  it("emits TRP fencing for accepted overlays only", () => {
    const lines = buildAcceptedMitigationLines(overlays);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.label).toMatch(/TPZ/i);
    expect(lines[0]!.unit).toBe("lm");
    expect(lines[0]!.qty).toBeGreaterThan(10);
  });
});
