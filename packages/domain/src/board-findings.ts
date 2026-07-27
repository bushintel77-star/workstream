/**
 * Cross-artefact findings over BoardContext v1.
 *
 * The existing horizon cards reason over one artefact at a time (this paving
 * item, this hardscape total). These findings reason *across* blocks — planting
 * against structures, trenches against subsurface assets, surfaces against
 * targets, design against quote, board against sheet — which is only possible
 * now that the board travels at full depth.
 *
 * Two rules hold throughout:
 *
 * - **Honest or silent.** A finding fires only when every input it needs is
 *   really on the board. No ground scale means no metre claims; no measured
 *   surfaces means no permeability verdict. Absent is reported by
 *   `boardContextGaps()`, never papered over with a default.
 * - **Cited.** Every finding carries the artefacts it reasoned over and the
 *   weakest provenance behind them, so a claim resting on a derived estimate
 *   reads weaker than one resting on Vicmap geometry. That citation is the
 *   guard against automation bias — the operator can check the working.
 *
 * Findings propose; they never mutate. Accept / Not now stays with the human.
 *
 * Domain-pure: no server imports.
 */

import type {
  BoardFinding,
  BoardFindingKind,
  BoardFindingSeverity,
} from "@workstream/contracts";
import type {
  BoardContext,
  BoardPlanting,
  BoardPoint,
  BoardProvenance,
} from "./board-context";

/* The wire shape is owned by the contracts boundary — this module computes it. */
export type { BoardFinding, BoardFindingKind, BoardFindingSeverity };

/** Mature canopy is judged closed when discs overlap past this share of reach. */
const CANOPY_OVERLAP_RATIO = 0.75;

/** Projected canopy over the outdoor area that starts shading turf out. */
const TURF_SHADE_CANOPY_PCT = 40;

/** Quote quantity may drift this far from the drawn area before it is a mismatch. */
const QUOTE_DRIFT_TOLERANCE = 0.1;

const SEVERITY_RANK: Record<BoardFindingSeverity, number> = {
  critical: 0,
  watch: 1,
  info: 2,
};

const PROVENANCE_RANK: Record<BoardProvenance, number> = {
  absent: 0,
  seed: 1,
  derived: 2,
  operator: 3,
  vicmap: 4,
};

/** The weakest link in the evidence chain is what the claim actually rests on. */
function weakest(ctx: BoardContext, blocks: string[]): BoardProvenance {
  let worst: BoardProvenance = "vicmap";
  for (const block of blocks) {
    const p = ctx.provenance[block] ?? "absent";
    if (PROVENANCE_RANK[p] < PROVENANCE_RANK[worst]) worst = p;
  }
  return worst;
}

function pctToM(dPct: number, scaleM: number): number {
  return (dPct / 100) * scaleM;
}

function mToPct(m: number, scaleM: number): number {
  return (m / scaleM) * 100;
}

/** Accepts board points in either `{x,y}` or raw `{x_pct,y_pct}` form. */
function readPoints(value: unknown): BoardPoint[] {
  if (!Array.isArray(value)) return [];
  const out: BoardPoint[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const x = typeof p.x === "number" ? p.x : p.x_pct;
    const y = typeof p.y === "number" ? p.y : p.y_pct;
    if (typeof x !== "number" || typeof y !== "number") continue;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ x, y });
  }
  return out;
}

function pointInRing(p: BoardPoint, ring: BoardPoint[]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    const hit =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (hit) inside = !inside;
  }
  return inside;
}

function distanceToSegment(p: BoardPoint, a: BoardPoint, b: BoardPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Does a disc centred on `p` reach the ring — inside it or across an edge? */
function discReachesRing(
  p: BoardPoint,
  radiusPct: number,
  ring: BoardPoint[],
): boolean {
  if (ring.length < 3) return false;
  if (pointInRing(p, ring)) return true;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    if (distanceToSegment(p, a, b) <= radiusPct) return true;
  }
  return false;
}

