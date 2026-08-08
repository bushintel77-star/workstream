import { describe, expect, it } from "vitest";
import { matchLeftoversToNeed, registerLeftover } from "./resource-pool";

describe("resource-pool", () => {
  it("registers excess stone", () => {
    const left = registerLeftover({
      orderQty: 1,
      usedQty: 0.75,
      sku: "STONE-DEC",
      label: "Decorative stone",
      idFactory: () => "left-1",
      now: "2026-08-09T00:00:00.000Z",
    });
    expect(left?.qty).toBe(0.25);
  });

  it("returns null when excess tiny", () => {
    expect(
      registerLeftover({
        orderQty: 1,
        usedQty: 0.98,
        sku: "STONE-DEC",
        label: "Decorative stone",
      }),
    ).toBeNull();
  });

  it("matches leftovers to need", () => {
    const hit = matchLeftoversToNeed(
      [
        {
          id: "a",
          sku: "STONE-DEC",
          label: "Stone",
          qty: 0.4,
          unit: "t",
          created_at: "2026-08-09T00:00:00.000Z",
        },
      ],
      "STONE-DEC",
      0.5,
    );
    expect(hit?.id).toBe("a");
  });
});
