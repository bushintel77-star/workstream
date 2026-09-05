/**
 * Tier-1 brush state — session persistence of the last nib / material /
 * width / opacity per project (handover §4.5).
 *
 * Scope: the operator's ARMED TOOL state only — never drawing content.
 * Storage is sessionStorage keyed like the existing per-project UI state
 * (`ws-grid-studio:${projectId}`, `ws-design-branch:${projectId}`), so the
 * studio restores the operator's pen across reloads and project switches
 * within the session without widening the DesignCanvas document contract.
 *
 * Everything that leaves storage passes per-field validation against the
 * canons (nibs.ts, materials.ts) and the store setters' own clamps — stored
 * JSON is never trusted wholesale. The pure `sanitizeBrushPrefs` is
 * unit-testable without a storage backend.
 */

import type { NibKind } from "@workstream/contracts";
import { NIB_KINDS } from "./nibs";
import { materialById } from "./materials";

/** Same clamp as setBrushWidthOverride (studioStore). */
const WIDTH_PX_MIN = 0.5;
const WIDTH_PX_MAX = 40;
/** Same clamp as setBrushOpacity (studioStore). */
const OPACITY_MIN = 0.05;
const OPACITY_MAX = 1;

export interface BrushPrefs {
  nib?: NibKind;
  /** Material id, or null = the nib's default colour. */
  materialId?: string | null;
  /** Width override in px, or null = the nib's default width. */
  widthPx?: number | null;
  /** Opacity override 0.05–1, or null = the nib's base opacity. */
  opacity?: number | null;
}

const storageKey = (projectId: string) => `ws-brush-prefs:${projectId}`;

function num(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

/**
 * Validate stored JSON per field; unknown/out-of-range fields are dropped,
 * never coerced. Returns only the fields that survived.
 */
export function sanitizeBrushPrefs(raw: unknown): BrushPrefs {
  if (typeof raw !== "object" || raw === null) return {};
  const rec = raw as Record<string, unknown>;
  const out: BrushPrefs = {};
  if (typeof rec.nib === "string" && (NIB_KINDS as readonly string[]).includes(rec.nib)) {
    out.nib = rec.nib as NibKind;
  }
  if (rec.materialId === null) {
    out.materialId = null;
  } else if (typeof rec.materialId === "string" && materialById(rec.materialId)) {
    out.materialId = rec.materialId;
  }
  if (rec.widthPx === null) {
    out.widthPx = null;
  } else {
    const w = num(rec.widthPx, WIDTH_PX_MIN, WIDTH_PX_MAX);
    if (w != null) out.widthPx = w;
  }
  if (rec.opacity === null) {
    out.opacity = null;
  } else {
    const o = num(rec.opacity, OPACITY_MIN, OPACITY_MAX);
    if (o != null) out.opacity = o;
  }
  return out;
}

/** Read + validate the project's saved brush prefs. Null projectId → none. */
export function readBrushPrefs(projectId: string): BrushPrefs | null {
  if (!projectId) return null;
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const prefs = sanitizeBrushPrefs(JSON.parse(raw));
    return Object.keys(prefs).length > 0 ? prefs : null;
  } catch {
    // Corrupt or unreadable storage is a fallback to defaults, never an error
    // surface — the operator just gets the factory pen.
    return null;
  }
}

/** Persist the project's armed brush state (best-effort, guarded). */
export function writeBrushPrefs(projectId: string, prefs: BrushPrefs): void {
  if (!projectId) return;
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(projectId), JSON.stringify(prefs));
  } catch {
    /* quota / privacy mode — arm-state persistence is best-effort */
  }
}
