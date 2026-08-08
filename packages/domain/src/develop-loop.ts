/**
 * Agentic-lite Develop loop copy — HITL gates between scan → scheme → flora.
 * Workflow 1: never silent-writes geometry.
 */

export type DevelopLoopTipInput = {
  ghostCount: number;
  schemeCount: number;
};

/** Operator tip after Develop site runs (Cmd+K). */
export function developLoopTip(input: DevelopLoopTipInput): string {
  const parts: string[] = ["Develop loop"];
  if (input.ghostCount > 0) {
    parts.push(`Review ${input.ghostCount} AI ghost${input.ghostCount === 1 ? "" : "s"}`);
  } else {
    parts.push("Layout proposals ready — open ghost review");
  }
  if (input.schemeCount === 0) {
    parts.push("Gate 1 — Save scheme A before Flora mass");
  } else if (input.schemeCount < 3) {
    parts.push("Gate 1 done — compare schemes or save another variation");
  } else {
    parts.push("Switch schemes A–C for the meeting");
  }
  parts.push("Gate 2 — Planting Add opens Flora Ring");
  return parts.join(" · ");
}

/** Default Ask-AI / scan query for the Develop loop. */
export const DEVELOP_LOOP_QUERY =
  "develop the garden layout — canopy west, path, planting beds";
