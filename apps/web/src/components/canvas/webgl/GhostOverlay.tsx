"use client";

/**
 * Ghost Overlay — renders AI-generated placements as translucent markers
 * on the canvas, awaiting accept/reject.
 *
 * DOM overlay (not R3F) for Phase 1: simple translucent discs positioned
 * via the same pctToWorld coordinate chain. Each ghost shows a species
 * label on hover. The overlay vanishes when the session clears.
 */

import { useStudioStore } from "./studioStore";
import { pctToWorld, type PctPoint } from "./coordTransform";
import { getCatalogSymbol } from "@workstream/domain";

export function GhostOverlay({
  scaleM,
  boardAspect,
}: {
  scaleM: number;
  boardAspect: number;
}) {
  const aiSession = useStudioStore((s) => s.aiSession);
  if (aiSession.status !== "ready" || aiSession.ghosts.length === 0) return null;

  return (
    <div
      data-testid="ai-ghost-overlay"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: "var(--cf-z-spatial)",
        overflow: "hidden",
      }}
    >
      {aiSession.ghosts.map((ghost) => {
        const [wx, wz] = pctToWorld(
          { x: ghost.x_pct, y: ghost.y_pct } as PctPoint,
          scaleM,
          boardAspect,
        );
        // Convert world metres to a viewport percentage (approximate:
        // the canvas is full-viewport; world coords are relative to the
        // board centre at (0,0)).
        const leftPct = 50 + (wx / (scaleM * 1.5)) * 50;
        const topPct = 50 + (wz / (scaleM * 1.5)) * 50;
        const radius = ghost.canopy_radius_m
          ? Math.max(12, Math.min(48, (ghost.canopy_radius_m / scaleM) * 200))
          : 18;
        const sym = getCatalogSymbol(ghost.symbol_id);
        return (
          <div
            key={ghost.id}
            data-testid={`ai-ghost-${ghost.id}`}
            title={`${sym?.label ?? ghost.symbol_id}${ghost.height_m ? ` · ${ghost.height_m}m` : ""}`}
            style={{
              position: "absolute",
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: radius * 2,
              height: radius * 2,
              marginLeft: -radius,
              marginTop: -radius,
              borderRadius: "50%",
              background: "color-mix(in srgb, var(--la-highlight) 20%, transparent)",
              border: "2px dashed var(--la-highlight)",
              opacity: 0.6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: radius > 20 ? "var(--gs-font-xs)" : "var(--gs-font-micro)",
              color: "var(--la-highlight)",
              fontFamily: "var(--font-tech)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {radius > 20 ? (sym?.label ?? "").split(" ")[0] : ""}
          </div>
        );
      })}
    </div>
  );
}
