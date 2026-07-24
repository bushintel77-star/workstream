import { describe, expect, it } from "vitest";
import {
  nextSchemeLetter,
  snapshotScheme,
  schemeName,
} from "./design-schemes";

describe("design-schemes", () => {
  it("allocates A then B then C", () => {
    expect(nextSchemeLetter([])).toBe("A");
    expect(nextSchemeLetter([{ letter: "A" }])).toBe("B");
    expect(nextSchemeLetter([{ letter: "A" }, { letter: "B" }, { letter: "C" }])).toBe(
      null,
    );
  });

  it("snapshots items without sharing references", () => {
    const items = [{ id: "1", t: "lawn" as const }];
    const scheme = snapshotScheme(
      "A",
      items,
      [],
      "s1",
      new Date("2026-07-24T00:00:00Z"),
    );
    expect(scheme.name).toBe(schemeName("A"));
    expect(scheme.pathCorridors).toEqual([]);
    expect(scheme.items[0]).toEqual(items[0]);
    expect(scheme.items[0]).not.toBe(items[0]);
  });
});
