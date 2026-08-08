/**
 * Design-time permit recognition → living to-do list.
 *
 * Pure helpers: assess handoff-studio geometry for council / TRP / stormwater
 * flags, then map those flags (+ compliance alerts) into CreateTask drafts
 * with stable trigger ids for dedupe.
 */

import type { CreateTaskInput, Task } from "@workstream/contracts";
import {
  detectMunicipality,
  type Municipality,
  type PlanningFlag,
} from "./planning-context";
import type {
  ComplianceAlert,
  StudioComplianceItem,
} from "./studio-preemptive-compliance";

const TRIGGER_PREFIX = "ws-design:";

export type DesignTodoDraft = CreateTaskInput & {
  /** Stable id for sync / prompt dedupe (not stored as its own column). */
  trigger_id: string;
};

function itemAreaM2(it: StudioComplianceItem): number {
  const wPx = it.wPx ?? 100;
  const hPx = it.hPx ?? 80;
  const wm = (wPx * it.scale) / 40;
  const hm = (hPx * it.scale) / 40;
  if (it.areaKind === "ellipse") return (Math.PI / 4) * wm * hm;
  if (it.areaKind === "rect") return wm * hm;
  if (it.t === "lawn" || it.t === "bed") return wm * hm * 0.85;
  if (it.t === "paving" || it.t === "deck") return wm * hm;
  return 0;
}

export function encodeDesignTodoSpec(triggerId: string, detail: string): string {
  return `${TRIGGER_PREFIX}${triggerId}\n${detail}`;
}

export function parseDesignTodoTrigger(
  spec: string | null | undefined,
): string | null {
  if (!spec || !spec.startsWith(TRIGGER_PREFIX)) return null;
  const rest = spec.slice(TRIGGER_PREFIX.length);
  const line = rest.split("\n")[0]?.trim();
  return line || null;
}

/**
 * Preliminary planning flags from the live handoff board (not catalog canvas).
 */
export function assessPlanningFromStudio(args: {
  address: string;
  outdoorM2: number;
  items: StudioComplianceItem[];
  municipality?: Municipality;
}): PlanningFlag[] {
  const flags: PlanningFlag[] = [];
  const municipality =
    args.municipality ?? detectMunicipality(args.address);
  const live = args.items.filter((i) => !i.ghost);

  if (municipality === "stonnington") {
    flags.push({
      id: "council-stonnington",
      category: "council",
      severity: "clear",
      title: "City of Stonnington",
      detail:
        "Address matches Stonnington — stormwater, permeability and tree rules apply as you design.",
    });
  } else if (municipality === "yarra") {
    flags.push({
      id: "council-yarra",
      category: "council",
      severity: "clear",
      title: "City of Yarra",
      detail:
        "Address matches Yarra — check heritage overlay and streetscape as garden works develop.",
    });
  } else {
    flags.push({
      id: "council-unknown",
      category: "council",
      severity: "review",
      title: "Confirm council",
      detail:
        "Municipality not inferred from address — confirm via Vicmap / planning certificate before lodgement.",
    });
  }

  const existTrees = live.filter((i) => i.t === "exist");
  const newCanopy = live.filter(
    (i) => i.t === "canopy" || i.t === "feature",
  );
  if (existTrees.length > 0) {
    flags.push({
      id: "trp-existing",
      category: "tree_protection",
      severity: "likely",
      title: "Tree root protection — existing trees",
      detail: `${existTrees.length} existing tree(s) on plan — arborist report, TPZ fencing and supervision likely before excavation (AS 4970).`,
      output_kind: "scope",
    });
  } else if (newCanopy.length > 0) {
    flags.push({
      id: "trp-nearby",
      category: "tree_protection",
      severity: "review",
      title: "Check nearby canopy / TRP",
      detail:
        "New trees on plan — confirm existing canopy on or off lot; works in root zones may need TRP.",
      output_kind: "scope",
    });
  }

  let hardM2 = 0;
  for (const it of live) {
    if (it.t === "paving" || it.t === "deck") hardM2 += itemAreaM2(it);
  }
  const hasDrain = live.some((i) => i.t === "frenchdrain");
  const hasDeck = live.some((i) => i.t === "deck");

  if (municipality === "stonnington" && (hardM2 >= 15 || hasDrain)) {
    flags.push({
      id: "stonnington-stormwater",
      category: "stormwater",
      severity: "likely",
      title: "Stonnington stormwater / drainage",
      detail: `Plan shows ~${Math.round(hardM2)} m² new hardscape${hasDrain ? " and french drain" : ""} — likely triggers stormwater quality/quantity review and legal point-of-discharge check.`,
      output_kind: "permit_stonnington_stormwater",
    });
  } else if (hardM2 >= 20) {
    flags.push({
      id: "stormwater-review",
      category: "stormwater",
      severity: "review",
      title: "Stormwater / impermeable area",
      detail: `About ${Math.round(hardM2)} m² hardscape on plan — confirm council stormwater thresholds and discharge point.`,
      output_kind: "scope",
    });
  }

  if (municipality === "yarra" && live.length > 0) {
    flags.push({
      id: "yarra-heritage",
      category: "heritage",
      severity: "review",
      title: "Yarra heritage / streetscape",
      detail:
        "Garden works in Yarra often need heritage-compatible materials — confirm overlay on the property certificate.",
      output_kind: "permit_yarra_heritage",
    });
  }

  if (hasDeck) {
    flags.push({
      id: "permits-deck",
      category: "permit",
      severity: "review",
      title: "Deck / elevated structure check",
      detail:
        "Timber deck on plan — confirm building permit triggers (height, setback, balustrade) with the relevant building surveyor.",
      output_kind: "scope",
    });
  }

  if (live.length > 0) {
    flags.push({
      id: "scope-design-live",
      category: "permit",
      severity: "review",
      title: "Scope permits before contract",
      detail:
        "Living design is for client discussion — council permits and TRP reports are separate deliverables before construction pricing locks.",
    });
  }

  return flags;
}