function segmentsCross(
  a1: BoardPoint,
  a2: BoardPoint,
  b1: BoardPoint,
  b2: BoardPoint,
): boolean {
  const orient = (p: BoardPoint, q: BoardPoint, r: BoardPoint) => {
    const v = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(v) < 1e-9) return 0;
    return v > 0 ? 1 : 2;
  };
  const o1 = orient(a1, a2, b1);
  const o2 = orient(a1, a2, b2);
  const o3 = orient(b1, b2, a1);
  const o4 = orient(b1, b2, a2);
  return o1 !== o2 && o3 !== o4;
}

function pathsCross(a: BoardPoint[], b: BoardPoint[]): boolean {
  for (let i = 0; i + 1 < a.length; i++) {
    for (let j = 0; j + 1 < b.length; j++) {
      if (segmentsCross(a[i]!, a[i + 1]!, b[j]!, b[j + 1]!)) return true;
    }
  }
  return false;
}

function canopyRadiusM(p: BoardPlanting): number | null {
  if (p.mature_spread_m == null || p.mature_spread_m <= 0) return null;
  return p.mature_spread_m / 2;
}

function totalCanopyM2(planting: BoardPlanting[]): number {
  let sum = 0;
  for (const p of planting) {
    const r = canopyRadiusM(p);
    if (r != null) sum += Math.PI * r * r;
  }
  return sum;
}

function labelOf(p: BoardPlanting): string {
  return p.species ?? p.code;
}

