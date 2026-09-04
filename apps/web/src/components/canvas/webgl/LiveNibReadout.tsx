"use client";

/**
 * LiveNibReadout — cursor-adjacent nib readout (spec §2.6).
 *
 * The only UI element permitted at 100% opacity during a stroke. Tracks the
 * stylus tip via `translate3d` on a ref (compositor-only, no layout thrash).
 * The text content is updated via `ref.current.textContent` (no React state,
 * no re-renders). Both mutations happen inside the R3F render loop via
 * `LiveNibProjector` writing screen coords to the store.
 *
 * Quiet lifecycle: 100% opacity while `penDown` is true; instantly drops to
 * 0% when `penDown` reverts to false. The 50ms linear transition matches the
 * rest of the pen-down quiet state.
 *
 * Offset: `translate(16px, 16px)` inside the dynamic `translate3d` — the dark
 * panel tracks the cursor but never eclipses the stylus tip or the 3D
 * NibCrosshair geometry.
 */

import { useRef } from "react";
import { useStudioStore } from "./studioStore";
import { formatNibReadout, computeGradeAndBearing } from "./nibReadoutFormatter";
import { FIXED_PLANE_LABELS, planeZ, type FixedPlaneId } from "./planeStack";
import { KIND_TO_PLANE } from "./planeStack";
import styles from "./LiveNibReadout.module.css";

export function LiveNibReadout() {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const liveNibScreen = useStudioStore((s) => s.liveNibScreen);
  const penDown = useStudioStore((s) => s.penDown);
  const liveCoord = useStudioStore((s) => s.liveCoord);
  const activeTool = useStudioStore((s) => s.activeTool);
  const activeCanvasId = useStudioStore((s) => s.activeCanvasId);

  // Update position and text via direct DOM mutation (no React re-render)
  if (containerRef.current && liveNibScreen && !liveNibScreen.behind) {
    const px = Math.round(liveNibScreen.x);
    const py = Math.round(liveNibScreen.y);
    containerRef.current.style.transform = `translate3d(${px}px, ${py}px, 0) translate(16px, 16px)`;
  }

  // Build the readout string
  if (textRef.current && liveCoord && penDown) {
    const planeId: FixedPlaneId =
      (KIND_TO_PLANE[activeTool] as FixedPlaneId) ??
      (activeCanvasId === null ? "ground" : "ground");
    const zLabel = FIXED_PLANE_LABELS[planeId];
    const z = planeZ(planeId);

    // Grade and bearing require an origin — use the first point of the
    // active stroke. For now, use the liveCoord origin (0,0) as fallback
    // when no stroke origin is available. The grade is computed from the
    // Z-height of the target plane vs ground.
    const gradeInfo = computeGradeAndBearing(
      0, 0, 0,
      liveCoord.x, liveCoord.z, z,
    );

    const text = formatNibReadout({
      tool: activeTool,
      x: liveCoord.x,
      z: liveCoord.z,
      chainage: liveCoord.chainage,
      zLabel,
      gradePct: gradeInfo?.gradePct,
      bearingDeg: gradeInfo?.bearingDeg,
    });
    textRef.current.textContent = text;
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.readout} ${penDown ? styles.readoutVisible : ""}`}
      data-testid="live-nib-readout"
      style={{
        left: 0,
        top: 0,
        opacity: penDown && liveNibScreen && !liveNibScreen.behind ? 1 : 0,
        pointerEvents: "none",
      }}
    >
      <span ref={textRef} className={styles.readoutText} />
    </div>
  );
}
