"use client";

/**
 * Gold Standard 2026 — Placement Gizmo (P1 spatial manipulator).
 *
 * Mounts drei <TransformControls> on the single selected placement: drag to
 * translate (0.5 m grid snap) or rotate (45° snap). Every position patch is
 * boundary-clamped per frame via constrainAssetCentre — the gizmo "slips"
 * along the title edge instead of crossing it, and the crimson boundary
 * notice fires on snap. The whole drag is ONE undo step: the pre-drag doc is
 * pushed on first objectChange, transient updates write no history.
 *
 * Selection-driven: renders only while exactly one placement is selected and
 * gizmoMode is armed (translate by default). Camera gestures stand down while
 * a drag is in flight (gizmoDragging flag).
 *
 * The controlled object is drei's internal group (no `object` prop), so the
 * moved position/rotation is read from the drag event's target (`e.target` =
 * the three-stdlib TransformControls, `.object` = the group).
 *
 * Gap provenance: docs/agent-prompts/ui-root-cause-survey.md §2.1 (gizmos —
 * the parity gap this closes); title-boundary rule per AGENTS.md.
 */

import { useMemo, useRef } from "react";
import type { Event as ThreeEvent, Object3D } from "three";
import { TransformControls } from "@react-three/drei";
import { clampBoardPct } from "@workstream/contracts";
import { useStudioStore } from "./studioStore";
import { pctToWorld, worldToPct, type HeightmapPoint } from "./coordTransform";
import { createElevationSampler } from "./terrainMath";

export interface PlacementGizmoProps {
  scaleM: number;
  boardAspect: number;
  heightmapPoints?: HeightmapPoint[];
}

/** The three-stdlib TransformControls surface we read after a drag tick. */
interface GizmoControl {
  object?: Object3D;
}

export function PlacementGizmo({
  scaleM,
  boardAspect,
  heightmapPoints = [],
}: PlacementGizmoProps) {
  const selection = useStudioStore((s) => s.selection);
  const placements = useStudioStore((s) => s.placements);
  const gizmoMode = useStudioStore((s) => s.gizmoMode);
  const setGizmoDragging = useStudioStore((s) => s.setGizmoDragging);
  const beginTransform = useStudioStore((s) => s.beginPlacementTransform);
  const setTransient = useStudioStore((s) => s.setPlacementTransformTransient);
  const endTransform = useStudioStore((s) => s.endPlacementTransform);

  // Terrain drape for the gizmo's resting height (flat projects → y = 0).
  const sampler = useMemo(
    () => createElevationSampler(heightmapPoints, scaleM, boardAspect),
    [heightmapPoints, scaleM, boardAspect],
  );
  // True between the first objectChange of a drag and its mouseup — guards
  // beginPlacementTransform so a click without a move pushes no history.
  const draggingStarted = useRef(false);

  const single = selection.length === 1 ? selection[0]! : null;
  const placement =
    single && single.kind === "placement"
      ? placements.find((p) => p.id === single.id)
      : null;

  const [wx, wz] = placement
    ? pctToWorld({ x: placement.x_pct, y: placement.y_pct }, scaleM, boardAspect)
    : [0, 0];
  const y = sampler ? sampler(wx, wz) + 0.15 : 0;

  if (!placement || gizmoMode === null) return null;

  const handleObjectChange = (e?: ThreeEvent) => {
    const control = e?.target as GizmoControl | undefined;
    const obj = control?.object;
    if (!obj) return;
    // One history entry for the whole drag — pushed on the first real tick,
    // so a mere handle click never pollutes undo.
    if (!draggingStarted.current) {
      beginTransform(placement.id);
      draggingStarted.current = true;
    }
    if (gizmoMode === "translate") {
      const pct = worldToPct(obj.position.x, obj.position.z, scaleM, boardAspect);
      setTransient(placement.id, {
        x_pct: clampBoardPct(pct.x),
        y_pct: clampBoardPct(pct.y),
      });
    } else {
      let deg = ((obj.rotation.y * 180) / Math.PI) % 360;
      deg = ((deg % 360) + 360) % 360;
      setTransient(placement.id, { rotation_deg: Math.round(deg) });
    }
  };

  return (
    <TransformControls
      mode={gizmoMode}
      position={[wx, y, wz]}
      translationSnap={0.5}
      rotationSnap={Math.PI / 4}
      onObjectChange={handleObjectChange}
      onMouseDown={() => {
        draggingStarted.current = false;
        setGizmoDragging(true);
      }}
      onMouseUp={() => {
        setGizmoDragging(false);
        endTransform();
      }}
    />
  );
}
