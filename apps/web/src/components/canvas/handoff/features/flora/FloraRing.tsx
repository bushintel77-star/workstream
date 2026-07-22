"use client";

import type { FloraCandidate } from "@workstream/domain";
import { CameraChrome } from "../../CameraChrome";
import type { BoardCamera } from "../../geometry/cameraPointer";
import css from "./floraRing.module.css";

type Props = {
  xPct: number;
  yPct: number;
  candidates: FloraCandidate[];
  activeIdx: number;
  previewSpreadPct: number;
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
 */
export function FloraRing({
  xPct,
  yPct,
  candidates,
  activeIdx,
  previewSpreadPct,
  cam,
  onActiveIdx,
  onAccept,
  onDismiss,
}: Props) {
  const active = candidates[activeIdx] ?? null;

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
              onClick={() => onAccept(c)}
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
      <div className={css.actions}>
        {active ? (
          <button
            type="button"
            className={css.accept}
            data-testid="flora-accept"
            onClick={() => onAccept(active)}
          >
            Place {active.label}
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
