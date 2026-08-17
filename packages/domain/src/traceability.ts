/**
 * Automated traceability gate (Screen 1/4 rail — ground-truth rule).
 *
 * Scans BOM / quote outputs and flags any figure that lacks a ground-truth
 * source, or claims a source it cannot substantiate. This is the enforcement
 * artifact behind the "every estimate traceable to ground truth" rule in
 * PRODUCTION-ROADMAP-2026-08-17.md:
 *
 *   every figure must point at its source measurement; anything that can't is
 *   labelled `indicative` and never passed off as fact.
 *
 * The check is deliberately lenient toward the `indicative` label — that is
 * the honest escape hatch. It fails on:
 *   - `unlabelled`        — a figure with NO source at all (passed off as fact)
 *   - `unsubstantiated`   — claims a ground-truth source it can't back
 *                           (e.g. `boundary` area with no closed ring)
 *   - `empty_source_ids`  — an item/cad_qty figure that carries no source ids
 *
 * Wired into CI as `pnpm check:traceability` (runs the scenario matrix in
 * traceability.test.ts). Works on reports with or without the `trace` strip:
 * the cost-lines scan applies everywhere; the trace-strip scan activates as
 * soon as the live-BOM trace figures are present.
 */
import type { StudioEstimateLine } from "./studio-preemptive-estimate";

/**
 * Structural trace-figure shape — defined here (not imported) so the gate
 * compiles on reports with or without the live-BOM trace strip. Matches
 * StudioTraceFigure (studio-preemptive-estimate) once that lands.
 */
export type TraceFigureLike = {
  label: string;
  unit: string;
  qty: number;
  source: string | null;
  sourceIds: string[];
  note?: string;
};

export type TraceabilityViolationKind =
  | "unlabelled"
  | "unsubstantiated"
  | "empty_source_ids";

export type TraceabilityViolation = {
  kind: TraceabilityViolationKind;
  figure: string;
  source: string | null;
  detail: string;
};

/** Structural — the trace strip may be absent on older reports. */
export type TraceabilityReport = {
  lines?: StudioEstimateLine[];
  trace?: TraceFigureLike[];
};

/** Quote line shape the gate scans (matches ShareQuoteLine + quote doc rows). */
export type TraceabilityQuoteLine = {
  id: string;
  label: string;
  unit: string;
  qty: number;
};

/** Normalise a label for fuzzy source matching (lowercase, strip punctuation). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Scan a BOM report for figures lacking a ground-truth source. */
export function traceabilityViolations(
  report: TraceabilityReport,
): TraceabilityViolation[] {
  const violations: TraceabilityViolation[] = [];

  // 1. The curated trace strip (present once the live-BOM trace figures land).
  for (const f of report.trace ?? []) {
    if (!f.source) {
      violations.push({
        kind: "unlabelled",
        figure: f.label,
        source: null,
        detail: "Figure has no ground-truth source label.",
      });
      continue;
    }
    if (f.source === "indicative") {
      // Honest label — allowed. The rule is "traceable or labelled indicative",
      // never silently passed off as fact.
      continue;
    }
    if (f.source === "item" && f.sourceIds.length === 0) {
      violations.push({
        kind: "empty_source_ids",
        figure: f.label,
        source: f.source,
        detail: "Item-count figure carries no source item ids.",
      });
    } else if (f.source === "cad_qty" && f.sourceIds.length === 0 && f.qty > 0) {
      violations.push({
        kind: "empty_source_ids",
        figure: f.label,
        source: f.source,
        detail: "CAD-quantity figure carries no source ids.",
      });
    } else if (f.source === "boundary" && f.qty <= 0) {
      violations.push({
        kind: "unsubstantiated",
        figure: f.label,
        source: f.source,
        detail: "Boundary figure claims the title ring but the ring is not closed.",
      });
    }
  }

  // 2. BOM cost lines — every line must trace to placed items / zones.
  for (const l of report.lines ?? []) {
    if (l.total > 0 && l.sourceIds.length === 0) {
      violations.push({
        kind: "unlabelled",
        figure: l.label,
        source: null,
        detail: `BOM line '${l.label}' has no source ids.`,
      });
    }
  }

  return violations;
}

/** Throw when a BOM report contains any traceability violation. */
export function assertTraceability(report: TraceabilityReport): void {
  const violations = traceabilityViolations(report);
  if (violations.length > 0) {
    throw new Error(
      `Traceability violations (${violations.length}):\n` +
        violations
          .map((v) => `  - [${v.kind}] ${v.figure}: ${v.detail}`)
          .join("\n"),
    );
  }
}

/**
 * Scan quote lines against the sourced BOM lines they were generated from.
 * Every quote line must match a BOM line that itself carries source ids
 * (label + unit normalised match). A quote line that can't be matched to a
 * sourced BOM line is a figure passed off without provenance.
 */
export function quoteTraceabilityViolations(
  quoteLines: TraceabilityQuoteLine[],
  bomLines: StudioEstimateLine[],
): TraceabilityViolation[] {
  const violations: TraceabilityViolation[] = [];
  const sourced = bomLines.filter((l) => l.sourceIds.length > 0);
  for (const q of quoteLines) {
    const matched = sourced.some(
      (l) => l.unit === q.unit && norm(l.label) === norm(q.label),
    );
    if (!matched) {
      violations.push({
        kind: "unlabelled",
        figure: q.label,
        source: null,
        detail: `Quote line '${q.label}' (${q.unit}) does not match a sourced BOM line.`,
      });
    }
  }
  return violations;
}

/** Throw when any quote line lacks a traceable BOM source. */
export function assertQuoteTraceability(
  quoteLines: TraceabilityQuoteLine[],
  bomLines: StudioEstimateLine[],
): void {
  const violations = quoteTraceabilityViolations(quoteLines, bomLines);
  if (violations.length > 0) {
    throw new Error(
      `Quote traceability violations (${violations.length}):\n` +
        violations
          .map((v) => `  - [${v.kind}] ${v.figure}: ${v.detail}`)
          .join("\n"),
    );
  }
}
