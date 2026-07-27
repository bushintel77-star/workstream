/**
 * Sustainability read-out over BoardContext v1.
 *
 * Same whole-board snapshot the assist and the findings reason on — permeable
 * area, canopy at maturity, irrigation demand, stored carbon, open space and
 * grade all fall out of blocks the board already carries. This is an extension
 * of `studio-preemptive-compliance`, not a second engine: the permeability and
 * canopy benchmarks come through the context from that same evaluation.
 *
 * Three rules hold throughout:
 *
 * - **Measured or absent.** A metric with no input on the board reports
 *   `absent` and says what is missing. It never shows a comfortable zero — an
 *   unmeasured site is not a site with no water demand.
 * - **Verifiable.** Every figure is arithmetic over board artefacts. Where a
 *   published coefficient is applied, `model` names it, so the number can be
 *   checked rather than taken on faith.
 * - **Cited.** Each metric carries the artefacts behind it and the weakest
 *   provenance among them, so a figure resting on a derived estimate reads
 *   weaker than one resting on measured survey area.
 *
 * SITES v2 credits are referenced by section and title, not by credit number.
 * The numbering is not something this repo can verify, and a wrong reference on
 * a sustainability claim is worse than no reference at all.
 *
 * Domain-pure: no server imports.
 */

import type {
  BoardMetricStatus,
  BoardSustainability,
  BoardSustainabilityMetric,
} from "@workstream/contracts";
import type {
  BoardContext,
  BoardPlanting,
  BoardPoint,
  BoardProvenance,
} from "./board-context";

/* The wire shape is owned by the contracts boundary — this module computes it. */
export type { BoardMetricStatus, BoardSustainability, BoardSustainabilityMetric };

/**
 * Dry above-ground biomass carbon **held** by established urban canopy, per m²
 * of projected crown. Indicative mid-range for mixed broadleaf street/garden
 * trees at maturity.
 *
 * This is a **stock, not a flux** — the carbon standing in the biomass once the
 * planting is established, counted once. It is not an annual sequestration
 * rate, and multiplying it by a number of years is wrong. The label, unit and
 * model note all say so, because a reader who takes it for a yearly figure
 * overstates the result by an order of magnitude within a decade, and this is
 * the one line on the dashboard a competitor could attack.
 */
const CARBON_STOCK_KG_PER_CANOPY_M2 = 8;

/** Zone kinds that actually put water on the ground. */
const WATERED_ZONE_KINDS = new Set(["drip", "spray"]);

/** Emitter spacing default mirrors the irrigation zone contract. */
const DEFAULT_EMITTER_SPACING_CM = 30;

/** Emitter flow default mirrors the irrigation zone contract. */
const DEFAULT_EMITTER_FLOW_LPH = 2;

/** Spray heads sit further apart than drip emitters. */
const DEFAULT_FIXTURE_SPACING_M = 2.5;

/** Fall across the site below which drainage reads as flat rather than graded. */
const FLAT_SITE_FALL_M = 0.15;

const PROVENANCE_RANK: Record<BoardProvenance, number> = {
  absent: 0,
  seed: 1,
  derived: 2,
  operator: 3,
  vicmap: 4,
};

