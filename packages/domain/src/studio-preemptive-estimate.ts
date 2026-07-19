/**
 * Lead Landscape CAD & Material Orchestrator — continuous estimate for the
 * handoff Design Studio. Every hardscape/softscape placement expands into
 * secondary/tertiary materials, labour, logistics, and horizon cards.
 * AU locale: m², m³, tonnes, tipper loads, GST.
 */

import {
  DEFAULT_PAVING_ASSEMBLY,
  layerDepthM,
  totalDepthM,
} from "./assembly-recipe";
import { calculateGST } from "./costing";
import {
  evaluateStudioCompliance,
  type StudioComplianceItem,
  type StudioComplianceReport,
} from "./studio-preemptive-compliance";

const PAVING_DEPTH_M = totalDepthM(DEFAULT_PAVING_ASSEMBLY);
const BASE_DEPTH_M = layerDepthM(DEFAULT_PAVING_ASSEMBLY, "base");
const BEDDING_DEPTH_M = layerDepthM(DEFAULT_PAVING_ASSEMBLY, "bedding");
/** Compacted crushed rock bulk density (t/m³). */
const CR_DENSITY_T_PER_M3 = 1.8;
/** Tipper payload (t) — Melbourne suburban access. */
const TIPPER_PAYLOAD_T = 8;
/** Hardscape m² that preempts drainage intervention. */
const DRAINAGE_HARDSCAPE_M2 = 25;

export type StudioEstimateTier =
  | "primary"
  | "secondary"
  | "tertiary"
  | "labour"
  | "logistics"
  | "fee";

export type StudioEstimateLine = {
  id: string;
  tier: StudioEstimateTier;
  label: string;
  unit: string;
  qty: number;
  rate: number;
  total: number;
  sourceIds: string[];
  notes?: string;
};

export type StudioHorizonCard = {
  id: string;
  kind: "drainage" | "tpz" | "engineer" | "spoil" | "assembly";
  title: string;
  detail: string;
  severity: "info" | "watch" | "critical";
  suggestType?: "frenchdrain" | "exist" | "deck" | "paving";
  x?: number;
  y?: number;
  sourceIds: string[];
};

export type StudioEstimateReport = {
  lines: StudioEstimateLine[];
  materialsExGst: number;
  gst: number;
  totalInclGst: number;
  hardscapeM2: number;
  excavateM3: number;
  spoilTonnes: number;
  tipperLoads: number;
  horizon: StudioHorizonCard[];
  compliance: StudioComplianceReport;
};

