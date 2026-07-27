import type { BoardDisclaimer } from "@workstream/contracts";

/**
 * How hard the export liability overlay pushes back before a set is issued.
 *
 * Most notices fire on an *inference* from board geometry — a trench near an
 * unlocated service, planting drawn at mature spread, a protection zone over
 * the works. The tool can be wrong about those, and refusing to issue a drawing
 * on an inference it got wrong is worse for the practice than letting the
 * operator look and decide. Those stay soft: the share button relabels and a
 * warning appears, but nothing is blocked.
 *
 * The safety waiver is the exception. A compliant barrier is a legal
 * requirement, not a recommendation, and this is the notice the practice is
 * most exposed on if it goes out unanswered. That one hard-confirms.
 *
 * Known gap: the strategy frames the safety waiver as recording an *operator
 * action* — a recommended barrier removed at client request. The board cannot
 * see that today. `DesignCanvas` has no field for a declined recommendation and
 * ghost rejections are session-only (`sessionRejectionHints`), so the trigger
 * is still the geometric proxy: a pool drawn with no barrier anywhere on the
 * board. Recording the operator's own removal needs a durable contracts field
 * and a schema brief.
 */
export type ShareLiabilityGate = {
  /** Notice that must be answered in a modal before the share proceeds. */
  hardConfirm: BoardDisclaimer | null;
  /** Required notices that only warn — the share is never blocked on these. */
  softOutstanding: number;
};

/** Only a required safety waiver stops the share. */
function isHardGate(d: BoardDisclaimer): boolean {
  return d.kind === "safety_waiver" && d.required;
}

export function resolveShareLiabilityGate(
  disclaimers: BoardDisclaimer[],
  acknowledged: Record<string, boolean>,
): ShareLiabilityGate {
  const unanswered = disclaimers.filter(
    (d) => d.required && acknowledged[d.id] !== true,
  );
  return {
    hardConfirm: unanswered.find(isHardGate) ?? null,
    softOutstanding: unanswered.filter((d) => !isHardGate(d)).length,
  };
}
