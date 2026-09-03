"use client";

/**
 * Phase N — Strike chip + conflict card (spec §11a).
 *
 * The strike chip sits in the top bar beside the WFS chips. It shows the
 * strike count + severity, and tapping it cycles through strikes (flying
 * the camera to each). The in-scene pulse is halo-opacity only (1400ms) —
 * no scale, no colour flash.
 *
 * The conflict card opens when a strike is selected: utility, trench depth,
 * clearance, tolerance, severity + REROUTE / DEEPEN / FLAG, labelled
 * `indicative`.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase N.
 * Reference: README §11a.
 */

import { useState } from "react";
import type { StrikeAlertData } from "./features/SubsurfaceEngine";
import { useStudioStore } from "./studioStore";
import styles from "./WfsChips.module.css";

export interface StrikeChipProps {
  strikes: StrikeAlertData[];
}

const SEVERITY_LABEL: Record<StrikeAlertData["severity"], string> = {
  direct: "DIRECT",
  near: "NEAR",
  proximity: "PROX",
};

export function StrikeChip({ strikes }: StrikeChipProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [cardOpen, setCardOpen] = useState(false);
  const focusWorldPoint = useStudioStore((s) => s.focusWorldPoint);

  if (strikes.length === 0) return null;

  // Count by severity
  const direct = strikes.filter((s) => s.severity === "direct").length;
  const near = strikes.filter((s) => s.severity === "near").length;
  const proximity = strikes.filter((s) => s.severity === "proximity").length;

  const severityParts: string[] = [];
  if (direct > 0) severityParts.push(`${direct} direct`);
  if (near > 0) severityParts.push(`${near} near`);
  if (proximity > 0) severityParts.push(`${proximity} prox`);

  const hasDirect = direct > 0;

  function cycleStrike() {
    // Opening lands on the current strike; every tap after that advances.
    const next = cardOpen ? (selectedIdx + 1) % strikes.length : selectedIdx;
    setSelectedIdx(next);
    setCardOpen(true);
    // Fly the camera to the strike. This used to read `strikes[next]` and
    // then throw it away, calling `setCameraPreset("3d")` instead — the
    // camera never moved, and the forced preset locked GRADE and MEASURE
    // (chrome contract) just as the operator needed them. Move the look
    // target, leave the operator's camera state alone.
    const strike = strikes[next];
    if (strike) focusWorldPoint(strike.point[0], strike.point[2]);
  }

  // A recomputed strike set can be shorter than the last index we held.
  const selected = strikes[Math.min(selectedIdx, strikes.length - 1)];

  return (
    <>
      <button
        className={`${styles.overlayPill} ${hasDirect ? styles.overlayPillHazard : ""}`}
        data-testid="strike-chip"
        data-strike-count={strikes.length}
        data-has-direct={hasDirect ? "true" : undefined}
        onClick={cycleStrike}
        title={`${strikes.length} strike${strikes.length === 1 ? "" : "s"}: ${severityParts.join(", ")}. Tap to cycle.`}
      >
        <span className={styles.overlayGlyph}>{"\u26A0"}</span>
        <span className={styles.overlayLabel}>{strikes.length} STRIKE{strikes.length === 1 ? "" : "S"}</span>
      </button>
      {cardOpen && selected && (
        <ConflictCard
          strike={selected}
          onClose={() => setCardOpen(false)}
        />
      )}
    </>
  );
}

/** Clearance the DEEPEN action drops the trench below the strike depth (mm).
 *  Indicative landscape-construction practice, not a DBYD clearance. */
const DEEPEN_CLEARANCE_MM = 300;

/**
 * The N.2 rows the card owes the operator beyond severity and position:
 * trench depth, the clearance between the two, and the hazard's locating
 * tolerance. Clearance is signed on purpose — a negative number is the
 * trench cutting THROUGH the service, and reading "-120mm" is the point.
 */
function TrenchRows({ strike }: { strike: StrikeAlertData }) {
  const trench = useStudioStore((s) =>
    strike.excavationId
      ? s.constructionTrenches.find((t) => t.id === strike.excavationId)
      : undefined,
  );
  const strikeDepthMm = Math.round(Math.abs(strike.point[1]) * 1000);
  const toleranceMm =
    strike.toleranceM != null ? Math.round(strike.toleranceM * 1000) : null;
  const clearanceMm = trench ? strikeDepthMm - trench.depth_mm : null;
  return (
    <>
      {trench && (
        <div className={styles.conflictCardRow}>
          <span>Trench</span>
          <span>
            {trench.name} · {trench.depth_mm}mm
          </span>
        </div>
      )}
      {clearanceMm != null && (
        <div className={styles.conflictCardRow}>
          <span>Clearance</span>
          <span>
            {clearanceMm >= 0
              ? `${clearanceMm}mm below the trench`
              : `${Math.abs(clearanceMm)}mm INTO the service`}
          </span>
        </div>
      )}
      <div className={styles.conflictCardRow}>
        <span>Tolerance</span>
        <span>
          {toleranceMm != null ? `±${toleranceMm}mm` : "not stated"}
          {strike.depthSource ? ` · depth ${strike.depthSource}` : ""}
        </span>
      </div>
    </>
  );
}