type ItemMeta = {
  rate: number;
  wPx: number;
  hPx: number;
  areaKind?: "rect" | "ellipse" | "none";
  heightM?: number;
  lin?: boolean;
  existing?: boolean;
  dbhM?: number;
  canopyM?: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function itemAreaM2(
  it: StudioComplianceItem,
  meta: ItemMeta,
): number {
  const wPx = it.wPx ?? meta.wPx;
  const hPx = it.hPx ?? meta.hPx;
  const areaKind = it.areaKind ?? meta.areaKind;
  const wm = (wPx * it.scale) / 40;
  const hm = (hPx * it.scale) / 40;
  if (areaKind === "ellipse") return (Math.PI / 4) * wm * hm;
  if (areaKind === "rect") return wm * hm;
  if (meta.lin) return Math.max(wm, hm) * 0.35;
  if (it.t === "lawn" || it.t === "bed") return wm * hm * 0.85;
  return 0;
}

function line(
  id: string,
  tier: StudioEstimateTier,
  label: string,
  unit: string,
  qty: number,
  rate: number,
  sourceIds: string[],
  notes?: string,
): StudioEstimateLine {
  const q = round2(Math.max(0, qty));
  const r = round2(rate);
  return {
    id,
    tier,
    label,
    unit,
    qty: q,
    rate: r,
    total: round2(q * r),
    sourceIds,
    notes,
  };
}

const DEFAULT_META: Record<string, ItemMeta> = {
  paving: {
    rate: 320,
    wPx: 110,
    hPx: 80,
    areaKind: "rect",
  },
  deck: {
    rate: 480,
    wPx: 120,
    hPx: 86,
    areaKind: "rect",
    heightM: 0.4,
  },
  lawn: { rate: 45, wPx: 130, hPx: 95, areaKind: "rect" },
  bed: { rate: 180, wPx: 100, hPx: 74, areaKind: "ellipse" },
  hedge: { rate: 260, wPx: 120, hPx: 34, lin: true, heightM: 1.2 },
  canopy: { rate: 650, wPx: 72, hPx: 72, canopyM: 6 },
  feature: { rate: 1200, wPx: 54, hPx: 54, canopyM: 4 },
  frenchdrain: { rate: 220, wPx: 100, hPx: 28, lin: true },
  exist: {
    rate: 0,
    wPx: 64,
    hPx: 64,
    existing: true,
    dbhM: 0.45,
    canopyM: 7,
  },
};

/**
 * Continuous preemptive estimate — call on every geometry commit.
 * No Design/Quote mode toggle; BOM and horizon are the same loop.
 */
export function estimateStudioDrawing(args: {
  outdoorM2: number;
  boundary: Array<{ x: number; y: number }>;
  items: StudioComplianceItem[];
  metaByType?: Partial<Record<string, ItemMeta>>;
  /** Constrained access bumps labour / tipper count. */
  accessConstrained?: boolean;
}): StudioEstimateReport {
  const metaMap = { ...DEFAULT_META, ...args.metaByType };
  const access = args.accessConstrained ? 1.15 : 1;
  const live = args.items.filter((i) => !i.ghost);
  const lines: StudioEstimateLine[] = [];
  const horizon: StudioHorizonCard[] = [];
  let hardscapeM2 = 0;
  let excavateM3 = 0;
  let spoilTonnes = 0;

  for (const it of live) {
    const meta = metaMap[it.t] ?? {
      rate: 100,
      wPx: 80,
      hPx: 60,
      areaKind: "rect" as const,
    };
    if (meta.existing) continue;

    const area = itemAreaM2(it, meta);

    if (it.t === "paving" || it.t === "deck") {
      hardscapeM2 += area;
      const surfaceRate = meta.rate;
      lines.push(
        line(
          `prim-${it.id}`,
          "primary",
          it.t === "paving" ? "Bluestone paving — surface" : "Timber deck — surface",
          "m²",
          area,
          surfaceRate * access,
          [it.id],
          "Primary finished surface",
        ),
      );

      const depth = it.t === "deck" ? 0.12 : PAVING_DEPTH_M;
      const exc = area * depth;
      excavateM3 += exc;
      lines.push(
        line(
          `sec-exc-${it.id}`,
          "secondary",
          "Excavation — subgrade",
          "m³",
          exc,
          85 * access,
          [it.id],
          `Preemptive: remove for ~${Math.round(depth * 1000)} mm assembly`,
        ),
      );

      if (it.t === "paving") {
        const baseM3 = area * BASE_DEPTH_M;
        const baseT = baseM3 * CR_DENSITY_T_PER_M3;
        spoilTonnes += baseT * 0.15; // over-dig allowance into spoil stream
        lines.push(
          line(
            `sec-base-${it.id}`,
            "secondary",
            "Crushed rock base (CR6)",
            "t",
            baseT,
            65 * access,
            [it.id],
            `Preemptive: ~${Math.round(BASE_DEPTH_M * 1000)} mm compacted base`,
          ),
        );
        lines.push(
          line(
            `ter-sand-${it.id}`,
            "tertiary",
            "Bedding sand",
            "m³",
            area * BEDDING_DEPTH_M,
            90 * access,
            [it.id],
            `Preemptive: ~${Math.round(BEDDING_DEPTH_M * 1000)} mm setting bed`,
          ),
        );
        lines.push(
          line(
            `ter-joint-${it.id}`,
            "tertiary",
            "Polymeric joint sand",
            "kg",
            area * 4,
            2.4,
            [it.id],
          ),
        );
        const edgeLm = Math.sqrt(area) * 4;
        lines.push(
          line(
            `ter-edge-${it.id}`,
            "tertiary",
            "Edge restraint",
            "lm",
            edgeLm,
            28 * access,
            [it.id],
          ),
        );
      } else {
        // Deck: joist/bearer allowance as secondary timber
        lines.push(
          line(
            `sec-frame-${it.id}`,
            "secondary",
            "Deck framing — bearers & joists",
            "m²",
            area,
            95 * access,
            [it.id],
            "Preemptive structural framing under decking",
          ),
        );
      }

      spoilTonnes += exc * 1.6; // spoil swell
      lines.push(
        line(
          `lab-${it.id}`,
          "labour",
          it.t === "paving" ? "Hardscape install labour" : "Deck install labour",
          "hr",
          area * 0.35 * access,
          85,
          [it.id],
          args.accessConstrained
            ? "Constrained access — bobcat/barrow allowance"
            : "Preemptive labour allowance",
        ),
      );

      horizon.push({
        id: `hz-assy-${it.id}`,
        kind: "assembly",
        title: it.t === "paving" ? "Paving assembly shadowed" : "Deck assembly shadowed",
        detail:
          it.t === "paving"
            ? "Excavation, CR6 base, bedding, joint sand, and edge restraint are live in the BOM."
            : "Framing and labour are live; check fall < 1:100 to lawn.",
        severity: "info",
        sourceIds: [it.id],
        x: it.x,
        y: it.y,
      });
    } else if (
      it.t === "lawn" ||
      it.t === "bed" ||
      it.t === "hedge" ||
      it.t === "canopy" ||
      it.t === "feature" ||
      it.t === "frenchdrain"
    ) {
      const qty =
        it.t === "canopy" || it.t === "feature"
          ? 1
          : it.t === "frenchdrain"
            ? Math.max(2, (meta.wPx * it.scale) / 40)
            : Math.max(area, 1);
      const unit =
        it.t === "canopy" || it.t === "feature"
          ? "ea"
          : it.t === "frenchdrain" || it.t === "hedge"
            ? "lm"
            : "m²";
      lines.push(
        line(
          `prim-${it.id}`,
          "primary",
          labelFor(it.t),
          unit,
          qty,
          meta.rate * access,
          [it.id],
        ),
      );
      if (it.t !== "frenchdrain") {
        lines.push(
          line(
            `lab-soft-${it.id}`,
            "labour",
            "Planting / softscape labour",
            unit === "ea" ? "ea" : "hr",
            unit === "ea" ? 1 : qty * 0.15,
            unit === "ea" ? 45 : 75,
            [it.id],
          ),
        );
      }
    }

    if ((meta.heightM ?? 0) > 1.2) {
      lines.push(
        line(
          `fee-eng-${it.id}`,
          "fee",
          "Structural engineer — retaining >1.2 m",
          "ea",
          1,
          1800,
          [it.id],
          "AU threshold ~1.2 m — engineer + permit likely",
        ),
      );
      lines.push(
        line(
          `fee-permit-${it.id}`,
          "fee",
          "Council / building permit allowance",
          "ea",
          1,
          650,
          [it.id],
        ),
      );
      horizon.push({
        id: `hz-eng-${it.id}`,
        kind: "engineer",
        title: "This height usually needs an engineer",
        detail:
          "Over about 1.2 m we have already reserved engineer and permit fees in the live cost.",
        severity: "critical",
        sourceIds: [it.id],
        x: it.x,
        y: it.y,
      });
    }
  }

  if (spoilTonnes > 0) {
    const loads = Math.max(1, Math.ceil(spoilTonnes / TIPPER_PAYLOAD_T));
    lines.push(
      line(
        "log-spoil",
        "logistics",
        "Spoil haul — tipper loads",
        "load",
        loads,
        420 * access,
        live.filter((i) => i.t === "paving" || i.t === "deck").map((i) => i.id),
        `~${round2(spoilTonnes)} t spoil · ${TIPPER_PAYLOAD_T} t/load`,
      ),
    );
    horizon.push({
      id: "hz-spoil",
      kind: "spoil",
      title: `${loads} tipper load${loads === 1 ? "" : "s"} foreshadowed`,
      detail: `~${round2(spoilTonnes)} t excavated spoil — access factor ${access.toFixed(2)}.`,
      severity: "info",
      sourceIds: [],
    });
  }

  const hasDrain = live.some((i) => i.t === "frenchdrain");
  if (hardscapeM2 >= DRAINAGE_HARDSCAPE_M2 && !hasDrain) {
    const anchor = live.find((i) => i.t === "paving" || i.t === "deck");
    horizon.push({
      id: "hz-drain",
      kind: "drainage",
      title: "This hardscape may need a drain nearby",
      detail: `About ${round2(hardscapeM2)} m² of paving — a French drain near the low point usually keeps lawns dry.`,
      severity: hardscapeM2 >= 60 ? "critical" : "watch",
      suggestType: "frenchdrain",
      x: anchor ? anchor.x : 50,
      y: anchor ? Math.min(95, anchor.y + 4) : 55,
      sourceIds: anchor ? [anchor.id] : [],
    });
  }

  const compliance = evaluateStudioCompliance({
    outdoorM2: args.outdoorM2,
    boundary: args.boundary,
    items: args.items,
  });
  for (const a of compliance.alerts) {
    if (a.code === "tpz") {
      horizon.push({
        id: `hz-${a.id}`,
        kind: "tpz",
        title: a.title,
        detail: a.detail,
        severity: a.severity === "critical" ? "critical" : "watch",
        sourceIds: a.sourceIds,
      });
    }
  }

  const materialsExGst = round2(lines.reduce((s, l) => s + l.total, 0));
  const gst = round2(calculateGST(materialsExGst));
  const totalInclGst = round2(materialsExGst + gst);

  return {
    lines: lines.sort((a, b) => a.tier.localeCompare(b.tier)),
    materialsExGst,
    gst,
    totalInclGst,
    hardscapeM2: round2(hardscapeM2),
    excavateM3: round2(excavateM3),
    spoilTonnes: round2(spoilTonnes),
    tipperLoads:
      spoilTonnes > 0
        ? Math.max(1, Math.ceil(spoilTonnes / TIPPER_PAYLOAD_T))
        : 0,
    horizon: horizon.slice(0, 8),
    compliance,
  };
}

function labelFor(t: string): string {
  switch (t) {
    case "lawn":
      return "Instant turf";
    case "bed":
      return "Mass plant bed";
    case "hedge":
      return "Clipped hedge";
    case "canopy":
      return "Canopy tree";
    case "feature":
      return "Feature tree";
    case "frenchdrain":
      return "French drain";
    default:
      return t;
  }
}
