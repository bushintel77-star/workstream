/**
 * ASLA/SILA design lifecycle — soft expected-detail matrix for the studio.
 *
 * Distinct from ProjectStatus (pipeline job) and StudioMode (survey/sketch/cad).
 * Phase never hard-locks tools; it names what the board should carry so chrome
 * and assist can stay honest about missing artefact depth.
 */

import type { DesignLifecyclePhase, ProjectStatus } from "@workstream/contracts";

export type { DesignLifecyclePhase };

export const DESIGN_LIFECYCLE_PHASES: DesignLifecyclePhase[] = [
  "concept",
  "design_development",
  "construction_docs",
  "tendering",
  "construction_admin",
  "post_occupancy",
];

export const DESIGN_LIFECYCLE_LABEL: Record<DesignLifecyclePhase, string> = {
  concept: "1 Concept",
  design_development: "2 Design development",
  construction_docs: "3 Construction docs",
  tendering: "4 Tendering",
  construction_admin: "5 Construction admin",
  post_occupancy: "6 Post-occupancy",
};

export type PhaseCapabilities = {
  phase: DesignLifecyclePhase;
  /** Soft expectation — services / BYDA depth. */
  expectServices: boolean;
  /** Soft expectation — irrigation / lighting zones. */
  expectZones: boolean;
  /** Soft expectation — priced lines. */
  expectQuote: boolean;
  /** Soft expectation — presentation sheet. */
  expectSheet: boolean;
  /** One-line operator tip for the phase chip. */
  tip: string;
};

const CAPS: Record<DesignLifecyclePhase, Omit<PhaseCapabilities, "phase">> = {
  concept: {
    expectServices: false,
    expectZones: false,
    expectQuote: false,
    expectSheet: false,
    tip: "Massing and planting intent — keep systems light.",
  },
  design_development: {
    expectServices: true,
    expectZones: true,
    expectQuote: false,
    expectSheet: false,
    tip: "Resolve outdoor geometry; start zones and setbacks.",
  },
  construction_docs: {
    expectServices: true,
    expectZones: true,
    expectQuote: true,
    expectSheet: true,
    tip: "Zones, trenches, dims and sheet set before issue.",
  },
  tendering: {
    expectServices: true,
    expectZones: true,
    expectQuote: true,
    expectSheet: true,
    tip: "Quote and sheet must match the drawn board.",
  },
  construction_admin: {
    expectServices: true,
    expectZones: true,
    expectQuote: true,
    expectSheet: true,
    tip: "Track dig honesty and site-pack chase items.",
  },
  post_occupancy: {
    expectServices: false,
    expectZones: false,
    expectQuote: false,
    expectSheet: false,
    tip: "Review establishment — growth and maintenance only.",
  },
};

export function resolvePhaseCapabilities(
  phase: DesignLifecyclePhase,
): PhaseCapabilities {
  return { phase, ...CAPS[phase] };
}

/**
 * Soft default from pipeline status — operator override wins when persisted.
 * Never invents a phase outside the six ASLA/SILA stages.
 */
export function suggestPhaseFromProjectStatus(
  status: ProjectStatus,
): DesignLifecyclePhase {
  switch (status) {
    case "draft":
    case "recording":
    case "processing":
      return "concept";
    case "survey_review":
      return "concept";
    case "design_review":
      return "design_development";
    case "cost_review":
      return "construction_docs";
    case "audit":
      return "tendering";
    case "outputs":
      return "construction_admin";
    case "complete":
      return "post_occupancy";
    default:
      return "concept";
  }
}

export function isDesignLifecyclePhase(
  value: unknown,
): value is DesignLifecyclePhase {
  return (
    typeof value === "string" &&
    (DESIGN_LIFECYCLE_PHASES as string[]).includes(value)
  );
}
