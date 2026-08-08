import { describe, expect, it } from "vitest";
import type { BomLine } from "@workstream/contracts";
import {
  matchLeftoversToBom,
  matchLeftoversToNeed,
  registerLeftover,
} from "./resource-pool";

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
          id: "00000000-0000-4000-8000-0000000000aa",
          owner_id: "dev-user",
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
    expect(hit?.sku).toBe("STONE-DEC");
  });

  it("matches leftovers against live BOM lines", () => {
    const line: BomLine = {
      id: "b1",
      tier: "primary",
      sku: "STONE-DEC",
      label: "Decorative stone",
      unit: "t",
      qty: 0.6,
      rate: 180,
      total: 108,
      source_object_ids: [],
      is_provisional: true,
    };
    const hit = matchLeftoversToBom(
      [
        {
          id: "00000000-0000-4000-8000-0000000000aa",
          owner_id: "dev-user",
          sku: "STONE-DEC",
          label: "Decorative stone",
          qty: 0.25,
          unit: "t",
          created_at: "2026-08-09T00:00:00.000Z",
        },
      ],
      [line],
    );
    expect(hit?.cover_qty).toBe(0.25);
    expect(hit?.bom_line.id).toBe("b1");
  });
});