/** The weakest link in the evidence chain is what the figure actually rests on. */
function weakest(ctx: BoardContext, blocks: string[]): BoardProvenance {
  let worst: BoardProvenance = "vicmap";
  for (const block of blocks) {
    const p = ctx.provenance[block] ?? "absent";
    if (PROVENANCE_RANK[p] < PROVENANCE_RANK[worst]) worst = p;
  }
  return worst;
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

/** Path length in ground metres, from board percent and the frame scale. */
function pathLengthM(points: BoardPoint[], scaleM: number): number {
  let total = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    total += (Math.hypot(b.x - a.x, b.y - a.y) / 100) * scaleM;
  }
  return total;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** A metric the board cannot measure — named, not zeroed. */
function absentMetric(
  base: Omit<BoardSustainabilityMetric, "value" | "target" | "status" | "model">,
  missing: string,
): BoardSustainabilityMetric {
  return {
    ...base,
    value: null,
    target: null,
    status: "absent",
    model: null,
    statement: missing,
  };
}

/* ---------------------------------------------------------- permeability -- */

function permeabilityMetric(ctx: BoardContext): BoardSustainabilityMetric {
  const base = {
    id: "permeable-area",
    label: "Permeable area",
    unit: "%",
    sites_credit: "Water — manage precipitation on site",
    sdg: [6, 11, 13],
    statement: "",
    cites: ["surfaces", "geometry.outdoor_m2"],
    basis: weakest(ctx, ["surfaces", "geometry"]),
  };

  const outdoor = ctx.geometry.outdoor_m2;
  if (outdoor == null || outdoor <= 0) {
    return absentMetric(base, "No outdoor area measured — permeability cannot be read.");
  }

  const sealed = ctx.surfaces.filter(
    (s) => s.permeable === false && s.area_m2 != null && s.area_m2 > 0,
  );
  if (sealed.length === 0) {
    return absentMetric(
      base,
      "No sealed surface measured on the board — nothing to read permeability against yet.",
    );
  }

  const sealedM2 = sealed.reduce((sum, s) => sum + (s.area_m2 ?? 0), 0);
  const pct = Math.max(0, 100 - (sealedM2 / outdoor) * 100);
  const target = ctx.compliance.permeability_target;
  const status: BoardMetricStatus =
    target == null ? "measured" : pct >= target ? "on_track" : "short";

  return {
    ...base,
    value: round1(pct),
    target,
    status,
    model: null,
    statement: `${Math.round(sealedM2)} m² sealed across ${sealed
      .map((s) => s.material ?? s.type)
      .join(", ")} leaves ${Math.round(pct)}% of ${Math.round(outdoor)} m² outdoor able to take rainfall${
      target == null ? "." : ` against a ${target}% benchmark.`
    }`,
  };
}

/* ------------------------------------------------------------ canopy/UHI -- */

function canopyMetric(ctx: BoardContext): BoardSustainabilityMetric {
  const base = {
    id: "canopy-cover",
    label: "Canopy at maturity",
    unit: "%",
    sites_credit: "Soil + vegetation — reduce urban heat island effects",
    sdg: [3, 11, 13],
    statement: "",
    cites: ["planting", "geometry.outdoor_m2"],
    basis: weakest(ctx, ["planting", "geometry"]),
  };

  const outdoor = ctx.geometry.outdoor_m2;
  const canopyM2 = totalCanopyM2(ctx.planting);
  if (outdoor == null || outdoor <= 0) {
    return absentMetric(base, "No outdoor area measured — canopy share cannot be read.");
  }
  if (canopyM2 <= 0) {
    return absentMetric(
      base,
      "No planting on the board carries a mature spread — canopy at maturity is unknown, not zero.",
    );
  }

  const pct = (canopyM2 / outdoor) * 100;
  const target = ctx.compliance.canopy_target;
  const status: BoardMetricStatus =
    target == null ? "measured" : pct >= target ? "on_track" : "short";

  return {
    ...base,
    value: round1(pct),
    target,
    status,
    model: null,
    statement: `Projected crowns cover about ${Math.round(canopyM2)} m² of ${Math.round(outdoor)} m² outdoor at maturity${
      target == null ? "." : ` against a ${target}% benchmark.`
    } Shade over hard surfaces is what takes heat out of the site.`,
  };
}

/* ------------------------------------------------------------ water use -- */

type WateredZone = { name: string; litresPerHour: number };

/**
 * Peak draw of the drawn irrigation, from the zone runs themselves — emitter
 * spacing and flow are on the zone contract, so this is arithmetic over the
 * operator's own layout rather than a rule of thumb.
 */
function readWateredZones(ctx: BoardContext, scaleM: number): WateredZone[] {
  const out: WateredZone[] = [];
  for (const raw of ctx.systems.irrigation_zones) {
    if (!raw || typeof raw !== "object") continue;
    const zone = raw as Record<string, unknown>;
    const kind = typeof zone.kind === "string" ? zone.kind : "drip";
    if (!WATERED_ZONE_KINDS.has(kind)) continue;

    const points: BoardPoint[] = [];
    if (Array.isArray(zone.points)) {
      for (const p of zone.points) {
        if (!p || typeof p !== "object") continue;
        const point = p as Record<string, unknown>;
        const x = typeof point.x_pct === "number" ? point.x_pct : point.x;
        const y = typeof point.y_pct === "number" ? point.y_pct : point.y;
        if (typeof x !== "number" || typeof y !== "number") continue;
        points.push({ x, y });
      }
    }
    if (points.length < 2) continue;

    const runM = pathLengthM(points, scaleM);
    if (runM <= 0) continue;

    const spacingM =
      kind === "spray"
        ? typeof zone.fixture_spacing_m === "number" && zone.fixture_spacing_m > 0
          ? zone.fixture_spacing_m
          : DEFAULT_FIXTURE_SPACING_M
        : (typeof zone.emitter_spacing_cm === "number" &&
          zone.emitter_spacing_cm > 0
            ? zone.emitter_spacing_cm
            : DEFAULT_EMITTER_SPACING_CM) / 100;
    const flowLph =
      typeof zone.emitter_flow_lph === "number" && zone.emitter_flow_lph > 0
        ? zone.emitter_flow_lph
        : DEFAULT_EMITTER_FLOW_LPH;

    const emitters = Math.max(1, Math.round(runM / spacingM));
    out.push({
      name: typeof zone.name === "string" && zone.name.trim() ? zone.name : kind,
      litresPerHour: emitters * flowLph,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function waterMetric(ctx: BoardContext): BoardSustainabilityMetric {
  const base = {
    id: "irrigation-demand",
    label: "Irrigation peak draw",
    unit: "L/h",
    sites_credit: "Water — reduce water use for landscape irrigation",
    sdg: [6, 12],
    statement: "",
    cites: ["systems.irrigation_zones", "meta.scale_m"],
    basis: weakest(ctx, ["systems"]),
  };

  const scaleM = ctx.meta.scale_m;
  if (scaleM == null || scaleM <= 0) {
    return absentMetric(
      base,
      "No ground scale on the board — zone runs cannot be converted to metres, so demand cannot be read.",
    );
  }

  const zones = readWateredZones(ctx, scaleM);
  if (zones.length === 0) {
    return absentMetric(
      base,
      "No drip or spray zone drawn — irrigation demand is unknown, not nil.",
    );
  }

  const litresPerHour = zones.reduce((sum, z) => sum + z.litresPerHour, 0);
  return {
    ...base,
    value: Math.round(litresPerHour),
    target: null,
    status: "measured",
    model:
      "Emitter count from drawn run length ÷ zone spacing, at the zone's own emitter flow. Peak simultaneous draw, not a seasonal volume.",
    statement: `${zones.length} watered zone${zones.length === 1 ? "" : "s"} (${zones
      .map((z) => z.name)
      .join(", ")}) draw about ${Math.round(litresPerHour)} L/h at once. Check it against the meter and the tap flow before commissioning.`,
  };
}

/* --------------------------------------------------------------- carbon -- */

function carbonMetric(ctx: BoardContext): BoardSustainabilityMetric {
  const base = {
    id: "canopy-carbon",
    /* Label, unit and model all carry "stored"/"stock" — see the constant. */
    label: "Carbon stored at maturity",
    unit: "kg stored",
    sites_credit: "Soil + vegetation — use vegetation to reduce site energy demand",
    sdg: [13, 15],
    statement: "",
    cites: ["planting"],
    basis: weakest(ctx, ["planting"]),
  };

  const canopyM2 = totalCanopyM2(ctx.planting);
  if (canopyM2 <= 0) {
    return absentMetric(
      base,
      "No planting on the board carries a mature spread — stored carbon cannot be estimated.",
    );
  }

  return {
    ...base,
    value: Math.round(canopyM2 * CARBON_STOCK_KG_PER_CANOPY_M2),
    target: null,
    status: "measured",
    model: `Indicative ${CARBON_STOCK_KG_PER_CANOPY_M2} kg of above-ground carbon per m² of mature crown, over ${Math.round(canopyM2)} m² of projected canopy. This is a one-off standing stock at maturity, not an annual sequestration rate — do not multiply it by a number of years. A planning-stage order of magnitude, not carbon accounting.`,
    statement:
      "Carbon held in the standing biomass once the planting is established — counted once, not per year, and not an offset. It only arrives if the trees reach the spread the plan draws them at, so it is an argument for retention and establishment care.",
  };
}

/* ----------------------------------------------------------- open space -- */

function openSpaceMetric(ctx: BoardContext): BoardSustainabilityMetric {
  const base = {
    id: "open-space",
    label: "Open space",
    unit: "%",
    sites_credit: "Human health + well-being — provide outdoor spaces for restoration",
    sdg: [3, 11],
    statement: "",
    cites: ["geometry.coverage_pct", "geometry.lot_m2"],
    basis: weakest(ctx, ["geometry"]),
  };

  const coverage = ctx.geometry.coverage_pct;
  const lot = ctx.geometry.lot_m2;
  if (coverage == null || lot == null || lot <= 0) {
    return absentMetric(
      base,
      "No dwelling footprint measured against the lot — open space share cannot be read.",
    );
  }

  const pct = Math.max(0, 100 - coverage);
  return {
    ...base,
    value: round1(pct),
    target: null,
    status: "measured",
    model: null,
    statement: `${Math.round(pct)}% of the ${Math.round(lot)} m² lot is unbuilt. That is the ground available to plant, drain and use.`,
  };
}

/* ----------------------------------------------------------------- fall -- */

function gradeMetric(ctx: BoardContext): BoardSustainabilityMetric {
  const base = {
    id: "site-fall",
    label: "Fall across site",
    unit: "m",
    sites_credit: "Soil + vegetation — reduce soil disturbance in design and construction",
    sdg: [6, 15],
    statement: "",
    cites: ["geometry.levels"],
    basis: weakest(ctx, ["levels"]),
  };

  const levels = ctx.geometry.levels;
  if (levels.length < 2) {
    return absentMetric(
      base,
      "Fewer than two spot levels authored — fall, drainage direction and cut/fill cannot be read from this board.",
    );
  }

  const rls = levels.map((l) => l.rl_m);
  const fall = Math.max(...rls) - Math.min(...rls);
  return {
    ...base,
    value: round1(fall),
    target: null,
    status: "measured",
    model: null,
    statement:
      fall < FLAT_SITE_FALL_M
        ? `${fall.toFixed(2)} m across ${levels.length} spot levels — effectively flat, so surface drainage has to be designed rather than assumed.`
        : `${fall.toFixed(2)} m across ${levels.length} spot levels. Work with the fall before earthworks: every metre cut is soil structure lost and spoil to cart.`,
  };
}

/**
 * The sustainability read-out this board can honestly support. Deterministic:
 * the same board always yields the same metrics in the same order.
 */
export function buildBoardSustainability(ctx: BoardContext): BoardSustainability {
  const metrics = [
    permeabilityMetric(ctx),
    canopyMetric(ctx),
    waterMetric(ctx),
    carbonMetric(ctx),
    openSpaceMetric(ctx),
    gradeMetric(ctx),
  ];
  return {
    metrics,
    measured: metrics.filter((m) => m.status !== "absent").length,
    assessed: metrics.length,
  };
}

/**
 * Prompt block for the assist. The metrics arrive pre-computed and cited so the
 * model reads the board's own arithmetic instead of estimating sustainability
 * performance from a description of the drawing.
 */
export function formatBoardSustainabilityForAi(
  sustainability: BoardSustainability,
): string {
  const lines = sustainability.metrics.map((m) =>
    m.status === "absent"
      ? `- ${m.label}: not measured — ${m.statement}`
      : `- ${m.label}: ${m.value} ${m.unit}${
          m.target == null ? "" : ` (benchmark ${m.target} ${m.unit}, ${m.status === "on_track" ? "met" : "short"})`
        } [SITES v2 ${m.sites_credit}; SDG ${m.sdg.join(", ")}; basis: ${m.basis}]${
          m.model == null ? "" : ` Modelled: ${m.model}`
        }`,
  );
  return [
    `BOARD SUSTAINABILITY (${sustainability.measured} of ${sustainability.assessed} metrics measurable from this board):`,
    ...lines,
    "Never present an absent metric as a zero, and quote the named model whenever you use a modelled figure.",
  ].join("\n");
}
