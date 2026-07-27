/**
 * Export liability overlay over BoardContext v1.
 *
 * A drawing that leaves the practice carries claims about the ground it was
 * drawn on. The board already knows which ones: it knows the plan depicts
 * canopy at mature spread, that trenches were drawn over ground nobody has
 * located, that a protected tree sits inside the works, that a pool went on
 * without a barrier. So it can say which notice the issued set needs, instead
 * of relying on someone remembering at the moment of sending.
 *
 * Three rules hold throughout:
 *
 * - **Prompted, never applied.** These are proposals in exactly the sense a
 *   ghost is. Wording that goes to a client is the practice's to approve, and
 *   nothing here mutates the board or the issued set.
 * - **Triggered by content, not by ritual.** Each disclaimer names what on the
 *   board called for it. A notice that fires on every export teaches operators
 *   to click past all of them.
 * - **Cited.** Every notice carries the artefacts behind it and the weakest
 *   provenance among them, so the operator can check whether the trigger is
 *   real before putting the wording in front of a client.
 *
 * The notices are drafting starting points reflecting ordinary Australian
 * practice; they are not legal advice and the practice's own terms govern.
 *
 * Domain-pure: no server imports.
 */

import type { BoardDisclaimer, BoardDisclaimerKind } from "@workstream/contracts";
import type { BoardContext, BoardProvenance } from "./board-context";

/* The wire shape is owned by the contracts boundary — this module computes it. */
export type { BoardDisclaimer, BoardDisclaimerKind };

/** Planning flag id raised when tree protection is in play (AS 4970). */
const TRP_FLAG_ID = "trp-as4970";

/** Planning flag id raised by retaining or pool — the structural/safety hook. */
const STRUCTURAL_FLAG_ID = "permits-structural";

/** Surface materials that mean excavation, and so mean subsurface exposure. */
const EXCAVATING_MATERIAL = /retaining|pool|footing|drain|pier|paving|deck/i;

const PROVENANCE_RANK: Record<BoardProvenance, number> = {
  absent: 0,
  seed: 1,
  derived: 2,
  operator: 3,
  vicmap: 4,
};

/** The weakest link in the evidence chain is what the notice actually rests on. */
function weakest(ctx: BoardContext, blocks: string[]): BoardProvenance {
  let worst: BoardProvenance = "vicmap";
  for (const block of blocks) {
    const p = ctx.provenance[block] ?? "absent";
    if (PROVENANCE_RANK[p] < PROVENANCE_RANK[worst]) worst = p;
  }
  return worst;
}

function hasFlag(ctx: BoardContext, id: string): boolean {
  return ctx.compliance.flags.some((f) => f.id === id);
}

function materialMatches(ctx: BoardContext, pattern: RegExp): string[] {
  const hits = new Set<string>();
  for (const s of ctx.surfaces) {
    const label = s.material ?? s.type;
    if (pattern.test(label)) hits.add(label);
  }
  return [...hits].sort();
}

function boardHasContent(ctx: BoardContext): boolean {
  return (
    ctx.planting.length > 0 ||
    ctx.surfaces.length > 0 ||
    ctx.geometry.boundary.length >= 3
  );
}

/* ------------------------------------------------------------- maturity -- */

function maturityDisclaimer(ctx: BoardContext): BoardDisclaimer | null {
  const spreads = ctx.planting
    .map((p) => p.mature_spread_m)
    .filter((m): m is number => m != null && m > 0);
  if (spreads.length === 0) return null;

  const widest = Math.max(...spreads);
  const stage = ctx.climate.growth_stage;
  return {
    id: "bd-maturity",
    kind: "maturity",
    title: "Maturity of the planting shown",
    statement: `Planting on this drawing is shown at mature spread${
      stage == null ? "" : ` (${stage})`
    }, up to ${widest} m across. Stock supplied at installation is immature and will not read as drawn for several seasons. Canopy shown is an indicative projection of established growth, not the appearance at handover, and depends on establishment care, soil and seasonal conditions.`,
    trigger: `${spreads.length} planting placement${spreads.length === 1 ? "" : "s"} drawn at mature spread, widest ${widest} m`,
    required: true,
    cites: ["planting.mature_spread_m"],
    basis: weakest(ctx, ["planting"]),
  };
}

