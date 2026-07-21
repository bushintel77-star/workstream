import type { StudioItem, StudioItemType } from "../studioCatalog";

export type RejectionReason = "placement" | "style" | "cost";

export type SessionRejectionHint = {
  reason: RejectionReason;
  type: StudioItemType;
  x: number;
  y: number;
  note?: string;
};

export function buildSessionRejectionPrompt(
  hints: SessionRejectionHint[],
): string {
  if (hints.length === 0) return "";
  const rows = hints.slice(-6).map(
    (hint) =>
      `- ${hint.reason}: avoid repeating the rejected ${hint.type}${hint.note ? ` (${hint.note})` : ""}`,
  );
  return `Session-only operator rejections:\n${rows.join("\n")}\n\n`;
}

export function filterProposalsBySessionRejections(
  proposals: StudioItem[],
  hints: SessionRejectionHint[],
): StudioItem[] {
  if (hints.length === 0) return proposals;
  return proposals.filter((proposal) =>
    hints.every((hint) => {
      if (proposal.t !== hint.type) return true;
      if (hint.reason === "placement") {
        return Math.hypot(proposal.x - hint.x, proposal.y - hint.y) > 8;
      }
      return false;
    }),
  );
}
