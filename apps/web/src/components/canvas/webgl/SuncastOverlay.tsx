"use client";

/**
 * Gold Standard 2026 — Suncast overlay (analytical shadow footprint).
 *
 * Wires packages/domain's plan-sun-cast engine into the WebGL scene: for the
 * building footprint and every placed tree/canopy, casts a translucent
 * analytical shadow polygon onto the drawing, driven by the SAME live sun the
 * SunRig uses (sunMin + sunDatePreset on the store). Scrub the Sun panel and
 * the cast sweeps with it — a real shade study ("will the June 4pm sun shade
 * the new bed?"), not just the VSM shadow the directional light produces.
 *
 * This is the survivor of the retired SVG board's plan-sun-cast layer; the
 * docs record it as flat-board-only. The shadow math is board-% and ported
 * directly: castRingShadowPct on the building ring, canopyFootprintPct +
 * shadowLengthMetres for placed canopies.
 *
 * Renders at a slight y-lift above the paper so the sheet reads through the
 * translucent cast (like the flora-ring ghost disc). Self-gates on a store
 * toggle (suncastView) with a sensible default ON in drafting modes.
 */

import { useMemo } from "react";
import * as THREE from "three";
import {
  castRingShadowPct,
  canopyFootprintPct,
  shadowLengthMetres,
  shadowOffsetPct,
} from "@workstream/domain";
import { PALETTE } from "../../../styles/colorTokens";
import { useSeasonalStore } from "./seasonalStore";
import { useStudioStore } from "./studioStore";
import { pctToWorld, type PctPoint } from "./coordTransform";
import { resolveSunLightPosition } from "./sunLight";
import type { RenderItem } from "./sceneItems";

export interface SuncastOverlayProps {
  scaleM: number;
  boardAspect: number;
  buildingPct?: PctPoint[];
  items: RenderItem[];
  lat?: number;
  lng?: number;
  /** Building massing height (m) — never invented; 0 = no building cast. */
  buildingHeightM?: number;
  /** Same growth axis the renderer uses (0=plant, 1=mature). */
  growthFactor?: number;
}

/** Flatten a cast polygon into a world-space shape geometry. */
function castToShape(
  ringPct: Array<{ x: number; y: number }>,
  scaleM: number,
  boardAspect: number,
): THREE.ShapeGeometry | null {
  if (ringPct.length < 3) return null;
  const shape = new THREE.Shape();
  const world = ringPct.map((p) =>
    pctToWorld({ x: p.x, y: p.y } as PctPoint, scaleM, boardAspect),
  );
  shape.moveTo(world[0]![0], -world[0]![1]); // shape Y negated (rot -π/2 → world +Y)
  for (let i = 1; i < world.length; i++)
    shape.lineTo(world[i]![0], -world[i]![1]);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

export function SuncastOverlay({
  scaleM,
  boardAspect,
  buildingPct = [],
  items,
  lat,
  lng,
  buildingHeightM = 0,
  growthFactor = 1,
}: SuncastOverlayProps) {
  const suncastView = useStudioStore((s) => s.suncastView);
  const sunKey = `${useSeasonalStore((s) => s.sunMin)}:${useSeasonalStore((s) => s.sunDatePreset)}`;

  // Live sun — read the same (sunMin, sunDatePreset) axis the SunRig uses so
  // the analytic cast matches the VSM shadow direction exactly. Recomputed
  // only when the sun key changes (5-min scrub granularity) — pointer-drag
  // won't rebuild geometry per frame.
  const sun = useMemo(() => {
    if (lat == null || lng == null) return null;
    const { sunMin, sunDatePreset } = useSeasonalStore.getState();
    const r = resolveSunLightPosition(lat, lng, sunDatePreset, sunMin, 1);
    return { altitudeDeg: r.altitudeDeg, azimuthDeg: r.azimuthDeg };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, sunKey]);

  if (!suncastView || !sun) return null;
  if (sun.altitudeDeg <= 2.5) return null; // sun below the cast floor — no shadow

  const casts: THREE.ShapeGeometry[] = [];

  // Building cast — the dwelling's massing shadow.
  if (buildingPct.length >= 3 && buildingHeightM > 0) {
    const ring = castRingShadowPct(
      buildingPct,
      buildingHeightM,
      sun.altitudeDeg,
      sun.azimuthDeg,
      scaleM,
    );
    if (ring) {
      const g = castToShape(ring, scaleM, boardAspect);
      if (g) casts.push(g);
    }
  }

  // Tree/canopy casts — 8-gon footprint at the grown canopy radius, cast by
  // the trunk+canopy height. Same growth axis as the renderer (grownDimensions
  // fallbacks: canopy/feature 4–6 m base, existing 7–8 m, no growth applied).
  for (const item of items) {
    if (item.t !== "canopy" && item.t !== "feature" && item.t !== "exist") continue;
    const isExist = item.t === "exist";
    const baseHeight = item.heightM ?? (item.t === "canopy" ? 6 : isExist ? 8 : 4);
    const baseCanopy = item.t === "canopy" ? 6 : isExist ? 7 : 4;
    // New plantings grow 20% → 100% with the growth axis; existing are mature.
    const grow = isExist ? 1 : 0.2 + growthFactor * 0.8;
    const heightM = baseHeight * grow * (item.scale ?? 1);
    const canopyM = baseCanopy * grow * (item.scale ?? 1);
    if (heightM <= 0.2) continue;
    const radiusPct = (canopyM / scaleM) * 50;
    const footprint = canopyFootprintPct(item.x, item.y, radiusPct);
    const lenM = shadowLengthMetres(heightM, sun.altitudeDeg);
    if (lenM <= 0) continue;
    const { dx, dy } = shadowOffsetPct(lenM, sun.azimuthDeg, scaleM);
    const ring = footprint.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    const g = castToShape(ring, scaleM, boardAspect);
    if (g) casts.push(g);
  }

  if (casts.length === 0) return null;

  const color = PALETTE.gsInkStrong;
  return (
    <group>
      {casts.map((geo, i) => (
        <mesh
          key={i}
          geometry={geo}
          rotation={[-Math.PI / 2, 0, 0]}
          castShadow={false}
          receiveShadow={false}
          renderOrder={2}
        >
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.08}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
