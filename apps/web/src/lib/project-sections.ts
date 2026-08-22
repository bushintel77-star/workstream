/**
 * The project's non-canvas surfaces, and how a pathname maps onto them.
 *
 * Background: when the operator pipeline collapsed into one canvas (`0531c6d`,
 * then `7bf2040` "Remove pipeline chrome from design and CAD"), the masthead
 * that linked these surfaces went with it. The pages stayed, and
 * `2c647ed feat(web): complete premium frontend utility surfaces` went on
 * building them out afterwards — so audit, carbon, measurements and recordings
 * were finished, reading real API data, and reachable by nobody. This module is
 * the single list both the breadcrumb and the surface rail read from, so the
 * next chrome change moves them together instead of orphaning them again.
 *
 * Hrefs are written as complete template literals rather than assembled from
 * `${base}${item.path}` fragments. That is deliberate:
 * `scripts/check-route-reachability.mjs` can only see a route in a literal, so a
 * nav table built from fragments is invisible to the gate that exists to stop
 * this exact regression.
 */
import type { CanvasMode } from "./canvas-mode";

export type ProjectSurfaceGroup = "studios" | "records";

export type ProjectSurface = {
  /** Stable id; for `/projects/[id]/*` surfaces this is the path suffix. */
  id: string;
  label: string;
  /** One line of what the operator will find there. */
  hint: string;
  group: ProjectSurfaceGroup;
  href: (projectId: string) => string;
};

/**
 * Legacy pipeline URLs that now only `redirect()` onto the canvas. They render
 * no UI of their own, so the breadcrumb stays out of their way and the surface
 * rail never offers them as a destination.
 */
export const CANVAS_REDIRECT_SECTIONS: ReadonlySet<string> = new Set([
  "overview",
  "survey",
  "tasks",
  "filing",
  "costing",
  "design",
  "design/cad",
  "design/develop",
  "design/studio",
]);

/** Breadcrumb labels for every section that renders its own page. */
export const SECTION_LABELS: Readonly<Record<string, string>> = {
  audit: "Audit",
  carbon: "Carbon",
  measurements: "Measurements",
  outputs: "Outputs",
  processing: "Processing",
  recordings: "Recordings",
};

/**
 * Every project surface that lives outside the canvas, in the order an operator
 * meets them: look at the design over time, look under it, then the paperwork
 * it produces.
 *
 * The two 3D studios sit outside `/projects/[id]` on purpose — they own the full
 * viewport and must not be wrapped in `ProjectChrome` (see their page docblocks)
 * — but they are project surfaces, so they belong in this list.
 */
export const PROJECT_SURFACES: readonly ProjectSurface[] = [
  {
    id: "growth-studio",
    label: "Growth studio",
    hint: "Ten-year maturity of the planted design",
    group: "studios",
    href: (projectId) => `/growth-studio/${projectId}`,
  },
  {
    id: "subsurface-studio",
    label: "Subsurface studio",
    hint: "Trenches, irrigation, lighting and BYDA conflicts",
    group: "studios",
    href: (projectId) => `/subsurface-studio/${projectId}`,
  },
  {
    id: "outputs",
    label: "Outputs",
    hint: "Documents generated from the design",
    group: "records",
    href: (projectId) => `/projects/${projectId}/outputs`,
  },
  {
    id: "audit",
    label: "Audit",
    hint: "Design assurance findings and professional overrides",
    group: "records",
    href: (projectId) => `/projects/${projectId}/audit`,
  },
  {
    id: "carbon",
    label: "Carbon",
    hint: "Embodied carbon ledger for the priced scenario",
    group: "records",
    href: (projectId) => `/projects/${projectId}/carbon`,
  },
  {
    id: "measurements",
    label: "Measurements",
    hint: "Vision-measured quantities from site photos",
    group: "records",
    href: (projectId) => `/projects/${projectId}/measurements`,
  },
  {
    id: "recordings",
    label: "Recordings",
    hint: "Site voice notes and their transcripts",
    group: "records",
    href: (projectId) => `/projects/${projectId}/recordings`,
  },
];

export const SURFACE_GROUP_LABELS: Readonly<
  Record<ProjectSurfaceGroup, string>
> = {
  studios: "Studios",
  records: "Records",
};

/** Where the pipeline progress screen lives. */
export const processingHref = (projectId: string) =>
  `/projects/${projectId}/processing`;

/** Back to the drawing, in a given mode. */
export const canvasHref = (projectId: string, mode?: CanvasMode) =>
  mode ? `/projects/${projectId}?mode=${mode}` : `/projects/${projectId}`;

export type ProjectSection = {
  projectId: string;
  /** Path under `/projects/[id]`, e.g. `audit` or `design/cad`. */
  section: string;
  label: string;
  /** True when the section only redirects onto the canvas. */
  isCanvasRedirect: boolean;
};

/**
 * Read a project section out of a pathname, or `null` when the path is not a
 * project sub-route. `/projects/[id]` itself returns `null`: the canvas is the
 * project, not a section of it, and it renders its own full-viewport chrome.
 */
export function projectSectionFromPathname(
  pathname: string,
): ProjectSection | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "projects" || segments.length < 3) return null;
  const projectId = segments[1]!;
  const section = segments.slice(2).join("/");
  return {
    projectId,
    section,
    label: SECTION_LABELS[section] ?? section,
    isCanvasRedirect: CANVAS_REDIRECT_SECTIONS.has(section),
  };
}
