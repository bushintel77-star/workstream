import type { DesignProposal, GapFlag } from "@workstream/contracts";

export type DesignGeneration = {
  proposal: DesignProposal;
  gaps: GapFlag[];
  rationale: string;
};