function ConflictActions({
  strike,
  onClose,
}: {
  strike: StrikeAlertData;
  onClose: () => void;
}) {
  const trench = useStudioStore((s) =>
    strike.excavationId
      ? s.constructionTrenches.find((t) => t.id === strike.excavationId)
      : undefined,
  );
  const updateTrench = useStudioStore((s) => s.updateConstructionTrench);
  const setTrenchTool = useStudioStore((s) => s.setTrenchTool);

  // The three actions all operate on the trench that caused the strike.
  // Without one there is nothing to reroute, deepen or flag — so the row
  // says so rather than rendering three buttons that cannot act.
  if (!trench) {
    return (
      <div className={styles.conflictCardActions}>
        <span className={styles.conflictCardNoTrench}>
          No excavation is linked to this strike — nothing to reroute or deepen.
        </span>
      </div>
    );
  }

  const strikeDepthMm = Math.round(Math.abs(strike.point[1]) * 1000);
  const deepenedMm = strikeDepthMm + DEEPEN_CLEARANCE_MM;
  const alreadyClear = trench.depth_mm >= deepenedMm;

  return (
    <div className={styles.conflictCardActions}>
      <button
        className={styles.conflictCardAction}
        data-action="reroute"
        title={`Arm the ${trench.kind} trace tool to draw ${trench.name} on a new route`}
        onClick={() => {
          setTrenchTool(trench.kind);
          onClose();
        }}
      >
        REROUTE
      </button>
      <button
        className={styles.conflictCardAction}
        data-action="deepen"
        disabled={alreadyClear}
        title={
          alreadyClear
            ? `${trench.name} is already ${trench.depth_mm}mm — below the ${strikeDepthMm}mm strike`
            : `Take ${trench.name} from ${trench.depth_mm}mm to ${deepenedMm}mm (${DEEPEN_CLEARANCE_MM}mm under the strike)`
        }
        onClick={() => {
          updateTrench(trench.id, {
            depth_mm: deepenedMm,
            why: `Deepened to ${deepenedMm}mm to clear an indicative ${strike.utilityType ?? "service"} strike at ${strikeDepthMm}mm.`,
          });
          onClose();
        }}
      >
        DEEPEN
      </button>
      <button
        className={styles.conflictCardAction}
        data-action="flag"
        title={`Record the conflict on ${trench.name} so it travels with the drawing`}
        onClick={() => {
          updateTrench(trench.id, {
            why: `FLAGGED: indicative ${strike.utilityType ?? "service"} strike at ${strikeDepthMm}mm (${strike.severity}). Locate before excavating.`,
          });
          onClose();
        }}
      >
        FLAG
      </button>
    </div>
  );
}

function ConflictCard({
  strike,
  onClose,
}: {
  strike: StrikeAlertData;
  onClose: () => void;
}) {
  return (
    <div className={styles.conflictCard} data-testid="conflict-card">
      <div className={styles.conflictCardHeader}>
        <span className={styles.conflictCardTitle}>
          INDICATIVE CONFLICT · {strike.utilityType?.toUpperCase() ?? strike.layerId?.toUpperCase() ?? "UNKNOWN"}
        </span>
        <button
          className={styles.conflictCardClose}
          onClick={onClose}
          title="Close conflict card"
        >
          {"\u00D7"}
        </button>
      </div>
      <div className={styles.conflictCardSeverity}>
        Severity: <strong>{SEVERITY_LABEL[strike.severity]}</strong>
      </div>
      <div className={styles.conflictCardRow}>
        <span>Utility</span>
        <span>{strike.utilityType ?? "—"}</span>
      </div>
      <div className={styles.conflictCardRow}>
        <span>Strike depth</span>
        <span>{Math.round(Math.abs(strike.point[1]) * 1000)}mm</span>
      </div>
      <div className={styles.conflictCardRow}>
        <span>Position</span>
        <span>E {strike.point[0].toFixed(1)} · N {strike.point[2].toFixed(1)}</span>
      </div>
      <TrenchRows strike={strike} />
      <ConflictActions strike={strike} onClose={onClose} />
      <div className={styles.conflictCardStamp}>indicative only, not a substitute for locating</div>
    </div>
  );
}
