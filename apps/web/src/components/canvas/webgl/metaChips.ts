/**
 * Gold Standard 2026 — Vicmap meta chip-set builder (pure).
 *
 * Transforms raw site-truth records (cadastral title, keyless overlays,
 * easements, spot levels) into a small set of ambient "meta chips" —
 * satellite tags that orbit the title boundary instead of sitting in an
 * inspector panel. Purely derived data: no chip is ever invented; an
 * absent input simply produces no chip (zero-mock law).
 *
 * Taxonomy:
 *   cadastral  — SPI, parcel area, LGA              (bright: survey, cad)
 *   planning   — zone, overlays, easements          (bright: survey, cad)
 *   terrain    — slope, sun, spot-level relief      (bright: elevation, garden)
 */

import type { DesignKeylessOverlay, SiteEnvelope } from "@workstream/contracts";
import type { CanopyComplianceResult } from "./canopyCompliance";
import type { HeightmapPoint, PctPoint } from "./coordTransform";

export type MetaChipGroup = "cadastral" | "planning" | "terrain";

export interface MetaChip {
  /** Stable id — used for the testid and the expansion state. */
  id: string;
  group: MetaChipGroup;
  /** The data value — e.g. "SPI 1\\TP84291", "NRZ3 Zone", "4.2° S Slope". */
  label: string;
  /** The category word — e.g. "Title", "Planning", "Relief". */
  value: string;
  /** Micro-tooltip summary shown on hover/click expansion. */
  detail: string;
  /** Canvas modes where this chip's group illuminates to full strength. */
  brightModes: string[];
}

export interface MetaChipSiteInput {
  boundary?: PctPoint[];
  scaleM?: number;
  boardAspect?: number;
  /** Cadastral parcel reference — SPI preferred, else PFI (never fabricated). */
  titleRef?: string | null;
  lga?: string | null;
  lotAreaM2?: number | null;
  overlays?: DesignKeylessOverlay[];
  easementRingCount?: number;
  heightmap?: HeightmapPoint[];
  sunHours?: number | null;
  /** ResCode A2-6 canopy assessment (webgl/canopyCompliance); null = no chip. */
  canopy?: CanopyComplianceResult | null;
  /** Site envelope (sun × season × wetness × slope); null = no site truth. */
  envelope?: SiteEnvelope | null;
}

/** SPI strings carry the plan\parcel form ("1\TP84291"); PFIs are plain. */
function titleRefLabel(ref: string): string {
  return ref.includes("\\") ? `SPI ${ref}` : `PFI ${ref}`;
}

const CADASTRAL_MODES = ["survey", "cad"];
const TERRESTRIAL_MODES = ["elevation", "garden"];

/** Shoelace area of a board-% ring scaled into real square metres. */
export function boundaryAreaM2(
  boundary: PctPoint[],
  scaleM: number,
  boardAspect: number,
): number {
  if (boundary.length < 3) return 0;
  let twice = 0;
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i]!;
    const b = boundary[(i + 1) % boundary.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  // board-% → world: x ÷100 × scaleM, y ÷100 × (scaleM × boardAspect)
  const pctArea = Math.abs(twice) / 2;
  return pctArea * ((scaleM * scaleM * boardAspect) / 10000);
}

/** Steepest adjacent spot-level fall: { slopeDeg, slopePct, aspect } or null. */
export function steepestFall(levels: HeightmapPoint[]): {
  slopeDeg: number;
  slopePct: number;
  aspect: "N" | "S" | "E" | "W";
} | null {
  if (levels.length < 2) return null;
  let best: { pct: number; dx: number; dz: number } | null = null;
  for (let i = 0; i < levels.length; i++) {
    for (let j = i + 1; j < levels.length; j++) {
      const a = levels[i]!;
      const b = levels[j]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= 0.001) continue;
      const pct = (Math.abs(b.y - a.y) / dist) * 100;
      if (!best || pct > best.pct) {
        const fall = b.y < a.y ? { dx: b.x - a.x, dz: b.z - a.z } : { dx: a.x - b.x, dz: a.z - b.z };
        best = { pct, dx: fall.dx, dz: fall.dz };
      }
    }
  }
  if (!best) return null;
  const aspect: "N" | "S" | "E" | "W" =
    Math.abs(best.dx) > Math.abs(best.dz)
      ? best.dx > 0
        ? "E"
        : "W"
      : best.dz > 0
        ? "S"
        : "N";
  return {
    slopeDeg: Math.round((Math.atan(best.pct / 100) * 180) / Math.PI * 10) / 10,
    slopePct: Math.round(best.pct * 10) / 10,
    aspect,
  };
}

