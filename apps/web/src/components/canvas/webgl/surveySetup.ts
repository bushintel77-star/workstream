/**
 * Gold Standard 2026 — Survey setup model (the one source of truth for "X/5").
 *
 * The Survey screen shows site-capture progress in two places: the unified
 * setup panel in the right dock, and a compact pill in the top chrome. Both
 * read this module, so the two can never disagree on the count.
 *
 * Completion is DERIVED from real project data — `surveyChecklistRows` reads
 * the traced boundary, the building ring, existing-tree placements, spot
 * levels and services/easements. Nothing here is a manual tick, so a row can
 * only go green when the data actually exists (zero-mock law).
 *
 * Each row also carries the action that completes it. Four of the five are
 * completed by the Vicmap site-truth import (boundary, dwelling footprint,
 * derived levels, title easements) — which is why the import is the panel's
 * dominant action rather than one option among many. Only existing trees are
 * an operator placement.
 *
 * Pure and unit-tested: no React, no DOM.
 */

import {
  surveyChecklistRows,
  type SurveyChecklistRow,
} from "../handoff/features/survey/surveyChecklistRows";
import type { SpotLevel, StudioItem } from "../handoff/studioCatalog";
import type { PctPoint } from "../handoff/geometry";

/** Where a row click routes the operator. */
export type SurveySetupAction = "import" | "assets";

export interface SurveySetupItem {
  /** Stable id for testids and click routing. */
  id: string;
  label: string;
  /** One-line explanation of what the row actually needs. */
  helper: string;
  done: boolean;
  action: SurveySetupAction;
  /** Verb for the row's affordance. */
  actionLabel: string;
}

export interface SurveySetup {
  items: SurveySetupItem[];
  done: number;
  total: number;
  complete: boolean;
}

export interface SurveySetupInput {
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  levels: SpotLevel[];
  services: PctPoint[][];
  easements?: PctPoint[][];
}

/**
 * Row metadata keyed by the checklist label. Keeping the labels as the join
 * key means `surveyChecklistRows` stays the single completion authority — this
 * module only decorates it.
 */
const ROW_META: Record<
  string,
  { id: string; helper: string; action: SurveySetupAction; actionLabel: string }
> = {
  "Boundary traced": {
    id: "boundary",
    helper: "Title parcel outline from the Vicmap cadastre",
    action: "import",
    actionLabel: "Import site truth",
  },
  "Existing dwelling": {
    id: "dwelling",
    helper: "House footprint from the Vicmap building layer",
    action: "import",
    actionLabel: "Import site truth",
  },
  "Existing trees": {
    id: "trees",
    helper: "Place the existing trees you have to retain",
    action: "assets",
    actionLabel: "Open assets",
  },
  "Spot levels": {
    id: "levels",
    helper: "Indicative levels derived from Vicmap contours",
    action: "import",
    actionLabel: "Import site truth",
  },
  "Services / easements": {
    id: "services",
    helper: "Title easements from Vicmap — digging still needs BYDA",
    action: "import",
    actionLabel: "Import site truth",
  },
};

function decorate(row: SurveyChecklistRow): SurveySetupItem {
  const meta = ROW_META[row.label];
  if (meta) {
    return {
      id: meta.id,
      label: row.label,
      helper: meta.helper,
      done: row.ok,
      action: meta.action,
      actionLabel: meta.actionLabel,
    };
  }
  /* A row added to the checklist without metadata still renders and still
   * counts — it just routes to the import, which is the broadest action. */
  return {
    id: row.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    label: row.label,
    helper: "Captured from the Vicmap site-truth import",
    done: row.ok,
    action: "import",
    actionLabel: "Import site truth",
  };
}

export function buildSurveySetup(input: SurveySetupInput): SurveySetup {
  const items = surveyChecklistRows(input).map(decorate);
  const done = items.filter((item) => item.done).length;
  return {
    items,
    done,
    total: items.length,
    complete: items.length > 0 && done === items.length,
  };
}

/** Progress as a 0–100 percentage, for the panel bar and the chrome pill. */
export function surveySetupPercent(setup: {
  done: number;
  total: number;
}): number {
  if (setup.total <= 0) return 0;
  return Math.round((setup.done / setup.total) * 100);
}