function priorityFor(
  severity: PlanningFlag["severity"] | ComplianceAlert["severity"],
): CreateTaskInput["priority"] {
  if (severity === "likely" || severity === "critical") return "high";
  if (severity === "watch") return "medium";
  return "medium";
}

/** Map planning flags + live compliance alerts into design-sourced todo drafts. */
export function planningToDesignTodos(
  flags: PlanningFlag[],
  alerts: ComplianceAlert[] = [],
): DesignTodoDraft[] {
  const drafts: DesignTodoDraft[] = [];
  const seen = new Set<string>();

  for (const f of flags) {
    if (f.severity === "clear") continue;
    // Skip the generic scope reminder — too noisy for the living list.
    if (f.id === "scope-design-live" || f.id === "scope-envelope") continue;
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    drafts.push({
      trigger_id: f.id,
      title: f.title,
      priority: priorityFor(f.severity),
      source: "design",
      technical_specifications: encodeDesignTodoSpec(f.id, f.detail),
    });
  }

  for (const a of alerts) {
    if (a.severity === "info") continue;
    const trigger = `alert-${a.code}`;
    if (seen.has(trigger)) continue;
    seen.add(trigger);
    drafts.push({
      trigger_id: trigger,
      title: a.title,
      priority: priorityFor(a.severity),
      source: "design",
      technical_specifications: encodeDesignTodoSpec(trigger, a.detail),
    });
  }

  return drafts;
}

export type DesignTodoDiff = {
  toCreate: DesignTodoDraft[];
  /** Pending design tasks whose trigger no longer applies. */
  toCancelIds: string[];
};

/** Diff proposed design todos against existing project tasks. */
export function diffDesignTodos(
  existing: Task[],
  proposed: DesignTodoDraft[],
): DesignTodoDiff {
  const openDesign = existing.filter(
    (t) =>
      t.source === "design" &&
      (t.status === "pending" ||
        t.status === "in_progress" ||
        t.status === "blocked"),
  );
  const byTrigger = new Map<string, Task>();
  for (const t of openDesign) {
    const id = parseDesignTodoTrigger(t.technical_specifications);
    if (id) byTrigger.set(id, t);
  }

  const proposedIds = new Set(proposed.map((p) => p.trigger_id));
  const toCreate = proposed.filter((p) => !byTrigger.has(p.trigger_id));
  const toCancelIds: string[] = [];
  for (const [trigger, task] of byTrigger) {
    if (!proposedIds.has(trigger) && task.status === "pending") {
      toCancelIds.push(task.id);
    }
  }
  return { toCreate, toCancelIds };
}

/** Flags worth a canvas prompt (likely permits / critical alerts). */
export function promptableDesignTodos(drafts: DesignTodoDraft[]): DesignTodoDraft[] {
  return drafts.filter(
    (d) => d.priority === "high" || d.priority === "critical",
  );
}
