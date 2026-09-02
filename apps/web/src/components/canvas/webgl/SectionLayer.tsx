"use client";

/**
 * Section render layer — draws the SectionLayer profile along the active cut
 * line (spec 6c / 9.6). Consumes the pure sectionProfile + sectionGeometry
 * modules verbatim, so the drawn section can never disagree with the terrain
 * mesh or the cut/fill readout.
 *
 *   existing grade   — dashed hairline (rgba 232,230,224 .4)
 *   proposed grade   — solid 3.4px terrain-green accent (class A engaged)
 *   cut band         — translucent redline (45° cut in the spec; tinted v1)
 *   fill band        — translucent blue fill (fill hatch is a follow-up)
 *   RL datums        — one column, single left margin (spec 6c)
 *
 * Mounts whenever a section cut is active (sliceActive) and terrain exists;
 * renders the curtain at the cut line, visible from any camera.
 */

import { useMemo } from "react";
import { Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { useStudioStore } from "./studioStore";
import { createElevationSampler } from "./terrainMath";
import { padStrokes } from "./cutFill";
import { buildSectionProfile } from "./sectionProfile";
import { VERTICAL_SCALE } from "./terrainMath";
import {
  buildSectionGeometry,
  SECTION_DATUMS,
  type V3,
} from "./sectionGeometry";
import { cfZPair } from "../cfz";
import type { HeightmapPoint } from "./coordTransform";

const EXISTING = "#e8e6e0";
const PROPOSED = "#3D9A5F";
const CUT_FILL = "#b3261e";
const FILL = "#2F6FED";

function quadGeometry(corners: [V3, V3, V3, V3]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        ...corners[0],
        ...corners[1],
        ...corners[2],
        ...corners[0],
        ...corners[2],
        ...corners[3],
      ],
      3,
    ),
  );
  g.computeVertexNormals();
  return g;
}

const RL_LABEL_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: 10.5,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "var(--gs-ink)",
  background: "var(--cf-dark-panel-bg)",
  border: "1px solid var(--gs-line)",
  borderRadius: 4,
  padding: "1px 5px",
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

export interface SectionLayerProps {
  scaleM: number;
  boardAspect: number;
  heightmapPoints: HeightmapPoint[];
}

export function SectionLayer({
  scaleM,
  boardAspect,
  heightmapPoints,
}: SectionLayerProps) {
  const sliceActive = useStudioStore((s) => s.sliceActive);
  const sliceAxis = useStudioStore((s) => s.sliceAxis);
  const slicePosM = useStudioStore((s) => s.slicePosM);
  const strokes = useStudioStore((s) => s.sketchStrokes);
  const features = useStudioStore((s) => s.features);

  const geo = useMemo(() => {
    if (!sliceActive || heightmapPoints.length < 3) return null;
    const sampler = createElevationSampler(heightmapPoints, scaleM, boardAspect);
    if (!sampler) return null;
    const halfX = scaleM / 2;
    const halfZ = (scaleM * boardAspect) / 2;
    const cut =
      sliceAxis === "z"
        ? { x0: -halfX, z0: slicePosM, x1: halfX, z1: slicePosM }
        : { x0: slicePosM, z0: -halfZ, x1: slicePosM, z1: halfZ };
    const pads = padStrokes(strokes, scaleM, boardAspect, features);
    const profile = buildSectionProfile({
      cut,
      elevAt: (x, z) => sampler(x, z) ?? 0,
      pads,
      samples: 96,
    });
    return buildSectionGeometry(profile, cut);
  }, [sliceActive, sliceAxis, slicePosM, scaleM, boardAspect, heightmapPoints, strokes, features]);

  if (!geo || geo.existing.length < 2) return null;

  return (
    <group>
      {/* Existing grade — dashed hairline */}
      <Line
        points={geo.existing}
        color={EXISTING}
        lineWidth={1}
        dashed
        dashSize={0.6}
        gapSize={0.4}
        transparent
        opacity={0.4}
      />

      {/* Proposed grade — solid accent */}
      {geo.proposed.map((seg, i) => (
        <Line key={`p-${i}`} points={seg} color={PROPOSED} lineWidth={3} transparent opacity={0.9} />
      ))}

      {/* Cut / fill band fills */}
      {geo.bandQuads.map((quad, i) => (
        <mesh key={`b-${i}`} geometry={quadGeometry(quad.corners)}>
          <meshBasicMaterial
            color={quad.kind === "cut" ? CUT_FILL : FILL}
            transparent
            opacity={0.14}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* RL datum column — one column, single left margin (spec 6c).
          Datums plot at the same exaggeration as the drawn profile. */}
      {SECTION_DATUMS.map((d) => (
        <Html
          key={d}
          position={[geo.existing[0]![0] - 1.2, d * VERTICAL_SCALE, geo.existing[0]![2]]}
          center
          zIndexRange={cfZPair("spatialAnnotation")}
          style={{ pointerEvents: "none" }}
        >
          <span style={RL_LABEL_STYLE}>RL {d.toFixed(1)}</span>
        </Html>
      ))}
    </group>
  );
}
