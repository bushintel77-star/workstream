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

import type { DesignKeylessOverlay } from "@workstream/contracts";
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
      label: `${input.sunHours.toFixed(1)}h Direct Sun`,
      value: "Solar",
      detail: "Direct sun hours at the parcel centre from the live sun model — drives planting exposure choices.",
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

  return chips;
}
