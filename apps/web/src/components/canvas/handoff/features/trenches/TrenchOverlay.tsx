"use client";

import type { ConstructionTrench } from "@workstream/contracts";
import { trenchKindLabel } from "@workstream/domain";
import type { PctPoint } from "../../geometry";
import type { BoardCamera } from "../../geometry/cameraPointer";
import { CameraChrome } from "../../CameraChrome";
import { CSS_TOKEN } from "../../../../../styles/colorTokens";
import css from "./trenches.module.css";

type Props = {
  trenches: ConstructionTrench[];
  cam?: BoardCamera;
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
 * Construction trench / conduit runs — landscape dig paths (not survey Servc).
 * Ghost proposals show Accept / Reject until committed to DesignCanvas.
 */
export function TrenchOverlay({
  trenches,
  cam,
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
                strokeWidth={t.kind === "irrig_main" ? 0.55 : 0.4}
                strokeDasharray={
                  t.ghost
                    ? "1.2 0.9"
                    : t.kind === "lighting_conduit"
                      ? "1.6 0.8"
                      : t.kind === "drainage"
                        ? "2.2 0.7"
                        : undefined
                }
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
        const labelNode = (
          <span className={css.label}>
            {t.ghost ? "Propose · " : ""}
            {trenchKindLabel(t.kind)} · {depth} mm
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
            {trenchKindLabel(t.kind)} · {depth} mm
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
