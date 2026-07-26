import type {
  QuoteCustomLine,
  QuoteDoc,
  QuoteMargin,
  QuoteOverride,
  QuoteSectionId,
  ShareQuoteLine,
} from "@workstream/contracts";
import { calculateGST, calculateLineTotal } from "./costing";
import type { StudioEstimateLine, StudioEstimateTier } from "./studio-preemptive-estimate";

export type QuoteEngineLine = {
  id: string;
  label: string;
  unit: string;
  qty: number;
  rate: number;
  total: number;
  notes?: string;
  /** Optional rate-card SKU when known. */
  sku?: string;
  tier?: StudioEstimateTier;
  sectionHint?: QuoteSectionId;
};

export type ResolvedQuoteLine = {
  id: string;
  line_id: string;
  sku?: string;
  label: string;
  unit: string;
  qty: number;
  rate: number;
  /** Line total before margin (ex GST). */
  total: number;
  /** Total after section + global margin (ex GST). */
  totalAfterMargin: number;
  section: QuoteSectionId;
  notes?: string;
  excluded: boolean;
  is_provisional: boolean;
  is_custom: boolean;
  is_alternate: boolean;
  alternate_of?: string;
  alternate_selected: boolean;
  engine_qty: number;
  engine_rate: number;
  overridden: boolean;
};

export type ResolvedQuoteSection = {
  id: QuoteSectionId;
  label: string;
  lines: ResolvedQuoteLine[];
  subtotal: number;
};

export type ResolveQuoteResult = {
  sections: ResolvedQuoteSection[];
  lines: ResolvedQuoteLine[];
  /** Engine lines present before overrides. */
  subtotalExGst: number;
  marginAmount: number;
  /** Subtotal after margin, before GST (excludes struck + unselected alts). */
  taxableExGst: number;
  gst: number;
  totalInclGst: number;
  /** Overrides whose line_id (or sku) no longer matches the engine. */
  orphanOverrides: QuoteOverride[];
};

const SECTION_LABEL: Record<QuoteSectionId, string> = {
  sitework: "Sitework",
  hardscape: "Hardscape",
  planting: "Planting",
  drainage: "Drainage",
  provisional: "Provisional",
  custom: "Custom",
};

