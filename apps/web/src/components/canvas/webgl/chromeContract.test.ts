import { describe, expect, it } from "vitest";
import {
  ALL_ELEMENTS,
  ALL_PRESETS,
  CONTRACT,
  behaviourOf,
  isHidden,
  isLocked,
  lockReason,
  type ChromeElement,
} from "./chromeContract";

describe("chromeContract — Phase L.9: every element has an entry for all four modes", () => {
  it("CONTRACT keys match ALL_ELEMENTS exactly (no missing, no extra)", () => {
    expect(Object.keys(CONTRACT).sort()).toEqual(
      [...ALL_ELEMENTS].sort(),
    );
  });

  it.each(ALL_ELEMENTS)("'%s' has an entry for every preset", (el) => {
    for (const preset of ALL_PRESETS) {
      const behaviour = CONTRACT[el][preset];
      expect(behaviour).toBeDefined();
      expect(["same", "convert", "lock", "hide"]).toContain(behaviour.kind);
    }
  });

  it("every preset is represented for every element", () => {
    for (const el of ALL_ELEMENTS) {
      const presets = Object.keys(CONTRACT[el]);
      expect(presets.sort()).toEqual([...ALL_PRESETS].sort());
    }
  });

  it("lock behaviours carry a non-empty reason", () => {
    for (const el of ALL_ELEMENTS) {
      for (const preset of ALL_PRESETS) {
        const b = CONTRACT[el][preset];
        if (b.kind === "lock") {
          expect(b.reason.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("hide behaviours carry a non-empty reason", () => {
    for (const el of ALL_ELEMENTS) {
      for (const preset of ALL_PRESETS) {
        const b = CONTRACT[el][preset];
        if (b.kind === "hide") {
          expect(b.reason.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("convert behaviours carry a non-empty 'to' target", () => {
    for (const el of ALL_ELEMENTS) {
      for (const preset of ALL_PRESETS) {
        const b = CONTRACT[el][preset];
        if (b.kind === "convert") {
          expect(b.to.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("chromeContract — helper functions", () => {
  it("behaviourOf returns the contract entry", () => {
    expect(behaviourOf("ribbonGrade", "3d").kind).toBe("lock");
    expect(behaviourOf("suncastDrainage", "sec").kind).toBe("hide");
    expect(behaviourOf("wfsChips", "plan").kind).toBe("same");
  });

  it("isLocked / isHidden are consistent with behaviourOf", () => {
    for (const el of ALL_ELEMENTS) {
      for (const preset of ALL_PRESETS) {
        const b = behaviourOf(el, preset);
        expect(isLocked(el, preset)).toBe(b.kind === "lock");
        expect(isHidden(el, preset)).toBe(b.kind === "hide");
      }
    }
  });

  it("lockReason returns the reason for locked elements, null otherwise", () => {
    expect(lockReason("ribbonGrade", "3d")).toContain("perspective");
    expect(lockReason("ribbonGrade", "plan")).toBeNull();
    expect(lockReason("wfsChips", "3d")).toBeNull();
  });
});

describe("chromeContract — adding a new element without a rule fails", () => {
  it("a hypothetical new element not in CONTRACT would fail the key check", () => {
    const fakeElement: ChromeElement = "schedule" as ChromeElement;
    // schedule IS in the contract — this passes
    expect(CONTRACT[fakeElement]).toBeDefined();

    // If someone adds a ChromeElement union member without a CONTRACT entry,
    // the "CONTRACT keys match ALL_ELEMENTS" test above would fail because
    // ALL_ELEMENTS would include the new member but CONTRACT would not.
  });
});
