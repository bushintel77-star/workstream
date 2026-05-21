import type { ProjectStatus } from "@workstream/contracts";

/** Colloquial AU copy for on-site gardeners — keep it light. */
export const GARDEN_COPY = {
  widgets: {
    rightJob: "Right job?",
    whatsNext: "What's next?",
    workToday: "Work today?",
    backyard: "Backyard",
    biteLater: "Bite you later",
    money: "Money story",
    reachClient: "Reach client",
    whatsLeft: "What's left?",
    maps: "Get there",
    sketch: "Back-of-envelope",
    filing: "Plans & pics",
    share: "Send to client",
  },
  voice: {
    dockTitle: "Voice",
    walkthrough: "Site yarn",
    walkthroughSub: "Walk the block — builds the survey",
    note: "Chuck a note",
    noteSub: "Dictating — tasks & materials",
    noteActive: "Dictating…",
    walkActive: "Recording yarn…",
    tapHint: "Yarn = walkthrough. Note = dictate. Not the same thing.",
  },
  weather: {
    sweet: "Sweet day on site",
    rain: "Rain about — rethink pours",
    wind: "Windy — mind the dust",
  },
  tasks: {
    sheetTitle: "What's left on this job",
    workflowTitle: "Where you're at",
    none: "Nothing hanging — beauty.",
    count: (n: number) =>
      n === 1 ? "1 thing still to do" : `${n} things still to do`,
  },
} as const;

export type SiteNextAction = {
  label: string;
  sub?: string;
  kind:
    | "record"
    | "sketch"
    | "survey_ok"
    | "develop"
    | "cost"
    | "audit"
    | "quote"
    | "share";
};

export function deriveSiteNextAction(input: {
  status: ProjectStatus;
  hasSurvey: boolean;
  hasDesign: boolean;
  hasCosting: boolean;
  auditPassed: boolean;
  hasQuote: boolean;
  hasCanvas?: boolean;
}): SiteNextAction {
  if (!input.hasSurvey) {
    return {
      kind: "record",
      label: "Spin a site yarn",
      sub: "Walkthrough first — maps the backyard",
    };
  }
  if (input.status === "survey_review" || input.status === "processing") {
    return {
      kind: "survey_ok",
      label: "Survey look OK?",
      sub: "Tick it off, then sketch on the plan",
    };
  }
  if (!input.hasCanvas) {
    return {
      kind: "sketch",
      label: "Back-of-envelope sketch",
      sub: "Drag plants & paving — ballpark the job",
    };
  }
  if (!input.hasDesign) {
    return {
      kind: "develop",
      label: "Develop from sketch",
      sub: "AI honours your layout",
    };
  }
  if (!input.hasCosting) {
    return {
      kind: "cost",
      label: "Price it three ways",
      sub: "Lean · Standard · Buffer",
    };
  }
  if (!input.auditPassed) {
    return {
      kind: "audit",
      label: "Run the audit",
      sub: "Catch what'll bite you later",
    };
  }
  if (!input.hasQuote) {
    return {
      kind: "quote",
      label: "Generate the quote",
      sub: "Client-ready HTML",
    };
  }
  return {
    kind: "share",
    label: "Send quote to client",
    sub: "WhatsApp or email pack",
  };
}

export function formatAudBand(low: number, high: number): string {
  const f = (n: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(n);
  return `${f(low)}–${f(high)}`;
}

export function countOpenTasks(
  tasks: Array<{ status: string }>,
): number {
  return tasks.filter(
    (t) =>
      t.status === "pending" ||
      t.status === "in_progress" ||
      t.status === "blocked",
  ).length;
}
