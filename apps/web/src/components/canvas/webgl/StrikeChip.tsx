"use client";

/**
 * Phase N — Strike chip + conflict card (spec §11a).
 *
 * The strike chip sits in the top bar beside the WFS chips. It shows the
 * strike count + severity, and tapping it cycles through strikes (flying
 * the camera to each). The chip is a signal — it does not host the card.
 *
 * The conflict card is a 3D-pinned DOM actor that floats directly over the
 * clash geometry. It reads screen-space coordinates from the store (written
 * every frame by ConflictCardProjector inside the R3F canvas) and positions
 * itself in the DOM overlay with a rigid mechanical offset. The card stays
 * pinned to the geometry through camera orbits and pans — it only
 * self-destructs on explicit resolve (REROUTE/DEEPEN/FLAG) or close (×).
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase N.
 * Reference: README §11a.
 */

import type { StrikeAlertData } from "./features/SubsurfaceEngine";
import { useStudioStore } from "./studioStore";
import styles from "./WfsChips.module.css";

export interface StrikeChipProps {
  strikes: StrikeAlertData[];
}

export function StrikeChip({ strikes }: StrikeChipProps) {
  const focusWorldPoint = useStudioStore((s) => s.focusWorldPoint);
  const openConflictCard = useStudioStore((s) => s.openConflictCard);
  const conflictCardStrikeIdx = useStudioStore((s) => s.conflictCardStrikeIdx);

  if (strikes.length === 0) return null;

  const direct = strikes.filter((s) => s.severity === "direct").length;
  const near = strikes.filter((s) => s.severity === "near").length;
  const proximity = strikes.filter((s) => s.severity === "proximity").length;

  const severityParts: string[] = [];
  if (direct > 0) severityParts.push(`${direct} direct`);
  if (near > 0) severityParts.push(`${near} near`);
  if (proximity > 0) severityParts.push(`${proximity} prox`);

  const hasDirect = direct > 0;
  const cardOpen = conflictCardStrikeIdx != null;

  function cycleStrike() {
    // Opening lands on the current strike; every tap after that advances.
    const next = cardOpen
      ? ((conflictCardStrikeIdx ?? 0) + 1) % strikes.length
      : 0;
    openConflictCard(next);
    const strike = strikes[next];
    if (strike) focusWorldPoint(strike.point[0], strike.point[2]);
  }

  return (
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
  );
}

const SEVERITY_LABEL: Record<StrikeAlertData["severity"], string> = {
  direct: "DIRECT",
  near: "NEAR",
  proximity: "PROX",
};

/** Clearance the DEEPEN action drops the trench below the strike depth (mm). */
const DEEPEN_CLEARANCE_MM = 300;

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

/**
 * PinnedConflictCard — 3D-pinned DOM actor floating over the clash geometry.
 *
 * Reads screen-space coordinates from the store (written every frame by
 * ConflictCardProjector) and positions itself with a rigid mechanical offset
 * (translate(24px, -50%)). The card stays pinned through camera orbits and
 * pans. It only self-destructs on explicit resolve (REROUTE/DEEPEN/FLAG) or
 * close (×). Drawing elsewhere on the canvas does NOT dismiss it — the
 * conflict is a physical fact about the site, not a transient UI state.
 */
export function PinnedConflictCard({ strikes }: { strikes: StrikeAlertData[] }) {
  const screen = useStudioStore((s) => s.conflictCardScreen);
  const strikeIdx = useStudioStore((s) => s.conflictCardStrikeIdx);
  const closeConflictCard = useStudioStore((s) => s.closeConflictCard);

  if (strikeIdx == null || strikes.length === 0) return null;
  const strike = strikes[Math.min(strikeIdx, strikes.length - 1)];
  if (!strike) return null;

  // If the point is behind the camera, hide the card (it will reappear on orbit)
  const visible = screen != null && !screen.behind;
  const left = screen ? `${screen.x}px` : "0px";
  const top = screen ? `${screen.y}px` : "0px";

  return (
    <div
      className={styles.conflictCardPinned}
      data-testid="conflict-card"
      style={{
        left,
        top,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div className={styles.conflictCardInner}>
        <div className={styles.conflictCardHeader}>
          <span className={styles.conflictCardTitle}>
            INDICATIVE CONFLICT · {strike.utilityType?.toUpperCase() ?? strike.layerId?.toUpperCase() ?? "UNKNOWN"}
          </span>
          <button
            className={styles.conflictCardClose}
            onClick={closeConflictCard}
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
        <ConflictActions strike={strike} onClose={closeConflictCard} />
        <div className={styles.conflictCardStamp}>indicative only, not a substitute for locating</div>
      </div>
    </div>
  );
}
