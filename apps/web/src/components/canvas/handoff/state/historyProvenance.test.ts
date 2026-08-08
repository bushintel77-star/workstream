import { describe, expect, it } from "vitest";
import type { StudioItem } from "../studioCatalog";
import { classifyHistoryProvenance } from "./historyProvenance";

const item = (id: string, ghost: boolean): StudioItem => ({
  id,
  ghost,
  t: "bed",
  x: 40,
  y: 50,
  rot: 0,
  scale: 1,
});

describe("history provenance", () => {
  it("marks proposal creation, acceptance, and rejection as AI operations", () => {
    const ghost = item("suggestion", true);
    expect(classifyHistoryProvenance([], [ghost])).toBe("ai");
    expect(classifyHistoryProvenance([ghost], [{ ...ghost, ghost: false }])).toBe(
      "ai",
    );
    expect(classifyHistoryProvenance([ghost], [])).toBe("ai");
  });

  it("marks direct plan edits as manual", () => {
    const accepted = item("accepted", false);
    expect(
      classifyHistoryProvenance([accepted], [{ ...accepted, x: 42 }]),
    ).toBe("manual");
  });
});
