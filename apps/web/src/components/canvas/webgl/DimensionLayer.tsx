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
 * THIS LAYER OWNS SURVEY EDGE TRUTH (2026-08-22). `AnnotationLayer` used to
 * label the same boundary edges a second time with a bearing pill at each edge
 * midpoint, so every edge carried two labels printing the same length from two
 * systems that could not see each other. The bearing now joins the key and the
 * distance in one chip here, and the annotation layer renders design intent
 * only. Because bearings matter most in Survey — where `modeArmsDims` is
 * deliberately false, since a working-drawing ring over a lot still being
 * traced is noise — the chips can render without the ring: `showBearings`
 * lights the boundary chips alone, `dimsView` adds the full ring and the
 * building F-dims.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (technical drafting truth)
 */

import { useMemo, useRef, type ElementRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { useStudioStore } from "./studioStore";
import { behaviourOf } from "./chromeContract";
import { layerScaleAlpha, viewScaleRatioForZoom } from "./layerPolicy";
import { pctToWorld, type PctPoint } from "./coordTransform";
import {
  BEARING_CHIP_WIDTH_SCALE,
  dimDeclutterBoxForZoom,
  estimateDimChipRect,
} from "./dimensionLod";
import { formatSurveyBearing, surveyEdgeLabel } from "./annotations/derive";
import type { AnnotationRect } from "./annotationLayout";
import { publishAnnotationRects } from "./annotationReservations";
import {
  buildOutsideDims,
  declutterOutsideDims,
  type OutsideDimPlacement,
} from "../handoff/geometry/outsideDims";
import { edgeSegments } from "../handoff/geometry/polygon";
import { PALETTE } from "../../../styles/colorTokens";
import { cfZPair } from "../cfz";

/** Hover height above the ground/terrain (above ink 0.02, below slice 0.03+). */
const DIM_Y = 0.04;

/** Tighter offsets inside the lot so the F-ring nests near the fabric. */
const BUILDING_DIM_OPTS = {
  offsetPct: 1.6,
  tickPct: 0.8,
  labelExtraPct: 1.0,
  gapPct: 0.25,
  overshootPct: 0.35,
};

const dimLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: "var(--gs-font-xs)",
  fontWeight: 500,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "-0.01em",
  color: "var(--la-ink)",
  background: "color-mix(in srgb, var(--la-surface) 80%, transparent)",
  border: "1px solid color-mix(in srgb, var(--gs-line) 60%, transparent)",
  borderRadius: "var(--gs-radius-md)",
  padding: "0px 5px",
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

/**
 * `family` exists because two controls can put a chip on screen: the Dims
 * instrument (the working-drawing ring, boundary + building) and the CAD/Survey
 * card's Bearings control (boundary survey truth alone). Without it the DOM
 * cannot say which instrument owns a chip, and "Dims off" looks broken when the
 * four boundary chips correctly stay behind.
 */
type DimChip = OutsideDimPlacement & {
  text: string;
  family: "boundary" | "building";
};

export interface DimensionLayerProps {
  boundaryPct: PctPoint[];
  buildingPct?: PctPoint[];
  scaleM: number;
  boardAspect: number;
  /** True north, for the bearing half of the chip. */
  northBearingDeg?: number | null;
  /** Boundary chips render even when the full ring is off. */
  showBearings?: boolean;
}

export function DimensionLayer({
  boundaryPct,
  buildingPct,
  scaleM,
  boardAspect,
  northBearingDeg,
  showBearings = false,
}: DimensionLayerProps) {
  const dimsView = useStudioStore((s) => s.dimsView);
  const scaleView = useStudioStore((s) => s.scaleView);
  const cameraPreset = useStudioStore((s) => s.cameraPreset);
  // Phase L.4 — dimensions convert to billboarded ≈ in 3D per the chrome
  // contract. The contract is the single source of truth: if it says
  // "convert" for this preset, dims are indicative (prefixed ≈, not issuable).
  const dimBehaviour = behaviourOf("dimensions", cameraPreset);
  const indicative = dimBehaviour.kind === "convert";
  // Quantised zoom (0.5 steps) — the declutter box scales with 1/zoom so
  // labels reappear as the user zooms in (classic parity, UI survey §3.2).
  // Quantising keeps the zero-commit pan law: liveRig is written per frame,
  // but the selector only re-renders when the quantised zoom crosses a step.
  const zoom = useStudioStore((s) => Math.round(s.liveRig.zoom * 2) / 2);

  const northCalibrated =
    northBearingDeg != null &&
    Number.isFinite(northBearingDeg) &&
    northBearingDeg >= 0 &&
    northBearingDeg <= 360;
  // An uncalibrated frame cannot produce a real bearing, so the chip drops it
  // rather than printing a precise-looking fiction off board north.
  const withBearings = showBearings && northCalibrated;

  // The master scale toggle gates the whole overlay; dimsView / showBearings
  // still decide WHAT is on inside it (full ring vs boundary chips only).
  const showRing = dimsView && scaleView;
  const showLabels = (dimsView || showBearings) && scaleView;

  const boundaryBox = useMemo(
    () =>
      dimDeclutterBoxForZoom(zoom, withBearings ? BEARING_CHIP_WIDTH_SCALE : 1),
    [zoom, withBearings],
  );
  const buildingBox = useMemo(() => dimDeclutterBoxForZoom(zoom), [zoom]);

  const boundaryChips = useMemo<DimChip[]>(() => {
    if (boundaryPct.length < 3) return [];
    const segs = edgeSegments(boundaryPct, "B", scaleM, boardAspect);
    const bearingByKey = new Map(
      segs.map((s) => [
        s.key,
        withBearings ? formatSurveyBearing(s.a, s.b, northBearingDeg) : "",
      ]),
    );
    return declutterOutsideDims(buildOutsideDims(segs, boundaryPct), boundaryBox)
      .filter((d) => d.visible)
      .map((d) => ({
        ...d,
        family: "boundary" as const,
        text: surveyEdgeLabel(
          d.key,
          bearingByKey.get(d.key) ?? "",
          d.lengthM.toFixed(2),
        ),
      }));
  }, [boundaryPct, scaleM, boardAspect, boundaryBox, withBearings, northBearingDeg]);

  const buildingChips = useMemo<DimChip[]>(() => {
    if (!buildingPct || buildingPct.length < 3) return [];
    const dims = buildOutsideDims(
      edgeSegments(buildingPct, "F", scaleM, boardAspect),
      buildingPct,
      BUILDING_DIM_OPTS,
    );
    return declutterOutsideDims(dims, buildingBox)
      .filter((d) => d.visible)
      .map((d) => ({
        ...d,
        family: "building" as const,
        text: surveyEdgeLabel(d.key, "", d.lengthM.toFixed(2)),
      }));
  }, [buildingPct, scaleM, boardAspect, buildingBox]);

  // Bearings-only mode is the boundary's survey truth, not a working drawing:
  // no ring line work, no building F-dims.
  const chips = useMemo(
    () => (showRing ? [...boundaryChips, ...buildingChips] : boundaryChips),
    [showRing, boundaryChips, buildingChips],
  );

  // All line work flattened into disjoint pairs for ONE Line2 draw call.
  const segments = useMemo(() => {
    if (!showRing) return [];
    const toWorld = (x: number, y: number): [number, number, number] => {
      const [wx, wz] = pctToWorld({ x, y }, scaleM, boardAspect);
      return [wx, DIM_Y, wz];
    };
    const pts: Array<[number, number, number]> = [];
    for (const d of [...boundaryChips, ...buildingChips]) {
      pts.push(toWorld(d.x1, d.y1), toWorld(d.x2, d.y2)); // dimension string
      pts.push(toWorld(d.extA.x1, d.extA.y1), toWorld(d.extA.x2, d.extA.y2));
      pts.push(toWorld(d.extB.x1, d.extB.y1), toWorld(d.extB.x2, d.extB.y2));
      pts.push(toWorld(d.tickA.x1, d.tickA.y1), toWorld(d.tickA.x2, d.tickA.y2));
      pts.push(toWorld(d.tickB.x1, d.tickB.y1), toWorld(d.tickB.x2, d.tickB.y2));
    }
    return pts;
  }, [showRing, boundaryChips, buildingChips, scaleM, boardAspect]);

  // dims scale-band visibility: the working-drawing ring cross-fades out at
  // macro zoom (band [0.3, 4] × fit). The line material and the label chips
  // are faded per-frame via refs — zero React re-renders during zoom.
  const lineRef = useRef<ElementRef<typeof Line>>(null);
  const chipRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const scratch = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    const alpha = layerScaleAlpha(
      "dims",
      viewScaleRatioForZoom(useStudioStore.getState().liveRig.zoom),
    );
    if (lineRef.current) {
      const m = lineRef.current.material;
      m.transparent = true;
      m.opacity = 0.75 * alpha;
    }
    for (const el of chipRefs.current) {
      if (el) el.style.opacity = String(alpha);
    }

    // Publish the chip footprints so the callout solver can route around the
    // ring. Chips that are not drawn reserve nothing — `useFrame` is registered
    // before this component's early return, so gating on `showLabels` here is
    // what stops an unrendered ring from pushing callouts around.
    const rects: AnnotationRect[] = [];
    if (showLabels && alpha >= 0.05) {
      for (const chip of chips) {
        const [wx, wz] = pctToWorld(
          { x: chip.labelX, y: chip.labelY },
          scaleM,
          boardAspect,
        );
        const projected = scratch.current.set(wx, DIM_Y + 0.05, wz).project(camera);
        rects.push(
          estimateDimChipRect(
            chip.text,
            ((projected.x + 1) * size.width) / 2,
            ((1 - projected.y) * size.height) / 2,
          ),
        );
      }
    }
    publishAnnotationRects("dimensionChip", rects);
  });

  if (!showLabels || chips.length === 0) return null;

  return (
    <group>
      {segments.length > 0 ? (
        <Line
          ref={lineRef}
          segments
          points={segments}
          color={PALETTE.skyCool}
          lineWidth={1}
          transparent
          opacity={0.75}
        />
      ) : null}
      {chips.map((d, i) => {
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
            zIndexRange={cfZPair("spatialAnnotation")}
            style={{ pointerEvents: "none" }}
          >
            <span
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
              data-testid="dim-label"
              data-dim-family={d.family}
              data-indicative={indicative ? "true" : undefined}
              style={dimLabelStyle}
            >
              {indicative ? `≈ ${d.text}` : d.text}
            </span>
          </Html>
        );
      })}
    </group>
  );
}