function pos(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const aud0 = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Placements share a schedule code (twelve of B14), so a code alone cannot
 * identify which one a finding is about. Position makes the citation checkable.
 */
function plantRef(p: BoardPlanting): string {
  return `${p.code} @ ${pos(p.x)}%,${pos(p.y)}%`;
}

function plantAt(p: BoardPlanting): string {
  return `${labelOf(p)} at ${pos(p.x)}%,${pos(p.y)}%`;
}

/* ---------------------------------------------------------------- canopy -- */

function canopyFindings(ctx: BoardContext): BoardFinding[] {
  const scaleM = ctx.meta.scale_m;
  const out: BoardFinding[] = [];
  const canopies = ctx.planting.filter((p) => canopyRadiusM(p) != null);
  if (canopies.length === 0) return out;

  const outdoor = ctx.geometry.outdoor_m2;
  const canopyM2 = totalCanopyM2(canopies);

  // Mature canopy over the dwelling — needs real ground scale and a real ring.
  if (scaleM != null && scaleM > 0 && ctx.geometry.building.length >= 3) {
    for (const p of canopies) {
      const radiusPct = mToPct(canopyRadiusM(p)!, scaleM);
      if (!discReachesRing({ x: p.x, y: p.y }, radiusPct, ctx.geometry.building)) {
        continue;
      }
      out.push({
        id: `bf-canopy-building-${p.code}-${p.x}-${p.y}`,
        kind: "canopy_conflict",
        severity: "watch",
        title: "Year-10 canopy reaches the dwelling",
        detail: `${plantAt(p)} carries ${p.mature_spread_m} m mature spread and closes over the existing dwelling footprint. Check gutter clearance and overshadowing before this goes to the client.`,
        cites: [plantRef(p), "geometry.building"],
        basis: weakest(ctx, ["planting", "building"]),
        x: p.x,
        y: p.y,
      });
    }
  }

  /*
   * Overplanting. Each tree contributes only its worst neighbour, so this stays
   * O(n) rather than reporting the whole n² matrix, and symmetric pairs collapse
   * — A crowding B is the same conflict as B crowding A.
   */
  if (scaleM != null && scaleM > 0) {
    const seenPairs = new Set<string>();
    for (const p of canopies) {
      const rp = canopyRadiusM(p)!;
      let worst: { other: BoardPlanting; gapM: number; reachM: number } | null =
        null;
      for (const q of canopies) {
        if (q === p) continue;
        const rq = canopyRadiusM(q)!;
        const gapM = pctToM(Math.hypot(p.x - q.x, p.y - q.y), scaleM);
        const reachM = rp + rq;
        if (gapM >= reachM * CANOPY_OVERLAP_RATIO) continue;
        if (!worst || gapM < worst.gapM) worst = { other: q, gapM, reachM };
      }
      if (!worst) continue;
      const pair = [plantRef(p), plantRef(worst.other)].sort();
      const key = pair.join(" | ");
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      out.push({
        id: `bf-canopy-crowd-${key}`,
        kind: "canopy_conflict",
        severity: "info",
        title: "Canopies close over each other at maturity",
        detail: `${plantAt(p)} and ${plantAt(worst.other)} sit ${worst.gapM.toFixed(1)} m apart against ${worst.reachM.toFixed(1)} m of combined mature reach — competition and thinning by Year 10.`,
        cites: pair,
        basis: weakest(ctx, ["planting"]),
        x: p.x,
        y: p.y,
      });
    }
  }

  // Turf priced under a closing canopy — the brief's own worked example.
  const lawn = ctx.surfaces.find(
    (s) => s.type === "lawn" && s.area_m2 != null && s.area_m2 > 0,
  );
  if (lawn && outdoor != null && outdoor > 0) {
    const closurePct = (canopyM2 / outdoor) * 100;
    if (closurePct >= TURF_SHADE_CANOPY_PCT) {
      out.push({
        id: "bf-canopy-turf",
        kind: "canopy_conflict",
        severity: "watch",
        title: "Turf sits under a closing canopy",
        detail: `Projected mature canopy covers about ${Math.round(closurePct)}% of ${Math.round(outdoor)} m² outdoor, over ${Math.round(lawn.area_m2!)} m² of turf. Turf under that shade thins out — consider a shade-tolerant groundcover for the affected run.`,
        cites: ["planting", "surfaces.lawn"],
        basis: weakest(ctx, ["planting", "surfaces"]),
      });
    }
  }

  // Canopy target shortfall against the council-style benchmark.
  const target = ctx.compliance.canopy_target;
  if (target != null && outdoor != null && outdoor > 0) {
    const canopyPct = (canopyM2 / outdoor) * 100;
    if (canopyPct < target) {
      out.push({
        id: "bf-canopy-target",
        kind: "canopy_conflict",
        severity: "watch",
        title: `Canopy cover short of ${target}% at maturity`,
        detail: `Projected canopy is about ${Math.round(canopyPct)}% of the outdoor area. Add structure planting or retain existing canopy to reach the benchmark.`,
        cites: ["planting", "compliance.canopy_target"],
        basis: weakest(ctx, ["planting", "compliance"]),
      });
    }
  }

  return out;
}

/* ------------------------------------------------------------------- dig -- */

type NamedPath = { id: string; label: string; points: BoardPoint[] };

function readTrenches(ctx: BoardContext): NamedPath[] {
  const out: NamedPath[] = [];
  for (const raw of ctx.systems.trenches) {
    if (!raw || typeof raw !== "object") continue;
    const t = raw as Record<string, unknown>;
    // Ghost trenches are proposals — they have not been accepted onto the board.
    if (t.ghost === true) continue;
    const points = readPoints(t.points);
    if (points.length < 2) continue;
    out.push({
      id: typeof t.id === "string" ? t.id : "trench",
      label:
        (typeof t.name === "string" && t.name.trim()) ||
        (typeof t.kind === "string" && t.kind) ||
        "trench",
      points,
    });
  }
  return out;
}

function readBydaAssets(ctx: BoardContext): NamedPath[] {
  const out: NamedPath[] = [];
  for (const raw of ctx.systems.byda_assets) {
    if (!raw || typeof raw !== "object") continue;
    const a = raw as Record<string, unknown>;
    const points = readPoints(a.ring);
    if (points.length < 2) continue;
    out.push({
      id: typeof a.id === "string" ? a.id : "byda",
      label: typeof a.kind === "string" ? a.kind : "utility",
      points,
    });
  }
  return out;
}

function digFindings(ctx: BoardContext): BoardFinding[] {
  const out: BoardFinding[] = [];
  const trenches = readTrenches(ctx);
  if (trenches.length === 0) return out;

  const byda = readBydaAssets(ctx);
  const services: NamedPath[] = ctx.systems.services.map((points, i) => ({
    id: `service-${i}`,
    label: "service corridor",
    points,
  }));
  const easements: NamedPath[] = ctx.systems.easements.map((points, i) => ({
    id: `easement-${i}`,
    label: "title easement",
    points,
  }));

  for (const trench of trenches) {
    for (const asset of [...byda, ...services, ...easements]) {
      if (!pathsCross(trench.points, asset.points)) continue;
      const isByda = byda.includes(asset);
      out.push({
        id: `bf-dig-${trench.id}-${asset.id}`,
        kind: "dig_conflict",
        severity: "critical",
        title: isByda
          ? "Trench crosses a located utility"
          : "Trench crosses a service corridor",
        detail: `${trench.label} crosses the traced ${asset.label}. Confirm-locate and hand-dig the crossing before any machine work — indicative board geometry is not a locate.`,
        cites: [trench.id, asset.id],
        basis: weakest(ctx, ["systems"]),
        x: trench.points[0]!.x,
        y: trench.points[0]!.y,
      });
    }
  }

  if (byda.length === 0) {
    out.push({
      id: "bf-dig-no-byda",
      kind: "dig_conflict",
      severity: "watch",
      title: "Trenches drawn with no located assets on the board",
      detail: `${trenches.length} trench run(s) are on the plan but no BYDA asset has been traced. The board cannot show a conflict it has never been told about — get the locate before pricing excavation.`,
      cites: trenches.map((t) => t.id),
      basis: weakest(ctx, ["systems"]),
    });
  }

  return out;
}

/* ---------------------------------------------------------- permeability -- */

function permeabilityFindings(ctx: BoardContext): BoardFinding[] {
  const out: BoardFinding[] = [];
  const target = ctx.compliance.permeability_target;
  const outdoor = ctx.geometry.outdoor_m2;
  if (target == null || outdoor == null || outdoor <= 0) return out;

  const sealed = ctx.surfaces.filter(
    (s) => s.permeable === false && s.area_m2 != null && s.area_m2 > 0,
  );
  if (sealed.length === 0) return out;

  const sealedM2 = sealed.reduce((sum, s) => sum + (s.area_m2 ?? 0), 0);
  const permeablePct = Math.max(0, 100 - (sealedM2 / outdoor) * 100);
  if (permeablePct >= target) return out;

  out.push({
    id: "bf-permeability",
    kind: "permeability",
    severity: "critical",
    title: `Permeability below ${target}%`,
    detail: `${Math.round(sealedM2)} m² of sealed surface across ${sealed.map((s) => s.material ?? s.type).join(", ")} leaves about ${Math.round(permeablePct)}% of ${Math.round(outdoor)} m² permeable. Reduce the sealed run or add permeable treatment before lodgement.`,
    cites: sealed.map((s) => s.material ?? s.type),
    basis: weakest(ctx, ["surfaces", "compliance"]),
  });
  return out;
}

/* ----------------------------------------------------------------- quote -- */

function quoteFindings(ctx: BoardContext): BoardFinding[] {
  const out: BoardFinding[] = [];
  const lines = ctx.commercial.quote_lines;
  const drawn = ctx.planting.length + ctx.surfaces.length;
  if (drawn === 0) return out;

  if (lines.length === 0) {
    out.push({
      id: "bf-quote-uncosted",
      kind: "quote_mismatch",
      severity: "watch",
      title: "Board is drawn but not costed",
      detail: `${ctx.planting.length} planting placement(s) and ${ctx.surfaces.length} surface(s) carry no priced line. The client cannot be shown this board as a quote yet.`,
      cites: ["planting", "surfaces"],
      basis: weakest(ctx, ["planting", "surfaces"]),
    });
    return out;
  }

  // Drawn turf area against the quoted turf quantity.
  const lawn = ctx.surfaces.find(
    (s) => s.type === "lawn" && s.area_m2 != null && s.area_m2 > 0,
  );
  const turfLine = lines.find(
    (l) => /turf|lawn/i.test(l.label) && /m2|m²/i.test(l.unit),
  );
  if (lawn && turfLine && turfLine.qty > 0) {
    const area = lawn.area_m2!;
    const drift = Math.abs(turfLine.qty - area) / area;
    if (drift > QUOTE_DRIFT_TOLERANCE) {
      out.push({
        id: "bf-quote-turf-drift",
        kind: "quote_mismatch",
        severity: "watch",
        title: "Turf quantity does not match the drawn area",
        detail: `The plan carries about ${Math.round(area)} m² of turf; "${turfLine.label}" prices ${turfLine.qty} ${turfLine.unit}. One of the two is stale.`,
        cites: ["surfaces.lawn", turfLine.label],
        basis: weakest(ctx, ["surfaces", "commercial"]),
      });
    }
  }

  // Planting carrying a SKU that never reaches a priced line.
  const unpriced = new Set<string>();
  for (const p of ctx.planting) {
    if (!p.rate_card_sku) continue;
    const sku = p.rate_card_sku.toLowerCase();
    const priced = lines.some((l) => l.label.toLowerCase().includes(sku));
    if (!priced) unpriced.add(p.rate_card_sku);
  }
  if (unpriced.size > 0) {
    const codes = [...unpriced].sort();
    out.push({
      id: "bf-quote-unpriced-planting",
      kind: "quote_mismatch",
      severity: "watch",
      title: "Planting on the plan has no priced line",
      detail: `${codes.join(", ")} ${codes.length === 1 ? "appears" : "appear"} on the board but not in the quote. Either the quote predates the planting or the lines were dropped.`,
      cites: codes,
      basis: weakest(ctx, ["planting", "commercial"]),
    });
  }

  return out;
}

/* ----------------------------------------------------------------- sheet -- */

function sheetFindings(ctx: BoardContext): BoardFinding[] {
  const out: BoardFinding[] = [];
  const drawn = ctx.planting.length + ctx.surfaces.length;
  if (drawn === 0) return out;

  if (ctx.sheet.theme == null && ctx.sheet.widgets.length === 0) {
    out.push({
      id: "bf-sheet-none",
      kind: "sheet_gap",
      severity: "info",
      title: "No sheet set assembled",
      detail:
        "The board has content but no presentation pack. Nothing here is client-ready until a sheet is laid up.",
      cites: ["sheet"],
      basis: weakest(ctx, ["sheet"]),
    });
    return out;
  }

  const widgets = new Set(ctx.sheet.widgets);
  if (ctx.commercial.quote_lines.length > 0 && !widgets.has("quote_total")) {
    out.push({
      id: "bf-sheet-no-quote",
      kind: "sheet_gap",
      severity: "watch",
      title: "Priced board with no quote on the sheet",
      detail: `${
        ctx.commercial.total_incl_gst != null
          ? `The quote totals ${aud0(ctx.commercial.total_incl_gst)} incl GST`
          : "The board carries priced lines"
      } but the sheet has no quote widget — the client sees a drawing with no number.`,
      cites: ["sheet.widgets", "commercial"],
      basis: weakest(ctx, ["sheet", "commercial"]),
    });
  }
  if (ctx.planting.length > 0 && !widgets.has("zone_summary")) {
    out.push({
      id: "bf-sheet-no-zones",
      kind: "sheet_gap",
      severity: "info",
      title: "Planting drawn with no zone summary on the sheet",
      detail:
        "A zone summary is what makes a planting plan readable to the client. Worth adding before issue.",
      cites: ["sheet.widgets", "planting"],
      basis: weakest(ctx, ["sheet", "planting"]),
    });
  }

  return out;
}

/**
 * Findings the board can support, worst first. Deterministic: the same board
 * always yields the same list in the same order.
 */
export function buildBoardFindings(ctx: BoardContext): BoardFinding[] {
  return [
    ...canopyFindings(ctx),
    ...digFindings(ctx),
    ...permeabilityFindings(ctx),
    ...quoteFindings(ctx),
    ...sheetFindings(ctx),
  ].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.kind.localeCompare(b.kind) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Prompt block for the assist. Findings arrive pre-computed and cited so the
 * model reasons from the board rather than inventing consequence, and so any
 * statement it makes can be traced back to an artefact.
 */
export function formatBoardFindingsForAi(findings: BoardFinding[]): string {
  if (findings.length === 0) {
    return "BOARD FINDINGS: none — the board supports no cross-artefact finding yet.";
  }
  const lines = findings.map(
    (f) =>
      `- [${f.severity.toUpperCase()}] ${f.title}: ${f.detail} (cites: ${f.cites.join(", ")}; basis: ${f.basis})`,
  );
  return [
    "BOARD FINDINGS (deterministic, computed from the context above — cite these rather than restating them):",
    ...lines,
  ].join("\n");
}
