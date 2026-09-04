"use client";

/**
 * TidyPreviewLayer — the live Z preview for the Tidy HUD (§7.3).
 *
 * While the HUD is up, its stroke's ghost is drawn at `tidyPreviewZ` in the
 * 3D scene so cycling the plane toggle moves real geometry in real space —
 * the operator commits what they see, not what a label claims. A vertical
 * drop line from the ghost down to grade carries the height reading (the
 * same depth cue the depth rail owns in chrome).
 *
 * Pure overlay: no interaction, no persistence. Unmounts empty when no HUD
 * is up or the preview is at grade (grade ink is already on screen).
 */

import { useMemo } from "react";
import { Line, Html } from "@react-three/drei";
import { useStudioStore } from "./studioStore";
import { pctToWorld } from "./coordTransform";
import { PALETTE } from "../../../styles/colorTokens";

/** Small lift above the plane so the preview never z-fights plane bands. */
const PREVIEW_Y_EPS = 0.03;

export function TidyPreviewLayer({
  scaleM,
  boardAspect,
}: {
  scaleM: number;
  boardAspect: number;
}) {
  const tidyHud = useStudioStore((s) => s.tidyHud);
  const tidyPreviewZ = useStudioStore((s) => s.tidyPreviewZ);
  const strokes = useStudioStore((s) => s.sketchStrokes);

  const stroke = tidyHud
    ? strokes.find((s) => s.id === tidyHud.strokeId) ?? null
    : null;

  const ghost = useMemo(() => {
    if (!stroke || !tidyPreviewZ || tidyPreviewZ <= 0) return null;
    const pts = stroke.points ?? [];
    if (pts.length < 2) return null;
    const y = tidyPreviewZ + PREVIEW_Y_EPS;
    const world = pts.map((p) => {
      const [x, z] = pctToWorld(
        { x: p.x_pct, y: p.y_pct },
        scaleM,
        boardAspect,
      );
      return [x, y, z] as [number, number, number];
    });
    // Drop line: from the ghost's first point down to grade.
    const first = world[0]!;
    const drop: [number, number, number][] = [
      [first[0], y, first[2]],
      [first[0], 0, first[2]],
    ];
    return { world, drop, tag: { x: first[0], y, z: first[2] } };
  }, [stroke, tidyPreviewZ, scaleM, boardAspect]);

  if (!ghost) return null;

  return (
    <group data-testid="tidy-preview-layer">
      <Line
        points={ghost.world}
        color={PALETTE.gsPrimary}
        lineWidth={2.5}
        dashed
        dashSize={0.35}
        gapSize={0.22}
        transparent
        opacity={0.85}
      />
      <Line
        points={ghost.drop}
        color={PALETTE.gsPrimary}
        lineWidth={1}
        dashed
        dashSize={0.18}
        gapSize={0.14}
        transparent
        opacity={0.5}
      />
      {/* Elevation tag — in PLAN (top-down ortho) the lift projects to the
          same pixels as the ink, so the preview is invisible exactly in the
          default view (2026-09-04 vision pass). The tag carries the height
          where the operator is looking. */}
      <Html
        position={[ghost.tag.x, ghost.tag.y, ghost.tag.z]}
        center
        style={{ pointerEvents: "none" }}
      >
        <span
          style={{
            fontFamily: "var(--ws-font-tech)",
            fontSize: "var(--ws-text-micro)",
            fontWeight: 700,
            color: "var(--ws-active-ink)",
            background: "var(--ws-active)",
            border: "1px solid var(--ws-line)",
            borderRadius: 3,
            padding: "2px 6px",
            whiteSpace: "nowrap",
          }}
        >
          +{tidyPreviewZ!.toFixed(1)} m
        </span>
      </Html>
    </group>
  );
}
