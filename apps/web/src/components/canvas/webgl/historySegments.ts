/**
 * Phase P — history segmentation by activity (spec §8a).
 *
 * The scrub track is "segmented by activity". The segments used to be five
 * hardcoded bands of equal width, so a history of thirty grading steps still
 * drew a fifth of the track labelled "Planting" and scrubbing into it landed
 * somewhere else entirely. The bands now come from the history itself.
 *
 * Nothing tags a history entry with its activity — the undo stack holds plain
 * document snapshots (`docSnapshot`). So the activity is DERIVED: compare a
 * step against the one before it and name the slice that changed. That keeps
 * the store's snapshot shape untouched and cannot drift from what actually
 * happened, because it is read from what actually happened.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase P.
 */

import type { LandscapeFeature } from "@workstream/contracts";

/** The spec's named activity types. */
export type ActivitySegment =
  | "survey"
  | "grading"
  | "paving"
  | "planting"
  | "markup";

export const SEGMENT_LABEL: Record<ActivitySegment, string> = {
  survey: "Survey",
  grading: "Grading",
  paving: "Paving",
  planting: "Planting",
  markup: "Markup",
};

export const SEGMENT_COLOR: Record<ActivitySegment, string> = {
  survey: "var(--gs-truth)",
  grading: "var(--gs-conflict)",
  paving: "var(--lc-ink)",
  planting: "var(--lc-accent-terrain)",
  markup: "var(--lc-accent-redline)",
};

/**
 * The slices of a document snapshot this module reads. Structurally a subset
 * of the store's `historyPast` entries, so a snapshot passes straight in.
 */
export interface HistorySnapshotSlice {
  placements: readonly { id: string }[];
  strokes: readonly { id: string }[];
  photoElevations: readonly { id: string }[];
  features: readonly LandscapeFeature[];
  constructionTrenches: readonly { id: string }[];
  irrigationZones: readonly { id: string }[];
  canvases: readonly { id: string }[];
  setbackLines: readonly { id: string }[];
  buildingFootprints: readonly { id: string }[];
}

/** Hardscape-ish feature layers read as paving; everything else as planting. */
const PAVING_LAYERS = new Set(["hardscape", "structure"]);

function featureActivity(
  before: readonly LandscapeFeature[],
  after: readonly LandscapeFeature[],
): ActivitySegment | null {
  if (before.length === after.length) return null;
  const beforeIds = new Set(before.map((f) => f.id));
  const afterIds = new Set(after.map((f) => f.id));
  // Whichever side is longer holds the feature that moved.
  const moved =
    after.length > before.length
      ? after.find((f) => !beforeIds.has(f.id))
      : before.find((f) => !afterIds.has(f.id));
  if (!moved) return null;
  return PAVING_LAYERS.has(moved.metadata.layer) ? "paving" : "planting";
}

const lengthOf = (v: readonly unknown[]) => v.length;

/**
 * Name the activity that turned `before` into `after`.
 *
 * Ordered most-specific first: a step that adds a trench AND a stroke is a
 * grading step that happened to leave ink, not a markup step. Returns
 * "markup" when nothing recognisable changed — ink is the catch-all, and it
 * is the least misleading thing to claim about an unidentifiable edit.
 */
export function activityBetween(
  before: HistorySnapshotSlice,
  after: HistorySnapshotSlice,
): ActivitySegment {
  const changed = (
    pick: (s: HistorySnapshotSlice) => readonly unknown[],
  ): boolean => lengthOf(pick(before)) !== lengthOf(pick(after));

  if (
    changed((s) => s.canvases) ||
    changed((s) => s.setbackLines) ||
    changed((s) => s.buildingFootprints) ||
    changed((s) => s.photoElevations)
  ) {
    return "survey";
  }
  if (changed((s) => s.constructionTrenches) || changed((s) => s.irrigationZones)) {
    return "grading";
  }
  const fromFeature = featureActivity(before.features, after.features);
  if (fromFeature) return fromFeature;
  if (changed((s) => s.placements)) return "planting";
  return "markup";
}

/** One contiguous run of the same activity on the scrub track. */
export interface HistorySegment {
  activity: ActivitySegment;
  /** First step index this run covers (0-based, into the full step list). */
  startIdx: number;
  /** Number of steps in the run — drives the band's width. */
  steps: number;
}

/**
 * Build the track's segments from the real history.
 *
 * `steps` is the full ordered list of document states: past snapshots, then
 * the live document, then any redo states. Adjacent steps of the same derived
 * activity merge into one band, so the track reads as the session did.
 */
export function buildHistorySegments(
  steps: readonly HistorySnapshotSlice[],
): HistorySegment[] {
  if (steps.length === 0) return [];
  const out: HistorySegment[] = [];
  // The first step has nothing before it. It carries the activity of the
  // transition INTO the second step so the run it opens is not mislabelled;
  // a lone step is markup, the same catch-all as an unreadable diff.
  const first =
    steps.length > 1 ? activityBetween(steps[0]!, steps[1]!) : "markup";
  out.push({ activity: first, startIdx: 0, steps: 1 });
  for (let i = 1; i < steps.length; i++) {
    const activity = activityBetween(steps[i - 1]!, steps[i]!);
    const tail = out[out.length - 1]!;
    if (tail.activity === activity) {
      tail.steps += 1;
    } else {
      out.push({ activity, startIdx: i, steps: 1 });
    }
  }
  return out;
}

/** The activity at one step index, or null when the index is off the track. */
export function activityAt(
  segments: readonly HistorySegment[],
  idx: number,
): ActivitySegment | null {
  for (const seg of segments) {
    if (idx >= seg.startIdx && idx < seg.startIdx + seg.steps) return seg.activity;
  }
  return null;
}
