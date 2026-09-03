/**
 * Phase R — Office template (spec §17a/17b).
 *
 * The template holds CONVENTIONS ONLY — no geometry, no site data, no design
 * content. Three rules, all load-bearing:
 *   1. Binding is a REFERENCE, not a copy — fix a standard once, reach every
 *      bound project.
 *   2. Deviation is legal but never silent — every override names what, who,
 *      when, why.
 *   3. A new version is an OFFER WITH A DIFF — nothing changes until accepted,
 *      and sheets already issued keep the version they were issued at (which
 *      is why it is printed in the title block).
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase R.
 * Reference: design_handoff_landscape_canvas/.../code/officeTemplate.ts
 */

/** Trade pack ids (from the reference tradePacks module). */
export type PackId = "survey" | "cad" | "sketch";

/** The office template — conventions only, no geometry. */
export interface OfficeTemplate {
  id: string;
  name: string;
  version: number;
  publishedAt: string;
  publishedBy: string;
  planes: { name: string; z: number; state: "existing" | "proposed"; locked?: boolean }[];
  packs: { drafting: PackId; sketch: PackId };
  /** Subset of the 21-material palette ids. */
  materials: string[];
  weights: { purpose: string; mm: number; signature: string }[];
  sheet: { size: "A0" | "A1" | "A2" | "A3"; scale: number; titleBlockFields: string[] };
  codes: { tree: string; bed: string; hardscape: string; startAt: number };
  defaults: { snapM: number; units: "m"; northFromSheetUp: number; verticalExaggeration: number };
}

/** An override — deviation from the template, never silent. */
export interface Override<K extends keyof OfficeTemplate = keyof OfficeTemplate> {
  path: K;
  from: unknown;
  to: unknown;
  by: string;
  at: string;
  /** null renders as "no reason given" — do not hide it. */
  reason: string | null;
}

/** A project's binding to a template. */
export interface Binding {
  projectId: string;
  templateId: string;
  boundVersion: number;
  overrides: Override[];
}

export const isClean = (b: Binding) => b.overrides.length === 0;

/** Title block string. The version must survive onto paper (17b). */
export const provenanceLine = (t: OfficeTemplate, b: Binding) =>
  `standard: ${t.name} v${b.boundVersion}${isClean(b) ? "" : ` \u00b7 ${b.overrides.length} overrides`}`;

/* ---------- Version offers ---------- */

export interface Change {
  path: keyof OfficeTemplate;
  label: string;
  /** Stated consequence, computed against THIS drawing — never a bare "3 changes". */
  affects: string;
  conflictsWithOverride: boolean;
  /** Renumbering or anything touching an issued revision must default to unchecked. */
  destructive: boolean;
}

/** Diff two template versions for a project's binding. */
export function diffForProject(
  current: OfficeTemplate,
  next: OfficeTemplate,
  b: Binding,
): Change[] {
  const out: Change[] = [];
  for (const key of Object.keys(next) as (keyof OfficeTemplate)[]) {
    if (["id", "name", "version", "publishedAt", "publishedBy"].includes(key)) continue;
    if (JSON.stringify(current[key]) === JSON.stringify(next[key])) continue;
    out.push({
      path: key,
      label: key,
      affects: "",
      conflictsWithOverride: b.overrides.some((o) => o.path === key),
      destructive: key === "codes",
    });
  }
  return out;
}

/** Default acceptance: non-destructive, non-conflicting changes are accepted. */
export const defaultAccepted = (c: Change) => !c.destructive && !c.conflictsWithOverride;

/**
 * Applying is one undoable batch (Cmd+Z reverts all of it) and never edits
 * geometry — it re-renders bound drawings at their next open.
 */
export function applyAccepted(b: Binding, next: OfficeTemplate, accepted: Change[]): Binding {
  const acceptedPaths = new Set(accepted.map((c) => c.path));
  return {
    ...b,
    boundVersion: acceptedPaths.size ? next.version : b.boundVersion,
    overrides: b.overrides.filter((o) => !acceptedPaths.has(o.path)),
  };
}

/** The default office template — Curtis & Co house style. */
export const DEFAULT_TEMPLATE: OfficeTemplate = {
  id: "curtis-co-standard",
  name: "Curtis & Co standard",
  version: 1,
  publishedAt: "2026-01-01",
  publishedBy: "Curtis & Co",
  planes: [
    { name: "MAS", z: 4.0, state: "proposed" },
    { name: "PLT", z: 1.5, state: "proposed" },
    { name: "GRD", z: 0.0, state: "existing" },
    { name: "SUB", z: -0.6, state: "existing" },
  ],
  packs: { drafting: "cad", sketch: "sketch" },
  materials: [
    "moss", "sage", "olive", "chartreuse", "fern", "silver-foliage",
    "corten", "bluestone", "sandstone", "terracotta", "asphalt", "concrete",
    "water", "gravel", "mulch", "decomposed-granite",
    "setback", "gas", "services", "survey", "drafting",
  ],
  weights: [
    { purpose: "setback", mm: 0.5, signature: "setback" },
    { purpose: "gas", mm: 0.35, signature: "gas" },
    { purpose: "services", mm: 0.35, signature: "services" },
    { purpose: "survey", mm: 0.25, signature: "survey" },
    { purpose: "drafting", mm: 0.3, signature: "drafting" },
  ],
  sheet: {
    size: "A1",
    scale: 200,
    titleBlockFields: ["project", "sheet", "scale", "date", "rev", "north", "template"],
  },
  codes: { tree: "T", bed: "B", hardscape: "H", startAt: 1 },
  defaults: { snapM: 0.5, units: "m", northFromSheetUp: 0, verticalExaggeration: 1 },
};

/** Create a binding for a project. */
export function createBinding(projectId: string, template: OfficeTemplate): Binding {
  return {
    projectId,
    templateId: template.id,
    boundVersion: template.version,
    overrides: [],
  };
}

/** Add an override to a binding. */
export function addOverride<K extends keyof OfficeTemplate>(
  b: Binding,
  override: Omit<Override<K>, "path"> & { path: K },
): Binding {
  return {
    ...b,
    overrides: [...b.overrides, override as Override],
  };
}

/** Revert a single override by path. */
export function revertOverride(b: Binding, path: keyof OfficeTemplate): Binding {
  return {
    ...b,
    overrides: b.overrides.filter((o) => o.path !== path),
  };
}
