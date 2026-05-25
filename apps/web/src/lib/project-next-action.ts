import type { Audit, Costing, Design, Output, Survey } from "./api";

export type ProjectNextAction = {
  label: string;
  pending: string;
  action: (fd: FormData) => Promise<void>;
  kind?: string;
  accent?: boolean;
};

type ResolveInput = {
  survey: Survey | null;
  design: Design | null;
  costings: Costing[];
  audit: Audit | null;
  outputs: Output[];
  runSurveyAction: (fd: FormData) => Promise<void>;
  runDesignAction: (fd: FormData) => Promise<void>;
  runCostingAction: (fd: FormData) => Promise<void>;
  runAuditAction: (fd: FormData) => Promise<void>;
  runOutputAction: (fd: FormData) => Promise<void>;
};

/** Single pipeline CTA for overview hub and mobile bottom bar. */
export function resolveProjectNextAction(input: ResolveInput): ProjectNextAction | null {
  const {
    survey,
    design,
    costings,
    audit,
    outputs,
    runSurveyAction,
    runDesignAction,
    runCostingAction,
    runAuditAction,
    runOutputAction,
  } = input;

  if (!survey) {
    return {
      label: "Run survey",
      pending: "Running survey…",
      action: runSurveyAction,
    };
  }
  if (!design) {
    return {
      label: "Generate design",
      pending: "Designing…",
      action: runDesignAction,
    };
  }
  if (costings.length === 0) {
    return {
      label: "Price it",
      pending: "Pricing…",
      action: runCostingAction,
    };
  }
  if (!audit) {
    return {
      label: "Run audit",
      pending: "Auditing…",
      action: runAuditAction,
    };
  }
  if (audit.passed && !outputs.some((o) => o.kind === "quote")) {
    return {
      label: "Generate quote",
      pending: "Generating…",
      action: runOutputAction,
      kind: "quote",
      accent: true,
    };
  }
  return null;
}