const SECTION_ORDER: QuoteSectionId[] = [
  "sitework",
  "hardscape",
  "planting",
  "drainage",
  "provisional",
  "custom",
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sectionForEstimateTier(
  tier: StudioEstimateTier | undefined,
  label: string,
): QuoteSectionId {
  const hay = label.toLowerCase();
  if (/drain|trench|ag pipe|pit/.test(hay)) return "drainage";
  if (/paving|deck|bluestone|hardscape|wall|edge/.test(hay)) return "hardscape";
  if (/plant|tree|hedge|lawn|bed|flora|canopy/.test(hay)) return "planting";
  if (tier === "logistics" || tier === "labour" || tier === "fee") {
    return "sitework";
  }
  if (tier === "secondary" || tier === "tertiary") return "sitework";
  return "sitework";
}

export function engineLinesFromStudioEstimate(
  lines: StudioEstimateLine[],
): QuoteEngineLine[] {
  return lines.map((l) => ({
    id: l.id,
    label: l.label,
    unit: l.unit,
    qty: l.qty,
    rate: l.rate,
    total: l.total,
    notes: l.notes,
    tier: l.tier,
    sectionHint: sectionForEstimateTier(l.tier, l.label),
  }));
}

function marginPctFor(
  section: QuoteSectionId,
  margin: QuoteMargin,
): number {
  const sectionPct = margin.by_section?.[section] ?? 0;
  return (margin.global_pct ?? 0) + sectionPct;
}

function applyMargin(total: number, pct: number): number {
  return round2(total * (1 + pct / 100));
}

/**
 * Merge live estimate lines with a QuoteDoc overlay.
 * Never mutates the engine — orphans are surfaced, not dropped.
 */
export function resolveQuote(
  engineLines: QuoteEngineLine[],
  doc: Pick<QuoteDoc, "overrides" | "custom_lines" | "margin">,
): ResolveQuoteResult {
  const overrides = doc.overrides ?? [];
  const byLineId = new Map(
    overrides.filter((o) => o.line_id).map((o) => [o.line_id, o]),
  );
  const matched = new Set<string>();

  const resolved: ResolvedQuoteLine[] = [];

  for (const eng of engineLines) {
    const ov = byLineId.get(eng.id);
    if (ov) matched.add(eng.id);
    const qty = ov?.qty ?? eng.qty;
    const rate = ov?.rate ?? eng.rate;
    const total = calculateLineTotal(qty, rate);
    const section =
      ov?.section ??
      eng.sectionHint ??
      sectionForEstimateTier(eng.tier, eng.label);
    const excluded = Boolean(ov?.excluded);
    const isAlternate = Boolean(ov?.alternate_of);
    const alternateSelected = Boolean(ov?.alternate_selected);
    const pct = marginPctFor(section, doc.margin);
    const totalAfterMargin = applyMargin(total, pct);
    resolved.push({
      id: eng.id,
      line_id: eng.id,
      sku: ov?.sku ?? eng.sku,
      label: eng.label,
      unit: eng.unit,
      qty,
      rate,
      total,
      totalAfterMargin,
      section: ov?.is_provisional ? "provisional" : section,
      notes: ov?.notes ?? eng.notes,
      excluded,
      is_provisional: Boolean(ov?.is_provisional),
      is_custom: false,
      is_alternate: isAlternate,
      alternate_of: ov?.alternate_of,
      alternate_selected: alternateSelected,
      engine_qty: eng.qty,
      engine_rate: eng.rate,
      overridden: Boolean(
        ov &&
          (ov.qty != null ||
            ov.rate != null ||
            ov.notes != null ||
            ov.excluded != null ||
            ov.is_provisional != null ||
            ov.section != null),
      ),
    });
  }

  for (const custom of doc.custom_lines ?? []) {
    const total = calculateLineTotal(custom.qty, custom.rate);
    const section = custom.section ?? "custom";
    const pct = marginPctFor(section, doc.margin);
    resolved.push({
      id: custom.id,
      line_id: custom.id,
      sku: custom.sku,
      label: custom.label,
      unit: custom.unit,
      qty: custom.qty,
      rate: custom.rate,
      total,
      totalAfterMargin: applyMargin(total, pct),
      section,
      notes: custom.notes,
      excluded: false,
      is_provisional: Boolean(custom.is_provisional),
      is_custom: true,
      is_alternate: false,
      alternate_selected: false,
      engine_qty: custom.qty,
      engine_rate: custom.rate,
      overridden: false,
    });
  }

  const contributes = (l: ResolvedQuoteLine) => {
    if (l.excluded) return false;
    if (l.is_alternate && !l.alternate_selected) return false;
    return true;
  };

  const taxableLines = resolved.filter(contributes);
  const subtotalExGst = round2(
    engineLines.reduce((s, l) => s + l.total, 0),
  );
  const taxableExGst = round2(
    taxableLines.reduce((s, l) => s + l.totalAfterMargin, 0),
  );
  const preMarginTaxable = round2(
    taxableLines.reduce((s, l) => s + l.total, 0),
  );
  const marginAmount = round2(taxableExGst - preMarginTaxable);
  const gst = round2(calculateGST(taxableExGst));
  const totalInclGst = round2(taxableExGst + gst);

  const sections: ResolvedQuoteSection[] = SECTION_ORDER.map((id) => {
    const lines = resolved.filter((l) => l.section === id);
    return {
      id,
      label: SECTION_LABEL[id],
      lines,
      subtotal: round2(
        lines.filter(contributes).reduce((s, l) => s + l.totalAfterMargin, 0),
      ),
    };
  }).filter((s) => s.lines.length > 0);

  const orphanOverrides = overrides.filter((o) => !matched.has(o.line_id));

  return {
    sections,
    lines: resolved,
    subtotalExGst,
    marginAmount,
    taxableExGst,
    gst,
    totalInclGst,
    orphanOverrides,
  };
}

/** Map resolved quote → thin ShareRevision quote lines (ex-GST line totals). */
export function quoteDocToShareLines(
  resolved: ResolveQuoteResult,
  cap = 18,
): ShareQuoteLine[] {
  return resolved.lines
    .filter((l) => !l.excluded && (!l.is_alternate || l.alternate_selected))
    .filter((l) => l.total > 0)
    .slice(0, cap)
    .map((l) => ({
      id: l.id,
      label: l.label,
      unit: l.unit,
      qty: l.qty,
      total: l.totalAfterMargin,
    }));
}

export function emptyQuoteDoc(
  projectId: string,
  designId?: string | null,
): QuoteDoc {
  return {
    project_id: projectId,
    design_id: designId ?? null,
    overrides: [],
    custom_lines: [],
    margin: { global_pct: 0, by_section: {} },
    updated_at: new Date().toISOString(),
  };
}

export type { QuoteCustomLine, QuoteDoc, QuoteMargin, QuoteOverride, QuoteSectionId };