function overlayNamed(overlays: DesignKeylessOverlay[], kind: string): DesignKeylessOverlay | undefined {
  return overlays.find((o) => o.kind === kind && o.label?.trim());
}

export function buildMetaChips(input: MetaChipSiteInput): MetaChip[] {
  const chips: MetaChip[] = [];
  const overlays = input.overlays ?? [];

  // --- Cadastral & title ------------------------------------------------
  if (input.titleRef?.trim()) {
    chips.push({
      id: "spi",
      group: "cadastral",
      label: titleRefLabel(input.titleRef.trim()),
      value: "Title",
      detail: `Cadastral parcel reference ${input.titleRef.trim()} — SPI preferred, else PFI. Source: Vicmap cadastre; the title is the single source of truth for site geometry.`,
      brightModes: CADASTRAL_MODES,
    });
  }

  const areaM2 =
    input.lotAreaM2 ??
    (input.boundary && input.scaleM && input.boundary.length >= 3
      ? boundaryAreaM2(input.boundary, input.scaleM, input.boardAspect ?? 1)
      : null);
  if (areaM2) {
    chips.push({
      id: "parcel",
      group: "cadastral",
      label: `${Math.round(areaM2).toLocaleString("en-AU")} m²`,
      value: "Parcel",
      detail: input.lotAreaM2
        ? "Cadastral parcel area from the title record."
        : "Title boundary area measured off the board ring (indicative).",
      brightModes: CADASTRAL_MODES,
    });
  }

  if (input.lga?.trim()) {
    chips.push({
      id: "lga",
      group: "cadastral",
      label: `LGA: ${input.lga.trim()}`,
      value: "Council",
      detail: "Local government area from the cadastral title — drives planning-scheme overlays and permit prompts.",
      brightModes: CADASTRAL_MODES,
    });
  }

  // --- Planning & constraints -------------------------------------------
  const planning = overlayNamed(overlays, "planning");
  if (planning) {
    chips.push({
      id: "zone",
      group: "planning",
      label: planning.label ? `${planning.label} Zone` : "Planning Zone",
      value: "Planning",
      detail: `${planning.label ?? "Planning zone"} — resolved from the live planning-scheme overlay (Vicmap). Check setbacks against this zone's schedule.`,
      brightModes: CADASTRAL_MODES,
    });
  }

  const heritage = overlays.find((o) => o.kind === "heritage");
  if (heritage) {
    chips.push({
      id: "heritage",
      group: "planning",
      label: heritage.label ? `${heritage.label} Heritage` : "Heritage Overlay",
      value: "Constraint",
      detail: "Heritage overlay applies — demolitions, colours and front-fence works need council consent.",
      brightModes: CADASTRAL_MODES,
    });
  }

  const flood = overlays.find((o) => o.kind === "flood");
  if (flood) {
    chips.push({
      id: "flood",
      group: "planning",
      label: flood.label ? `${flood.label} Overland Flow` : "Overland Flow",
      value: "Constraint",
      detail: "Overland-flow / flooding overlay applies — floor levels and drainage need SBO checks.",
      brightModes: CADASTRAL_MODES,
    });
  }

  if (overlays.some((o) => o.kind === "water_corp")) {
    chips.push({
      id: "water_corp",
      group: "planning",
      label: "Water Corp",
      value: "Constraint",
      detail: "Water-corporation asset overlay crosses or abuts the site — BYDA before digging.",
      brightModes: CADASTRAL_MODES,
    });
  }

  const easementCount = input.easementRingCount ?? overlays.filter((o) => o.kind === "easement").length;
  if (easementCount > 0) {
    chips.push({
      id: "easement",
      group: "planning",
      label: easementCount === 1 ? "Rear Easement" : `${easementCount} Easements`,
      value: "Constraint",
      detail: "Legal easement(s) from the title plan — the dig-safety hazard source. BYDA before trenching.",
      brightModes: CADASTRAL_MODES,
    });
  }

  // ResCode A2-6 tree canopy — the site's canopy obligation, live from the
  // title area and the placed trees. Standard identity always travels with
  // the data; a single-standard check is never a permit claim.
  if (input.canopy) {
    const a = input.canopy.assessment;
    if (a.status === "insufficient-data") {
      chips.push({
        id: "a26-canopy",
        group: "planning",
        label: "Site area unknown",
        value: "A2-6",
        detail:
          "Clause 54.02-6 (Standard A2-6, VC298): 1 canopy tree per 100 m² of site area, ≥6 m height / ≥4 m canopy at maturity. The site area is not known yet — the requirement reads once the title hydrates. Single-standard check — not a permit or VicSmart eligibility claim.",
        brightModes: CADASTRAL_MODES,
      });
    } else {
      const bits = [
        "Clause 54.02-6 (Standard A2-6, VC298): 1 canopy tree per 100 m² of site area, ≥6 m height / ≥4 m canopy at maturity.",
        a.status === "compliant"
          ? `Compliant: ${a.matureProvided} of ${a.required} canopy trees provided (${a.immature.length} below maturity minimums).`
          : `Shortfall: ${a.matureProvided} of ${a.required} canopy trees provided — ${a.shortfall} more needed (${a.immature.length} placed below maturity minimums).`,
      ];
      if (input.canopy.overhangingCount > 0) {
        bits.push(
          `${input.canopy.overhangingCount} crown(s) cross the title line — advisory only; crowns may overhang the fence by design.`,
        );
      }
      if (input.canopy.outsideCount > 0) {
        bits.push(`${input.canopy.outsideCount} tree centre(s) sit outside the title boundary.`);
      }
      if (input.canopy.areaDisagreement) {
        bits.push(
          "Title lot area and the drawn boundary disagree — reconcile the trace before relying on this count.",
        );
      }
      bits.push("Single-standard check — not a permit or VicSmart eligibility claim.");
      chips.push({
        id: "a26-canopy",
        group: "planning",
        label: `${a.matureProvided}/${a.required} canopy trees`,
        value: "A2-6",
        detail: bits.join(" "),
        brightModes: CADASTRAL_MODES,
      });
    }
  }

  // --- Terrain & environmental ------------------------------------------
  const fall = steepestFall(input.heightmap ?? []);
  if (fall) {
    chips.push({
      id: "slope",
      group: "terrain",
      label: `${fall.slopeDeg}° ${fall.aspect} Slope`,
      value: "Terrain",
      detail: `Steepest spot-level fall ${fall.slopePct}% across the site — drainage, terraces and machine access read off this.`,
      brightModes: TERRESTRIAL_MODES,
    });
  }

  if (typeof input.sunHours === "number" && input.sunHours > 0) {
    chips.push({
      id: "sun",
      group: "terrain",
      label: `${input.sunHours.toFixed(1)}h Sun Window`,
      value: "Solar",
      detail: "Unshaded daylight window at this latitude for today's date (real solar geometry). Canopy-adjusted exposure reads from the flora ring's live sun model.",
      brightModes: TERRESTRIAL_MODES,
    });
  }

  if ((input.heightmap?.length ?? 0) >= 3) {
    chips.push({
      id: "relief",
      group: "terrain",
      label: `Spot levels · ${input.heightmap!.length}`,
      value: "Relief",
      detail: "Terrain relief from site spot levels (IDW heightmap) — contour work and cut/fill ground truth.",
      brightModes: TERRESTRIAL_MODES,
    });
  }

  // Site envelope — the fused growing conditions that pre-filter the
  // planting palette (planting becomes an aesthetic decision). Bright in
  // the modes where plants are chosen.
  if (input.envelope) {
    const e = input.envelope;
    const [winter, summer] = e.seasonalSun;
    const bits = [
      `Sun: winter ${winter!.meanHours.toFixed(1)}h / summer ${summer!.meanHours.toFixed(1)}h (indicative solar model) → ${e.plantingSunClass.replace("_", " ")} palette bound.`,
    ];
    if (e.wetness.drivers.length > 0) {
      bits.push(
        `Wetness — ${e.wetness.class.replace("_", " ")}: ${e.wetness.drivers.map((d) => d.evidence).join("; ")}.`,
      );
    } else {
      bits.push("Wetness — dry: no flood/wetland overlay and no terrain ponding detected.");
    }
    if (e.slope) bits.push(`Slope ${e.slope.slopeDeg.toFixed(1)}° facing ${e.slope.aspect}.`);
    if (e.acidSulfate) bits.push("Acid-sulfate soils flagged — excavation and root-zone constraint (Vicmap).");
    if (e.nativeVegetationLabel) {
      bits.push(`Native vegetation class: ${e.nativeVegetationLabel} (NatureKit EVC) — soil/moisture context.`);
    }
    bits.push(
      "Indicative model (Phase 1) — soil is overlay-derived, not a soil survey; verify on site before construction.",
    );
    chips.push({
      id: "site-envelope",
      group: "terrain",
      label: e.summaryLine,
      value: "Envelope",
      detail: bits.join(" "),
      brightModes: ["sketch", "cad", "garden"],
    });
  }

  return chips;
}
