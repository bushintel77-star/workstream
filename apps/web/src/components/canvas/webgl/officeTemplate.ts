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

/** Human label per template path — the diff row's heading. */
const PATH_LABEL: Partial<Record<keyof OfficeTemplate, string>> = {
  planes: "Plane stack",
  packs: "Trade packs",
  materials: "Material palette",
  weights: "Line weights",
  sheet: "Sheet setup",
  codes: "Asset codes",
  defaults: "Drawing defaults",
};

/** Counts from the drawing the offer is being made against, so `affects` can
 *  state a consequence rather than a bare "3 changes". */
export interface DrawingCounts {
  trees?: number;
  beds?: number;
  hardscape?: number;
  sheets?: number;
  issuedSheets?: number;
  strokes?: number;
}

/**
 * State the consequence of one change against THIS drawing. Never returns an
 * empty string — an unstated consequence is the thing the Change contract
 * exists to prevent.
 */
export function describeChange(
  current: OfficeTemplate,
  next: OfficeTemplate,
  key: keyof OfficeTemplate,
  counts: DrawingCounts = {},
): string {
  switch (key) {
    case "codes": {
      const coded =
        (counts.trees ?? 0) + (counts.beds ?? 0) + (counts.hardscape ?? 0);
      const issued = counts.issuedSheets ?? 0;
      const scope = coded > 0 ? `${coded} coded item${coded === 1 ? "" : "s"}` : "every coded item";
      return issued > 0
        ? `renumbers ${scope}; ${issued} already-issued sheet${issued === 1 ? "" : "s"} would disagree with the set`
        : `renumbers ${scope}`;
    }
    case "materials": {
      const before = new Set(current.materials);
      const after = new Set(next.materials);
      const added = next.materials.filter((m) => !before.has(m)).length;
      const removed = current.materials.filter((m) => !after.has(m)).length;
      const parts: string[] = [];
      if (added) parts.push(`${added} added`);
      if (removed) parts.push(`${removed} withdrawn`);
      const strokes = counts.strokes ?? 0;
      const tail = removed > 0 && strokes > 0
        ? `; strokes using a withdrawn material keep their colour and lose the standard`
        : "";
      return `${parts.join(", ") || "reordered"}${tail}`;
    }
    case "sheet": {
      const c = current.sheet;
      const n = next.sheet;
      const bits: string[] = [];
      if (c.size !== n.size) bits.push(`${c.size} → ${n.size}`);
      if (c.scale !== n.scale) bits.push(`1:${c.scale} → 1:${n.scale}`);
      if (JSON.stringify(c.titleBlockFields) !== JSON.stringify(n.titleBlockFields)) {
        bits.push("title block fields change");
      }
      const sheets = counts.sheets ?? 0;
      const on = sheets > 0 ? ` on ${sheets} sheet${sheets === 1 ? "" : "s"}` : "";
      return `${bits.join(", ") || "sheet setup changes"}${on}`;
    }
    case "weights": {
      const byPurpose = new Map(current.weights.map((w) => [w.purpose, w.mm]));
      const changed = next.weights.filter((w) => byPurpose.get(w.purpose) !== w.mm);
      return changed.length
        ? changed
          .map((w) => `${w.purpose} ${byPurpose.get(w.purpose) ?? "—"}mm → ${w.mm}mm`)
          .join(", ")
        : "line weight set changes";
    }
    case "planes":
      return `${current.planes.length} → ${next.planes.length} planes (${next.planes.map((p) => p.name).join("/")})`;
    case "defaults": {
      const c = current.defaults;
      const n = next.defaults;
      const bits: string[] = [];
      if (c.snapM !== n.snapM) bits.push(`snap ${c.snapM}m → ${n.snapM}m`);
      if (c.northFromSheetUp !== n.northFromSheetUp) {
        bits.push(`north ${c.northFromSheetUp}° → ${n.northFromSheetUp}°`);
      }
      if (c.verticalExaggeration !== n.verticalExaggeration) {
        bits.push(`vertical ×${c.verticalExaggeration} → ×${n.verticalExaggeration}`);
      }
      return bits.join(", ") || "drawing defaults change";
    }
    case "packs":
      return `drafting ${current.packs.drafting} → ${next.packs.drafting}, sketch ${current.packs.sketch} → ${next.packs.sketch}`;
    default:
      return `${String(key)} changes`;
  }
}

/** Diff two template versions for a project's binding. */
export function diffForProject(
  current: OfficeTemplate,
  next: OfficeTemplate,
  b: Binding,
  counts: DrawingCounts = {},
): Change[] {
  const out: Change[] = [];
  for (const key of Object.keys(next) as (keyof OfficeTemplate)[]) {
    if (["id", "name", "version", "publishedAt", "publishedBy"].includes(key)) continue;
    if (JSON.stringify(current[key]) === JSON.stringify(next[key])) continue;
    out.push({
      path: key,
      label: PATH_LABEL[key] ?? key,
      affects: describeChange(current, next, key, counts),
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
 *
 * The binding only advances to `next.version` when EVERY offered change was
 * accepted. Partial acceptance previously claimed the whole version, so
 * `provenanceLine` printed "standard: Curtis & Co standard v2" onto a title
 * block whose drawing was still following v1 for the rejected paths — a
 * false provenance claim on an issued sheet. A partial acceptance keeps the
 * old version and records the rejected paths as overrides, which is what a
 * deviation from the standard IS (rule 2: never silent).
 */
export function applyAccepted(
  b: Binding,
  next: OfficeTemplate,
  accepted: Change[],
  offered: Change[] = accepted,
  by = "unknown",
  at: string = new Date().toISOString(),
): Binding {
  const acceptedPaths = new Set(accepted.map((c) => c.path));
  const rejected = offered.filter((c) => !acceptedPaths.has(c.path));
  const full = acceptedPaths.size > 0 && rejected.length === 0;
  // Accepting a change supersedes any override on that path; rejecting one
  // creates an override, because the drawing now deliberately differs from
  // the version it would otherwise be on.
  const kept = b.overrides.filter((o) => !acceptedPaths.has(o.path));
  const newOverrides: Override[] = full
    ? []
    : rejected
      .filter((c) => !kept.some((o) => o.path === c.path))
      .map((c) => ({
        path: c.path,
        from: next[c.path],
        to: b.boundVersion,
        by,
        at,
        reason: `declined ${c.label} from v${next.version}`,
      }));
  return {
    ...b,
    boundVersion: full ? next.version : b.boundVersion,
    overrides: [...kept, ...newOverrides],
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
