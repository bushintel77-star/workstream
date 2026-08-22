"use client";

/**
 * E2E-only seam — publishes the projected title-boundary bounding box.
 *
 * The chrome-coverage ratchet needs a denominator that means "the drawing",
 * not "the viewport". In the retired SVG studio that was the `studio-board`
 * element; in metre-space there is no board element, and the R3F root is not
 * reachable from `page.evaluate` (the `<Canvas>` testid lands on a wrapper div
 * and R3F 9 does not expose `__r3f` on the DOM node). Rather than duplicate the
 * fused camera's projection math inside a spec — where it would silently rot
 * the first time VIEW_PADDING or the rig changed — the scene publishes the box
 * it already computes every frame for the meta chips.
 *
 * Same chain as `MetaChipSet`: boundary % → `pctToWorld` → `Vector3.project`.
 *
 * Compiled out of production: `process.env.NEXT_PUBLIC_E2E` is inlined by Next
 * at build time, so the mount site in `StudioScene` folds to `null` and this
 * module is tree-shaken from the client bundle.
 */

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { pctToWorld, type PctPoint } from "./coordTransform";

export const BOUNDARY_PROBE_ENABLED = process.env.NEXT_PUBLIC_E2E === "1";

/** Anchor height — the boundary is draped, but the box only needs the plane. */
const PROBE_Y = 0.06;
/** Republish at ~5Hz; a per-frame window write would be pure noise. */
const PUBLISH_INTERVAL_S = 0.2;

export interface BoundaryProjectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Viewport the projection was measured against (staleness guard). */
  viewportWidth: number;
  viewportHeight: number;
}

declare global {
  interface Window {
    __wsBoundaryBox?: BoundaryProjectionBox | null;
  }
}

export function BoundaryProjectionProbe({
  boundaryPct,
  scaleM,
  boardAspect,
}: {
  boundaryPct: PctPoint[];
  scaleM: number;
  boardAspect: number;
}) {
  const scratch = useRef(new THREE.Vector3());
  const since = useRef(0);

  const nodes = useMemo(
    () =>
      boundaryPct.length >= 3
        ? boundaryPct.map((p) => pctToWorld(p, scaleM, boardAspect))
        : [],
    [boundaryPct, scaleM, boardAspect],
  );

  useFrame(({ camera, size }, delta) => {
    since.current += delta;
    if (since.current < PUBLISH_INTERVAL_S) return;
    since.current = 0;

    if (nodes.length === 0) {
      window.__wsBoundaryBox = null;
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      const ndc = scratch.current.set(node[0], PROBE_Y, node[1]).project(camera);
      const px = ((ndc.x + 1) * size.width) / 2;
      const py = ((1 - ndc.y) * size.height) / 2;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    window.__wsBoundaryBox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      viewportWidth: size.width,
      viewportHeight: size.height,
    };
  });

  return null;
}