/* --------------------------------------------------------- design intent -- */

function designIntentDisclaimer(ctx: BoardContext): BoardDisclaimer | null {
  if (!boardHasContent(ctx)) return null;

  const scaled = ctx.meta.scale_m != null && ctx.meta.scale_m > 0;
  return {
    id: "bd-design-intent",
    kind: "design_intent",
    title: "Design intent, not construction documentation",
    statement: `This drawing communicates design intent. Dimensions and areas are ${
      scaled
        ? "indicative, taken from a scaled board rather than a set-out survey"
        : "indicative only — no ground scale has been established on this drawing"
    }, and must be verified on site before ordering, fabrication or set-out. Construction detailing, structural design and certification are separate deliverables. No liability is accepted for work built from this drawing without those verifications, or for contractor deviation from it.`,
    trigger: scaled
      ? "board carries drawn content at an indicative scale"
      : "board carries drawn content with no ground scale established",
    required: true,
    cites: ["meta.scale_m", "geometry", "planting", "surfaces"],
    basis: weakest(ctx, ["geometry", "planting", "surfaces"]),
  };
}

/* ------------------------------------------------------------ subsurface -- */

function subsurfaceDisclaimer(ctx: BoardContext): BoardDisclaimer | null {
  const trenches = ctx.systems.trenches.length;
  const located = ctx.systems.byda_assets.length;
  const services = ctx.systems.services.length;
  const easements = ctx.systems.easements.length;
  const excavating = materialMatches(ctx, EXCAVATING_MATERIAL);

  if (trenches + services + easements + excavating.length === 0) return null;

  const unlocated = trenches > 0 && located === 0;
  const triggers = [
    trenches > 0 ? `${trenches} trench run${trenches === 1 ? "" : "s"}` : null,
    located > 0 ? `${located} located asset${located === 1 ? "" : "s"}` : null,
    services > 0 ? `${services} service corridor${services === 1 ? "" : "s"}` : null,
    easements > 0 ? `${easements} easement${easements === 1 ? "" : "s"}` : null,
    excavating.length > 0 ? excavating.join(", ") : null,
  ].filter((t): t is string => t != null);

  return {
    id: "bd-subsurface",
    kind: "subsurface",
    title: "Subsurface conditions and services",
    statement: `Services, easements and utilities shown are indicative and are drawn from the information available at the time — they are not a locate. A Before You Dig Australia enquiry and on-site confirmation, including hand-excavation at crossings, are required before any excavation. No liability is accepted for unforeseen subsurface conditions, including rock, fill, contamination, groundwater, existing footings, or services differing in position or depth from those shown.${
      unlocated
        ? " No located asset has been recorded on this board, so nothing here can be relied on as a service position."
        : ""
    }`,
    trigger: `excavation implied by ${triggers.join("; ")}`,
    required: true,
    cites: ["systems.trenches", "systems.byda_assets", "systems.easements", "surfaces"],
    basis: weakest(ctx, ["systems", "surfaces"]),
  };
}

/* ------------------------------------------------------------------ TPO -- */

function tpoDisclaimer(ctx: BoardContext): BoardDisclaimer | null {
  const rings = ctx.overlays.tpz.length;
  const measured = ctx.planting.filter((p) => p.dbh_m != null).length;
  const flagged = hasFlag(ctx, TRP_FLAG_ID);
  if (rings + measured === 0 && !flagged) return null;

  const heritage = ctx.overlays.keyless.some((k) => /heritage/i.test(k.kind));
  /*
   * A ring drawn or a trunk measured is direct evidence a protected tree is in
   * the works. The planning flag alone can fire on new planting near the
   * dwelling, which is a reason to check rather than a reason to warrant.
   */
  const direct = rings + measured > 0;
  const triggers = [
    rings > 0 ? `${rings} protection zone${rings === 1 ? "" : "s"} drawn` : null,
    measured > 0
      ? `${measured} existing tree${measured === 1 ? "" : "s"} with a measured trunk`
      : null,
    !direct && flagged ? "tree protection flagged on this board" : null,
    heritage ? "heritage overlay recorded on the site" : null,
  ].filter((t): t is string => t != null);

  return {
    id: "bd-tpo",
    kind: "tpo",
    title: "Tree protection and removal",
    statement: `Any tree removal, lopping or root pruning shown or implied is subject to council tree controls and, where applicable, a planning permit${
      heritage ? ", including the heritage overlay recorded on this site" : ""
    }. Confirming that no local law tree protection, significant tree register listing or overlay applies to a tree proposed for removal is the client's responsibility, and no removal should proceed before that confirmation is in writing. Protection zones shown are indicative; works inside a tree protection zone require an arborist's assessment and supervision under AS 4970.`,
    trigger: triggers.join("; "),
    required: direct,
    cites: ["overlays.tpz", "planting.dbh_m", "compliance.flags"],
    basis: weakest(ctx, ["overlays", "planting", "compliance"]),
  };
}

