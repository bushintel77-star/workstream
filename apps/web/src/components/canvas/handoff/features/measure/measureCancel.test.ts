import { describe, expect, it } from "vitest";
import { isStickyDraftTool } from "./measureCancel";

describe("measureCancel", () => {
  it("treats measure as sticky until Esc / cancel", () => {
    expect(isStickyDraftTool("measure")).toBe(true);
    expect(isStickyDraftTool("select")).toBe(false);
  });
});
