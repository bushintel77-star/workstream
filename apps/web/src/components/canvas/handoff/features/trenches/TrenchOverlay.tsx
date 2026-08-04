"use client";

import type { ConstructionTrench } from "@workstream/contracts";
import { trenchKindLabel } from "@workstream/domain";
import type { PctPoint } from "../../geometry";
import type { BoardCamera } from "../../geometry/cameraPointer";
import { CameraChrome } from "../../CameraChrome";
import { CSS_TOKEN } from "../../../../../styles/colorTokens";
import { weightFor } from "../render/lineWeight";
import css from "./trenches.module.css";

type Props = {
  trenches: ConstructionTrench[];
  cam?: BoardCamera;
  /** Board width metres (100% span) — for per-run length labels. */
  scaleM?: number;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
};

const STROKE: Record<ConstructionTrench["kind"], string> = {
  irrig_main: CSS_TOKEN.hedge,
  irrig_lateral: CSS_TOKEN.plantingNewStroke,
  lighting_conduit: CSS_TOKEN.textSecondary,
  drainage: CSS_TOKEN.water,
};

/**
 * Distinct dash signature per trench kind — readable at a glance on the plan.
 *   irrig_main:    long dash (solid-ish, main feed)
 *   irrig_lateral: short dash (lateral feeder)
 *   lighting_conduit: dot-dash (conduit, electrical signature)
 *   drainage:      long-short (ag-pipe, distinct from irrigation)
 * Ghosts use a tight dotted pattern regardless of kind.
 */
const DASH_LIVE: Record<ConstructionTrench["kind"], string> = {
  irrig_main: "3 0.8",
  irrig_lateral: "1.2 0.9",
  lighting_conduit: "1.6 0.8 0.3 0.8",
  drainage: "2.4 0.7 0.8 0.7",
};
const DASH_GHOST = "1 1";

/** Per-run polyline length in metres — board width = scaleM across 100%. */
function trenchLengthM(
  t: ConstructionTrench,
  scaleM: number,
): string {
  if (t.points.length < 2 || scaleM <= 0) return "0";
  let sum = 0;
  for (let i = 1; i < t.points.length; i++) {
    const a = t.points[i - 1]!;
    const b = t.points[i]!;
    const dx = ((b.x_pct - a.x_pct) / 100) * scaleM;
    const dy = ((b.y_pct - a.y_pct) / 100) * scaleM;
    sum += Math.hypot(dx, dy);
  }
  if (sum < 10) return sum.toFixed(1);
  return Math.round(sum).toString();
}

/**
 * Construction trench / conduit runs — landscape dig paths (not survey Servc).
 * Ghost proposals show Accept / Reject until committed to DesignCanvas.
 */
export function TrenchOverlay({
  trenches,
  cam,
  scaleM = 110,
  onAcceptAll,
  onRejectAll,
}: Props) {
  if (trenches.length === 0) return null;

  const ghosts = trenches.filter((t) => t.ghost);
  const live = trenches.filter((t) => !t.ghost);

  return (
    <div className={css.root} data-testid="trench-overlay" aria-hidden>
      <svg
        className={css.svg}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {[...live, ...ghosts].map((t) => {
          const pts = t.points.map((p) => ({ x: p.x_pct, y: p.y_pct }));
          const stroke = STROKE[t.kind];
          return (
            <g
              key={t.id}
              data-testid={`trench-path-${t.kind}`}
              data-ghost={t.ghost ? "true" : "false"}
            >
              <polyline
                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={stroke}
                strokeWidth={
                  t.kind === "irrig_main"
                    ? weightFor("trench-main")
                    : weightFor("trench")
                }
                strokeDasharray={t.ghost ? DASH_GHOST : DASH_LIVE[t.kind]}
                vectorEffect="non-scaling-stroke"
                opacity={t.ghost ? 0.65 : 0.92}
              />
            </g>
          );
        })}
      </svg>

      {trenches.map((t) => {
        const p0 = t.points[0];
        if (!p0) return null;
        const labelPct: PctPoint = { x: p0.x_pct, y: p0.y_pct };
        const depth = t.depth_mm ?? 300;
        const lengthM = trenchLengthM(t, scaleM);
        const labelNode = (
          <span className={css.label}>
            {t.ghost ? "Propose · " : ""}
            {trenchKindLabel(t.kind)} · {lengthM} m @ {depth} mm
          </span>
        );
        return cam ? (
          <CameraChrome
            key={t.id}
            place={{
              kind: "project",
              pct: labelPct,
              cam,
              transform: "none",
            }}
          >
            {labelNode}
          </CameraChrome>
        ) : (
          <span
            key={t.id}
            className={css.label}
            style={{
              position: "absolute",
              left: `${labelPct.x}%`,
              top: `${labelPct.y}%`,
            }}
          >
            {t.ghost ? "Propose · " : ""}
            {trenchKindLabel(t.kind)} · {lengthM} m @ {depth} mm
          </span>
        );
      })}

      {ghosts.length > 0 && onAcceptAll && onRejectAll ? (
        <CameraChrome>
          <div className={css.review} data-testid="trench-ghost-review">
            <span>
              {ghosts.length} trench proposal{ghosts.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className={`${css.reviewBtn} ${css.reviewBtnPrimary}`}
              data-testid="trench-accept-all"
              onClick={onAcceptAll}
            >
              Accept
            </button>
            <button
              type="button"
              className={css.reviewBtn}
              data-testid="trench-reject-all"
              onClick={onRejectAll}
            >
              Reject
            </button>
          </div>
        </CameraChrome>
      ) : null}
    </div>
  );
}
