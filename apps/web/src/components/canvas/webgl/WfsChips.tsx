/*
 * Landscape Canvas v2 — WFS context chips (handoff §5.4).
 *
 * Top bar: PrimaryChip (project name + AXO 22° · N↑ · 1:200) then a 1px
 * divider, then translucent pills for active overlays derived from real
 * site-frame records.
 */

import type { DesignKeylessOverlay } from "@workstream/contracts";
import type { CanopyComplianceResult } from "./canopyCompliance";
import { useStudioStore } from "./studioStore";
import styles from "./WfsChips.module.css";

export interface OverlayChip {
  id: string;
  label: string;
  glyph?: string;
  hazard?: boolean;
  title?: string;
}

export function buildCanopyObligationChip(
  canopy: CanopyComplianceResult | null | undefined,
): OverlayChip | null {
  if (!canopy) return null;
  const a = canopy.assessment;
  if (a.status === "insufficient-data") {
    return {
      id: "a26-canopy",
      label: "A2-6",
      title: "ResCode A2-6 canopy obligation — site area unknown, requirement unasserted",
    };
  }
  return {
    id: "a26-canopy",
    label: `A2-6 ${a.matureProvided}/${a.required}`,
    title:
      a.shortfall > 0
        ? `A2-6 — ${a.shortfall} more canopy tree${a.shortfall === 1 ? "" : "s"} required (${a.matureProvided} of ${a.required})`
        : `A2-6 — canopy obligation met (${a.matureProvided} of ${a.required})`,
  };
}

export function buildWfsOverlayChips(
  overlays: DesignKeylessOverlay[],
  easementRingCount: number,
  canopy?: CanopyComplianceResult | null,
): OverlayChip[] {
  const chips: OverlayChip[] = [];

  const planning = overlays.find((o) => o.kind === "planning");
  if (planning) {
    chips.push({
      id: "planning",
      label: planning.label?.trim()
        ? `${planning.label.trim()} Zone`
        : "Planning Zone",
    });
  }

  const bushfire = overlays.find((o) => o.kind === "bushfire");
  if (bushfire) {
    chips.push({ id: "bushfire", label: bushfire.label?.trim() || "BAL", glyph: "▲", hazard: true });
  }

  const flood = overlays.find((o) => o.kind === "flood");
  if (flood) {
    chips.push({ id: "flood", label: flood.label?.trim() || "Overland Flow", glyph: "▲", hazard: true });
  }

  if (overlays.some((o) => o.kind === "water_corp")) {
    chips.push({ id: "water_corp", label: "Water Corp", glyph: "▲", hazard: true });
  }

  const easementCount =
    easementRingCount > 0
      ? easementRingCount
      : overlays.filter((o) => o.kind === "easement").length;
  if (easementCount > 0) {
    chips.push({
      id: "easement",
      label: easementCount === 1 ? "1 Easement" : `${easementCount} Easements`,
      glyph: "▲",
      hazard: true,
    });
  }

  if (overlays.some((o) => o.kind === "acid_sulfate")) {
    chips.push({ id: "acid_sulfate", label: "Acid Sulfate", glyph: "▲", hazard: true });
  }

  const heritage = overlays.find((o) => o.kind === "heritage");
  if (heritage) {
    chips.push({
      id: "heritage",
      label: heritage.label?.trim() ? `${heritage.label.trim()} Heritage` : "Heritage",
    });
  }

  if (overlays.some((o) => o.kind === "road_casement")) {
    chips.push({ id: "road_casement", label: "Road Casement" });
  }

  if (overlays.some((o) => o.kind === "wetland")) {
    chips.push({ id: "wetland", label: "Wetland" });
  }

  const canopyWash = overlays.find(
    (o) => o.kind === "urban_tree" || o.kind === "native_vegetation",
  );
  if (canopyWash) {
    chips.push({ id: "canopy", label: canopyWash.label?.trim() || "Canopy" });
  }

  const obligation = buildCanopyObligationChip(canopy);
  if (obligation) chips.push(obligation);

  return chips;
}

export interface WfsChipsProps {
  /** Explicit chips, including an explicit empty array, take precedence. */
  overlays?: OverlayChip[];
  keylessOverlays?: DesignKeylessOverlay[];
  easementRingCount?: number;
  canopy?: CanopyComplianceResult | null;
  northBearingDeg?: number | null;
  scaleRatio?: string;
}

export function WfsChips({
  overlays: overlaysProp,
  keylessOverlays = [],
  easementRingCount = 0,
  canopy = null,
  northBearingDeg = null,
  scaleRatio = "1:200",
}: WfsChipsProps) {
  const projectAddress = useStudioStore((s) => s.projectAddress);
  const cameraPreset = useStudioStore((s) => s.cameraPreset);
  const penDown = useStudioStore((s) => s.penDown);
  const setbackLines = useStudioStore((s) => s.setbackLines);

  const cameraLabel =
    cameraPreset === "plan" ? "PLAN"
      : cameraPreset === "axo" ? "AXO 22°"
      : cameraPreset === "sec" ? "SEC"
      : "3D";
  const northLabel = northBearingDeg != null ? "N↑" : "N?";

  const derived = buildWfsOverlayChips(keylessOverlays, easementRingCount, canopy);
  const chips = overlaysProp !== undefined ? [...overlaysProp] : derived;
  if (setbackLines.length > 0 && !chips.some((chip) => chip.id === "setbacks")) {
    chips.push({ id: "setbacks", label: "Setbacks" });
  }

  const visibleOverlays = chips.slice(0, 4);
  const overflowCount = chips.length - visibleOverlays.length;

  return (
    <div
      className={`${styles.chipBar} ${penDown ? styles.chipBarQuiet : ""}`}
      data-testid="wfs-chip-bar"
    >
      <div className={styles.primaryChip}>
        <div className={styles.primaryAccentSquare} />
        <span className={styles.primaryName} title={projectAddress || "Untitled site"}>
          {projectAddress || "Untitled site"}
        </span>
        <span className={styles.primaryMeta}>{cameraLabel} · {northLabel} · {scaleRatio}</span>
      </div>
      {visibleOverlays.length > 0 && <div className={styles.divider} />}
      {visibleOverlays.map((chip) => (
        <div
          key={chip.id}
          className={`${styles.overlayPill} ${chip.hazard ? styles.overlayPillHazard : ""}`}
          data-overlay-id={chip.id}
          title={chip.title}
        >
          {chip.glyph && <span className={styles.overlayGlyph}>{chip.glyph}</span>}
          <span className={styles.overlayLabel}>{chip.label}</span>
        </div>
      ))}
      {overflowCount > 0 && <div className={styles.overflowChip}>+{overflowCount} WFS</div>}
    </div>
  );
}
