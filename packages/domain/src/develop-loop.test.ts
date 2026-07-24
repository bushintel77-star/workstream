import { describe, expect, it } from "vitest";
import { developLoopTip } from "./develop-loop";

describe("developLoopTip", () => {
  it("nudges scheme save when empty", () => {
    const tip = developLoopTip({ ghostCount: 3, schemeCount: 0 });
    expect(tip).toMatch(/Develop loop/);
    expect(tip).toMatch(/3 AI ghosts/);
    expect(tip).toMatch(/Gate 1/);
    expect(tip).toMatch(/Save scheme A/);
    expect(tip).toMatch(/Gate 2/);
    expect(tip).toMatch(/Flora Ring/);
  });

  it("mentions scheme compare when A exists", () => {
    expect(developLoopTip({ ghostCount: 0, schemeCount: 1 })).toMatch(
      /compare schemes/i,
    );
  });
});
