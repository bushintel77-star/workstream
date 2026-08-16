"use client";

/**
 * Gold Standard 2026 — Dimension Layer (working-drawing dimension ring).
 *
 * The Gap 3 port of the SVG studio's CAD outside-dimensions. The geometry
 * engine is reused AS-IS from the SVG side — `edgeSegments` + `buildOutsideDims`
 * + `declutterOutsideDims` are pure board-% functions (already unit-tested
 * there) — and this layer converts their output to metre-space and renders:
 *
 *   - ALL line work (dim strings, witness/extension lines, end ticks) as ONE
 *     drei <Line segments> draw call — hairline, non-scaling, drafting steel.
 *   - Labels as drei <Html> chips at the label anchors — constant screen size
 *     (the WebGL equivalent of the SVG studio's CameraChrome label portal),
 *     DOM-rendered so they're accessible and testable (`data-testid`).
 *
 * Dims are computed, never persisted (same as the SVG studio), stay visible
 * in Presentation mode (the client wants to see sizes), and toggle via the
 * store's dimsView chip.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (technical drafting truth)
 */

import { useMemo } from "react";
import { Line, Html } from "@react-three/drei";
import { useStudioStore } from "./studioStore";
import { pctToWorld, type PctPoint } from "./coordTransform";
import {
  buildOutsideDims,
  declutterOutsideDims,
  type OutsideDimPlacement,
} from "../handoff/geometry/outsideDims";
import { edgeSegments } from "../handoff/geometry/polygon";
import { PALETTE } from "../../../styles/colorTokens";

/** Hover height above the ground/terrain (above ink 0.02, below slice 0.03+). */
const DIM_Y = 0.04;

const dimLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: 10.5,
  fontWeight: 500,
  color: "var(--gs-ink-truth, #1A1A1A)",
  background: "color-mix(in srgb, var(--gs-glass) 80%, transparent)",
  border: "1px solid color-mix(in srgb, var(--gs-line) 60%, transparent)",
  borderRadius: 6,
  padding: "0px 5px",
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

export interface DimensionLayerProps {
  boundaryPct: PctPoint[];
  buildingPct?: PctPoint[];
  scaleM: number;
  boardAspect: number;
}

export function DimensionLayer({
  boundaryPct,
  buildingPct,
  scaleM,
  boardAspect,
}: DimensionLayerProps) {
  const dimsView = useStudioStore((s) => s.dimsView);

  // Board-% dims → visible placements (decluttered, label-collision-free).
  const placements = useMemo(() => {
    const out: OutsideDimPlacement[] = [];
    if (boundaryPct.length >= 3) {
      const dims = buildOutsideDims(
        edgeSegments(boundaryPct, "B", scaleM, boardAspect),
        boundaryPct,
      );
      out.push(...declutterOutsideDims(dims));
    }
    if (buildingPct && buildingPct.length >= 3) {
      // Tighter offsets inside the lot so the F-ring nests near the fabric.
      const dims = buildOutsideDims(
        edgeSegments(buildingPct, "F", scaleM, boardAspect),
        buildingPct,
        {
          offsetPct: 1.6,
          tickPct: 0.8,
          labelExtraPct: 1.0,
          gapPct: 0.25,
          overshootPct: 0.35,
        },
      );
      out.push(...declutterOutsideDims(dims));
    }
    return out.filter((d) => d.visible);
  }, [boundaryPct, buildingPct, scaleM, boardAspect]);

  // All line work flattened into disjoint pairs for ONE Line2 draw call.
  const segments = useMemo(() => {
    const toWorld = (x: number, y: number): [number, number, number] => {
      const [wx, wz] = pctToWorld({ x, y }, scaleM, boardAspect);
      return [wx, DIM_Y, wz];
    };
    const pts: Array<[number, number, number]> = [];
    for (const d of placements) {
      pts.push(toWorld(d.x1, d.y1), toWorld(d.x2, d.y2)); // dimension string
      pts.push(toWorld(d.extA.x1, d.extA.y1), toWorld(d.extA.x2, d.extA.y2));
      pts.push(toWorld(d.extB.x1, d.extB.y1), toWorld(d.extB.x2, d.extB.y2));
      pts.push(toWorld(d.tickA.x1, d.tickA.y1), toWorld(d.tickA.x2, d.tickA.y2));
      pts.push(toWorld(d.tickB.x1, d.tickB.y1), toWorld(d.tickB.x2, d.tickB.y2));
    }
    return pts;
  }, [placements, scaleM, boardAspect]);

  if (!dimsView || segments.length === 0) return null;

  return (
    <group>
      <Line
        segments
        points={segments}
        color={PALETTE.skyCool}
        lineWidth={1}
        transparent
        opacity={0.75}
      />
      {placements.map((d) => {
        const [wx, wz] = pctToWorld(
          { x: d.labelX, y: d.labelY },
          scaleM,
          boardAspect,
        );
        return (
          <Html
            key={d.key}
            position={[wx, DIM_Y + 0.05, wz]}
            center
            zIndexRange={[20, 10]}
            style={{ pointerEvents: "none" }}
          >
            <span data-testid="dim-label" style={dimLabelStyle}>
              {`${d.key} · ${d.lengthM.toFixed(2)} m`}
            </span>
          </Html>
        );
      })}
    </group>
  );
}
