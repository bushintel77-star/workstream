import { describe, expect, it } from "vitest";
import type { StudioItem } from "../studioCatalog";
import {
  buildSessionRejectionPrompt,
  filterProposalsBySessionRejections,
} from "./sessionRejectionHints";

const proposal = (t: StudioItem["t"], x = 50): StudioItem => ({
  id: `${t}-${x}`,
  t,
  x,
  y: 50,
  rot: 0,
  scale: 1,
  ghost: true,
});

describe("session rejection hints", () => {
  it("builds a concise prompt block without persistence fields", () => {
    expect(
      buildSessionRejectionPrompt([
        { reason: "cost", type: "deck", x: 50, y: 50 },
      ]),
    ).toContain("cost: avoid repeating the rejected deck");
  });

  it("filters repeated style and nearby placement proposals", () => {
    const items = [proposal("deck"), proposal("bed"), proposal("deck", 80)];
    expect(
      filterProposalsBySessionRejections(items, [
        { reason: "placement", type: "deck", x: 50, y: 50 },
      ]).map((item) => item.id),
    ).toEqual(["bed-50", "deck-80"]);
    expect(
      filterProposalsBySessionRejections(items, [
        { reason: "style", type: "deck", x: 50, y: 50 },
      ]).map((item) => item.id),
    ).toEqual(["bed-50"]);
  });
});
