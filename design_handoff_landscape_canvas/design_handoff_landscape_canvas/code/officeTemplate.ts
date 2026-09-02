/** Office template (17a / 17b).
 *  Holds CONVENTIONS ONLY — no geometry, no site data, no design content.
 *  Three rules, all load-bearing:
 *    1. Binding is a REFERENCE, not a copy — fix a standard once, reach every bound project.
 *    2. Deviation is legal but never silent — every override names what, who, when, why.
 *    3. A new version is an OFFER WITH A DIFF — nothing changes until accepted, and sheets already
 *       issued keep the version they were issued at (which is why it is printed in the title block). */
import type { PackId } from './tradePacks';

export interface OfficeTemplate {
  id: string; name: string; version: number; publishedAt: string; publishedBy: string;
  planes: { name: string; z: number; state: 'existing' | 'proposed'; locked?: boolean }[];
  packs: { drafting: PackId; sketch: PackId };
  materials: string[];                                  // subset of the 21
  weights: { purpose: string; mm: number; signature: keyof typeof import('./tokens').signature }[];
  sheet: { size: 'A0' | 'A1' | 'A2' | 'A3'; scale: number; titleBlockFields: string[] };
  codes: { tree: string; bed: string; hardscape: string; startAt: number };
  defaults: { snapM: number; units: 'm'; northFromSheetUp: number; verticalExaggeration: number };
}

export interface Override<K extends keyof OfficeTemplate = keyof OfficeTemplate> {
  path: K; from: unknown; to: unknown;
  by: string; at: string; reason: string | null;        // null renders as "no reason given" — do not hide it
}

export interface Binding {
  projectId: string; templateId: string; boundVersion: number;
  overrides: Override[];
}

export const isClean = (b: Binding) => b.overrides.length === 0;

/** Title block string. The version must survive onto paper (17b). */
export const provenanceLine = (t: OfficeTemplate, b: Binding) =>
  `standard: ${t.name} v${b.boundVersion}${isClean(b) ? '' : ` · ${b.overrides.length} overrides`}`;

/* ---------- Version offers ---------- */

export interface Change {
  path: keyof OfficeTemplate; label: string;
  /** Stated consequence, computed against THIS drawing — never a bare "3 changes". */
  affects: string;
  conflictsWithOverride: boolean;
  /** Renumbering or anything touching an issued revision must default to unchecked. */
  destructive: boolean;
}

export function diffForProject(current: OfficeTemplate, next: OfficeTemplate, b: Binding): Change[] {
  const out: Change[] = [];
  for (const key of Object.keys(next) as (keyof OfficeTemplate)[]) {
    if (['id', 'name', 'version', 'publishedAt', 'publishedBy'].includes(key)) continue;
    if (JSON.stringify(current[key]) === JSON.stringify(next[key])) continue;
    out.push({
      path: key,
      label: key,
      affects: '',                                       // fill from geometry: "affects 14 runs"
      conflictsWithOverride: b.overrides.some((o) => o.path === key),
      destructive: key === 'codes',                      // renumbering an issued schedule
    });
  }
  return out;
}

export const defaultAccepted = (c: Change) => !c.destructive && !c.conflictsWithOverride;

/** Applying is one undoable batch (⌘Z reverts all of it) and never edits geometry —
 *  it re-renders bound drawings at their next open. */
export function applyAccepted(b: Binding, next: OfficeTemplate, accepted: Change[]): Binding {
  const acceptedPaths = new Set(accepted.map((c) => c.path));
  return {
    ...b,
    boundVersion: acceptedPaths.size ? next.version : b.boundVersion,
    overrides: b.overrides.filter((o) => !acceptedPaths.has(o.path)),
  };
}
