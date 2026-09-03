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
  const setCameraPreset = useStudioStore((s) => s.setCameraPreset);

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
    const next = (selectedIdx + 1) % strikes.length;
    setSelectedIdx(next);
    setCardOpen(true);
    // Fly the camera to the strike — switch to 3D to see the depth context
    const strike = strikes[next];
    if (strike) {
      setCameraPreset("3d");
    }
  }

  const selected = strikes[selectedIdx];

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
        <span>Depth</span>
        <span>{strike.point[1].toFixed(1)}m</span>
      </div>
      <div className={styles.conflictCardRow}>
        <span>Position</span>
        <span>E {strike.point[0].toFixed(1)} · N {strike.point[2].toFixed(1)}</span>
      </div>
      {strike.excavationId && (
        <div className={styles.conflictCardRow}>
          <span>Trench</span>
          <span>{strike.excavationId}</span>
        </div>
      )}
      <div className={styles.conflictCardActions}>
        <button className={styles.conflictCardAction} data-action="reroute">REROUTE</button>
        <button className={styles.conflictCardAction} data-action="deepen">DEEPEN</button>
        <button className={styles.conflictCardAction} data-action="flag">FLAG</button>
      </div>
      <div className={styles.conflictCardStamp}>indicative only, not a substitute for locating</div>
    </div>
  );
}