/* --------------------------------------------------------- safety waiver -- */

function safetyWaiverDisclaimer(ctx: BoardContext): BoardDisclaimer | null {
  const pools = materialMatches(ctx, /\bpool\b/i).filter(
    (m) => !/fence|barrier/i.test(m),
  );
  const barriers = materialMatches(ctx, /fence|barrier|balustrade|handrail/i);
  const retaining = materialMatches(ctx, /retaining/i);
  const steps = materialMatches(ctx, /step|stair/i);
  const flagged = hasFlag(ctx, STRUCTURAL_FLAG_ID);

  const hazards = [...pools, ...retaining, ...steps];
  if (hazards.length === 0 && !flagged) return null;

  /*
   * A pool drawn with no barrier anywhere on the board is a specific, checkable
   * omission — that is what makes this required rather than advisory.
   */
  const poolUnbarriered = pools.length > 0 && barriers.length === 0;
  const triggers = [
    hazards.length > 0 ? hazards.join(", ") : null,
    poolUnbarriered ? "no barrier drawn on the board" : null,
    hazards.length === 0 && flagged ? "structural permit flag raised" : null,
  ].filter((t): t is string => t != null);

  return {
    id: "bd-safety-waiver",
    kind: "safety_waiver",
    title: "Safety barriers and fall protection",
    statement: `Barriers, fencing and fall protection shown are indicative and must be designed and certified to the applicable standards — pool barriers to AS 1926 and the Building Regulations, and balustrades and handrails to the National Construction Code. ${
      poolUnbarriered
        ? "No compliant barrier is drawn to the pool shown; a compliant barrier is a legal requirement and must be included before this design is built. "
        : ""
    }Where a recommended barrier, handrail or fall protection is omitted or removed at the client's direction, that instruction must be confirmed in writing and a Notice of Disclaimer issued before construction proceeds.`,
    trigger: triggers.join("; "),
    required: poolUnbarriered,
    cites: ["surfaces", "compliance.flags"],
    basis: weakest(ctx, ["surfaces", "compliance"]),
  };
}

/**
 * The notices this board's own content calls for. Deterministic: the same board
 * always yields the same list in the same order — required notices first, so
 * the ones that should not leave the practice unanswered read first.
 */
export function buildBoardDisclaimers(ctx: BoardContext): BoardDisclaimer[] {
  return [
    designIntentDisclaimer(ctx),
    subsurfaceDisclaimer(ctx),
    tpoDisclaimer(ctx),
    safetyWaiverDisclaimer(ctx),
    maturityDisclaimer(ctx),
  ]
    .filter((d): d is BoardDisclaimer => d != null)
    .sort((a, b) => Number(b.required) - Number(a.required) || a.id.localeCompare(b.id));
}

/**
 * Prompt block for the assist, so a model asked about issuing the set reads the
 * same notices the export overlay prompts rather than drafting its own.
 */
export function formatBoardDisclaimersForAi(
  disclaimers: BoardDisclaimer[],
): string {
  if (disclaimers.length === 0) {
    return "EXPORT DISCLAIMERS: none — nothing on this board implies a notice yet.";
  }
  const lines = disclaimers.map(
    (d) =>
      `- [${d.required ? "REQUIRED" : "ADVISORY"}] ${d.title} — triggered by ${d.trigger} (cites: ${d.cites.join(", ")}; basis: ${d.basis})`,
  );
  return [
    "EXPORT DISCLAIMERS (computed from the board — the operator approves the wording, you never issue it):",
    ...lines,
  ].join("\n");
}
