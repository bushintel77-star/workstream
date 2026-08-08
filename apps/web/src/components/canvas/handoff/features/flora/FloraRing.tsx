"use client";

import { useMemo } from "react";
import {
  assessPlantingPlacement,
  plantingConflictSummary,
  type FloraCandidate,
  type PlantingGuardItem,
} from "@workstream/domain";
import { CameraChrome } from "../../CameraChrome";
import type { BoardCamera } from "../../geometry/cameraPointer";
import css from "./floraRing.module.css";

type Props = {
  xPct: number;
  yPct: number;
  candidates: FloraCandidate[];
  activeIdx: number;
  previewSpreadPct: number;
  guardItems: PlantingGuardItem[];
  scaleM: number;
  /**
   * Live board camera — the botanical card portals through it so the
   * frosted chip stays constant-size while the ghost canopy stays inside
   * the world layer (scales with the drawing).
   */
  cam?: BoardCamera;
  onActiveIdx: (idx: number) => void;
  onAccept: (candidate: FloraCandidate) => void;
  onDismiss: () => void;
};

/**
 * Inline Flora Ring — holographic botanical HUD under the planting click.
 * Canvas-First: no sidebar filters; Accept / Reject only.
 * Pre-place TPZ / mature canopy conflict surfaces before Accept.
 */
export function FloraRing({
  xPct,
  yPct,
  candidates,
  activeIdx,
  previewSpreadPct,
  guardItems,
  scaleM,
  cam,
  onActiveIdx,
  onAccept,
  onDismiss,
}: Props) {
  const active = candidates[activeIdx] ?? null;

  const conflict = useMemo(() => {
    if (!active) return { blocked: false, tip: null as string | null };
    const conflicts = assessPlantingPlacement({
      xPct,
      yPct,
      canopySpreadM: active.canopySpreadM,
      items: guardItems,
      scaleM,
    });
    return plantingConflictSummary(conflicts);
  }, [active, xPct, yPct, guardItems, scaleM]);

  const cardBody = (
    <div className={css.ring} data-testid="flora-ring">
      <p className={css.kicker}>Flora · indicative</p>
      <ul className={css.list}>
        {candidates.map((c, i) => (
          <li key={c.symbolId}>
            <button
              type="button"
              className={`${css.chip}${i === activeIdx ? ` ${css.chipActive}` : ""}`}
              data-testid={`flora-chip-${c.symbolId}`}
              onMouseEnter={() => onActiveIdx(i)}
              onFocus={() => onActiveIdx(i)}
              onClick={() => onActiveIdx(i)}
            >
              <span className={css.chipName}>{c.label}</span>
              <span className={css.chipMeta}>
                {c.botanicalName} · {c.matureHeightM.toFixed(1)} m ·{" "}
                {c.sun}
              </span>
              <span className={css.chipWhy}>{c.why}</span>
              {c.plantWindow === "spring_hold" ? (
                <span className={css.chipHold}>Spring hold</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {conflict.tip ? (
        <p
          className={conflict.blocked ? css.conflictBlock : css.conflictWarn}
          data-testid="flora-place-conflict"
          data-severity={conflict.blocked ? "block" : "warn"}
        >
          {conflict.tip}
        </p>
      ) : null}
      <div className={css.actions}>
        {active ? (
          <button
            type="button"
            className={css.accept}
            data-testid="flora-accept"
            disabled={conflict.blocked}
            onClick={() => onAccept(active)}
          >
            {conflict.blocked ? "Blocked — shift clear" : `Place ${active.label}`}
          </button>
        ) : null}
        <button
          type="button"
          className={css.dismiss}
          data-testid="flora-dismiss"
          onClick={onDismiss}
        >
          Not now
        </button>
      </div>
      <p className={css.honesty}>
        Indicative suitability — confirm on site / soil / nursery lead time
      </p>
    </div>
  );

  return (
    <div
      className={css.layer}
      data-testid="flora-ring-layer"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {active ? (
        <div
          className={css.ghostCanopy}
          data-testid="flora-ghost-canopy"
          data-plan-geometry="1"
          data-conflict={conflict.blocked ? "block" : conflict.tip ? "warn" : "ok"}
          style={{
            left: `${xPct}%`,
            top: `${yPct}%`,
            width: `${previewSpreadPct}%`,
            height: `${previewSpreadPct * 0.75}%`,
          }}
          title={`${active.label} · mature ≈ ${active.canopySpreadM.toFixed(1)} m`}
        />
      ) : null}

      <div
        className={css.crosshair}
        data-plan-geometry="1"
        style={{ left: `${xPct}%`, top: `${yPct}%` }}
        aria-hidden
      />

      {cam ? (
        <CameraChrome
          place={{
            kind: "project",
            pct: { x: xPct, y: yPct },
            cam,
            transform: "translate(-50%, calc(-100% - 16px))",
          }}
        >
          {cardBody}
        </CameraChrome>
      ) : (
        <div style={{ position: "absolute", left: `${xPct}%`, top: `${yPct}%` }}>
          {cardBody}
        </div>
      )}
    </div>
  );
}
