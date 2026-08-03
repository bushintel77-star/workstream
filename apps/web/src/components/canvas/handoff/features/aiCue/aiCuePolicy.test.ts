import { describe, expect, it } from "vitest";
import {
  aiCueStorageKey,
  nextAiCue,
  parseSeen,
  type AiCueContext,
} from "./aiCuePolicy";

/** A canvas where the canopy cue is live. Override one field per test. */
const base: AiCueContext = {
  mode: "survey",
  hasAerial: true,
  boundaryPoints: 4,
  itemCount: 0,
  treeCount: 0,
  ghostCount: 0,
  aiBusy: false,
  clientView: false,
  focusOn: false,
  frameOn: false,
  seen: [],
};

const ctx = (over: Partial<AiCueContext> = {}): AiCueContext => ({
  ...base,
  ...over,
});

describe("suppression — degrade invisibly", () => {
  it("shows nothing in client view", () => {
    expect(nextAiCue(ctx({ clientView: true }))).toBeNull();
  });

  it("shows nothing in focus or frame mode", () => {
    expect(nextAiCue(ctx({ focusOn: true }))).toBeNull();
    expect(nextAiCue(ctx({ frameOn: true }))).toBeNull();
  });

  it("shows nothing outside the drawing modes", () => {
    for (const mode of ["quote", "present", "share", "elevation"]) {
      expect(nextAiCue(ctx({ mode }))).toBeNull();
    }
  });

  it("shows nothing while the AI is mid-flight", () => {
    // The busy state is its own signal; a cue would talk over it.
    expect(nextAiCue(ctx({ aiBusy: true }))).toBeNull();
  });

  it("shows nothing while ghosts await review", () => {
    // The operator already has an AI decision in front of them. A second
    // prompt competes with the one that matters.
    expect(nextAiCue(ctx({ ghostCount: 1 }))).toBeNull();
  });
});

describe("canopy cue", () => {
  it("fires when an aerial exists and no trees are recorded", () => {
    expect(nextAiCue(ctx())?.id).toBe("canopy");
  });

  it("does not fire without an aerial — vision has nothing to read", () => {
    expect(nextAiCue(ctx({ hasAerial: false, itemCount: 1 }))).toBeNull();
  });

  it("does not fire once trees are recorded — nothing to add", () => {
    expect(nextAiCue(ctx({ treeCount: 3, itemCount: 3 }))).toBeNull();
  });

  it("names the outcome, not the feature", () => {
    const cue = nextAiCue(ctx());
    expect(cue?.title).toBe("Find the existing trees for you");
    // The honesty promise matters as much as the offer.
    expect(cue?.body).toContain("until you accept");
  });
});

describe("layout cue", () => {
  const noAerial = { hasAerial: false } as const;

  it("fires when the lot is closed but empty", () => {
    expect(nextAiCue(ctx({ ...noAerial }))?.id).toBe("layout");
  });

  it("does not fire on an unclosed boundary", () => {
    expect(nextAiCue(ctx({ ...noAerial, boundaryPoints: 2 }))).toBeNull();
  });

  it("does not fire once the plan has content — proposing over work is presumptuous", () => {
    expect(nextAiCue(ctx({ ...noAerial, itemCount: 1 }))).toBeNull();
  });
});

describe("priority and acknowledgement", () => {
  it("prefers canopy — reading the site precedes proposing for it", () => {
    // Both are eligible here.
    expect(nextAiCue(ctx())?.id).toBe("canopy");
  });

  it("falls through to layout once canopy is acknowledged", () => {
    expect(nextAiCue(ctx({ seen: ["canopy"] }))?.id).toBe("layout");
  });

  it("goes quiet permanently once both are acknowledged", () => {
    expect(nextAiCue(ctx({ seen: ["canopy", "layout"] }))).toBeNull();
  });

  it("never returns two cues — one teaching surface at a time", () => {
    const first = nextAiCue(ctx());
    expect(first).not.toBeNull();
    const second = nextAiCue(ctx({ seen: [first!.id] }));
    expect(second?.id).not.toBe(first!.id);
  });
});

describe("persistence helpers", () => {
  it("scopes acknowledgement per project", () => {
    expect(aiCueStorageKey("abc")).toBe("cc_ai_cue_seen:abc");
    expect(aiCueStorageKey("abc")).not.toBe(aiCueStorageKey("def"));
  });

  it("round-trips", () => {
    expect(parseSeen(JSON.stringify(["canopy"]))).toEqual(["canopy"]);
  });

  it("survives anything malformed rather than throwing on mount", () => {
    expect(parseSeen(null)).toEqual([]);
    expect(parseSeen("")).toEqual([]);
    expect(parseSeen("not json")).toEqual([]);
    expect(parseSeen('{"a":1}')).toEqual([]);
    expect(parseSeen('["canopy","bogus",7,null]')).toEqual(["canopy"]);
  });
});
