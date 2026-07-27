import { describe, expect, it } from "vitest";
import type { BoardDisclaimer } from "@workstream/contracts";
import { resolveShareLiabilityGate } from "./shareLiabilityGate";

function disclaimer(
  over: Partial<BoardDisclaimer> & Pick<BoardDisclaimer, "id" | "kind">,
): BoardDisclaimer {
  return {
    title: "Notice",
    statement: "Statement.",
    trigger: "something on the board",
    required: true,
    cites: ["surfaces"],
    basis: "operator",
    ...over,
  };
}

const SAFETY = disclaimer({ id: "bd-safety-waiver", kind: "safety_waiver" });
const SUBSURFACE = disclaimer({ id: "bd-subsurface", kind: "subsurface" });
const MATURITY = disclaimer({ id: "bd-maturity", kind: "maturity" });

describe("share liability gate", () => {
  it("hard-confirms an unanswered required safety waiver", () => {
    const gate = resolveShareLiabilityGate([SAFETY], {});
    expect(gate.hardConfirm?.id).toBe("bd-safety-waiver");
    expect(gate.softOutstanding).toBe(0);
  });

  it("releases the hard gate once the safety waiver is acknowledged", () => {
    const gate = resolveShareLiabilityGate([SAFETY], {
      "bd-safety-waiver": true,
    });
    expect(gate.hardConfirm).toBeNull();
  });

  it("never hard-gates an advisory safety waiver", () => {
    const advisory = disclaimer({
      id: "bd-safety-waiver",
      kind: "safety_waiver",
      required: false,
    });
    const gate = resolveShareLiabilityGate([advisory], {});
    expect(gate.hardConfirm).toBeNull();
    expect(gate.softOutstanding).toBe(0);
  });

  it("keeps the inferred notices soft — they warn, they never block", () => {
    const gate = resolveShareLiabilityGate([SUBSURFACE, MATURITY], {});
    expect(gate.hardConfirm).toBeNull();
    expect(gate.softOutstanding).toBe(2);
  });

  it("counts the soft notices separately from the hard one", () => {
    const gate = resolveShareLiabilityGate([SAFETY, SUBSURFACE, MATURITY], {});
    expect(gate.hardConfirm?.kind).toBe("safety_waiver");
    // The safety notice is not double-counted in the soft warning.
    expect(gate.softOutstanding).toBe(2);
  });

  it("drops acknowledged notices out of the soft count", () => {
    const gate = resolveShareLiabilityGate([SUBSURFACE, MATURITY], {
      "bd-subsurface": true,
    });
    expect(gate.softOutstanding).toBe(1);
  });

  it("is quiet on a board with nothing to disclaim", () => {
    expect(resolveShareLiabilityGate([], {})).toEqual({
      hardConfirm: null,
      softOutstanding: 0,
    });
  });
});
