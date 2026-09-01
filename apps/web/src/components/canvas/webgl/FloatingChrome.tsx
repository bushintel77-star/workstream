"use client";

/**
 * FloatingChrome -- Landscape Canvas v2 chrome composition.
 *
 * Composes the v2 chrome subsystems per the handoff:
 *   WfsChips     -- top bar (project name + overlay pills, §5.4)
 *   ToolRibbon   -- vertical glass panel, hand-opposite edge (§5)
 *   CameraDock   -- bottom centre, 4 presets PLAN/AXO/SEC/3D (§6.1)
 *   DepthRail    -- side edge, vertically centred (planes + subsurface)
 *   Readouts     -- bottom corners (cut/fill + anchor state)
 *   PerimeterTrack -- 1px inset border framing the viewport
 *
 * The Stage One bottom tool dock is retired — tools now live in the
 * categorical vertical ribbon (ToolRibbon). The bottom centre is
 * exclusively the camera dock.
 */

import { useMemo, useState } from "react";
import type {
  ConstructionTrenchKind,
  DesignKeylessOverlay,
  SketchCanvas,
} from "@workstream/contracts";
import type { CanopyComplianceResult } from "./canopyCompliance";
import { useStudioStore } from "./studioStore";
import { SiteSetupModal } from "./SiteSetupModal";
import type { HeightmapPoint } from "./coordTransform";
import { createElevationSampler } from "./terrainMath";
import { padStrokes, padCutFill, CUT_FILL_CELL_M } from "./cutFill";
import { ToolRibbon } from "./ToolRibbon";
import { CameraDock } from "./CameraDock";
import { WfsChips } from "./WfsChips";
import styles from "./FloatingChrome.module.css";

/* ---- helpers ---- */

const SEASON_TAGS = ["ALL", "SUMMER", "WINTER"] as const;
type SeasonTag = (typeof SEASON_TAGS)[number];

function nextSeasonTag(current: SeasonTag): SeasonTag {
  const idx = SEASON_TAGS.indexOf(current);
  return SEASON_TAGS[(idx + 1) % SEASON_TAGS.length]!;
}

function seasonTagLabel(tag: SeasonTag): string {
  switch (tag) {
    case "SUMMER": return "SUM";
    case "WINTER": return "WIN";
    case "ALL":
    default: return "ALL";
  }
}

function zLabel(z: number): string {
  if (z === 0) return "GRD";
  return z.toFixed(1).replace(/\.0$/, "");
}

function createCanvas(z: number): SketchCanvas {
  return {
    id: crypto.randomUUID(),
    position: [0, z, 0],
    rotation: [0, 0, 0, 1],
    label: `Plane +${z.toFixed(1)}m`,
    season_tag: "ALL",
  };
}

function useCutFill(
  scaleM: number,
  heightmapPoints: HeightmapPoint[],
  boardAspect: number,
): { cut: number; fill: number } | null {
  const strokes = useStudioStore((s) => s.sketchStrokes);

  return useMemo(() => {
    if (!heightmapPoints || heightmapPoints.length < 3) return null;
    const pads = padStrokes(strokes, scaleM, boardAspect, []);
    if (pads.length === 0) return null;
    const sampler = createElevationSampler(heightmapPoints, scaleM, boardAspect);
    if (!sampler) return null;
    let totalCut = 0;
    let totalFill = 0;
    for (const pad of pads) {
      const result = padCutFill(sampler, pad.worldXZ, pad.heightM, CUT_FILL_CELL_M);
      totalCut += result.cutM3;
      totalFill += result.fillM3;
    }
    return { cut: Math.round(totalCut), fill: Math.round(totalFill) };
  }, [strokes, scaleM, heightmapPoints, boardAspect]);
}

/* ---- component ---- */

/**
 * Subsurface utility depth bands (handoff §5.3). Standard Melbourne
 * service depths — the depth rail shows these below the ground line in
 * redline accent. Each cell arms the trench tool at its construction
 * kind (the read-out side of the depth rail; the rail cells are the
 * arm-in). Re-click the active kind to disarm.
 */
const SUBSURFACE_DEPTHS: Array<{
  id: string;
  label: string;
  depth: number;
  kind: ConstructionTrenchKind;
}> = [
  { id: "gas", label: "GAS", depth: 0.6, kind: "lighting_conduit" },
  { id: "water", label: "H2O", depth: 0.75, kind: "irrig_main" },
  { id: "elec", label: "ELEC", depth: 0.9, kind: "lighting_conduit" },
  { id: "sewer", label: "SEW", depth: 1.5, kind: "drainage" },
  { id: "telco", label: "TEL", depth: 0.45, kind: "lighting_conduit" },
];

export interface FloatingChromeProps {
  scaleM: number;
  boardAspect: number;
  northBearingDeg: number | null;
  heightmapPoints: HeightmapPoint[];
  /** KEYLESS Vicmap/DELWP site-frame overlays → WFS chip pills (§5.4). */
  keylessOverlays?: DesignKeylessOverlay[];
  /** Title-plan easement ring count → the dig-safety easement pill. */
  easementRingCount?: number;
  /** ResCode A2-6 canopy compliance → the A2-6 obligation pill. */
  canopy?: CanopyComplianceResult | null;
}

export function FloatingChrome({
  scaleM,
  boardAspect,
  northBearingDeg,
  heightmapPoints,
  keylessOverlays = [],
  easementRingCount = 0,
  canopy = null,
}: FloatingChromeProps) {
  const canvases = useStudioStore((s) => s.sketchCanvases);
  const activeCanvasId = useStudioStore((s) => s.activeCanvasId);
  const handedness = useStudioStore((s) => s.handedness);
  const anchorVisibility = useStudioStore((s) => s.anchorVisibility);
  const extrusionToolArmed = useStudioStore((s) => s.extrusionToolArmed);
  const trenchTool = useStudioStore((s) => s.trenchTool);
  const setTrenchTool = useStudioStore((s) => s.setTrenchTool);
  const selectedExtrusionStrokeId = useStudioStore((s) => s.selectedExtrusionStrokeId);
  const activeExtrusionDepth = useStudioStore((s) => s.activeExtrusionDepth);
  const setActiveCanvasId = useStudioStore((s) => s.setActiveCanvasId);
  const setAnchorVisibility = useStudioStore((s) => s.setAnchorVisibility);
  const setActiveExtrusionDepth = useStudioStore((s) => s.setActiveExtrusionDepth);
  const commitExtrusion = useStudioStore((s) => s.commitExtrusion);
  const addSketchCanvas = useStudioStore((s) => s.addSketchCanvas);
  const updateSketchCanvas = useStudioStore((s) => s.updateSketchCanvas);
  const [siteSetupOpen, setSiteSetupOpen] = useState(false);

  const isLeft = handedness === "LEFT";
  const cutFill = useCutFill(scaleM, heightmapPoints, boardAspect);

  const sortedCanvases = useMemo(
    () => [...canvases].sort((a, b) => b.position[1] - a.position[1]),
    [canvases],
  );

  const nextZ = useMemo(() => {
    if (sortedCanvases.length === 0) return 1.5;
    const maxZ = sortedCanvases[0]!.position[1];
    return Math.round((maxZ + 1.5) * 10) / 10;
  }, [sortedCanvases]);

  const anchorOpacity =
    anchorVisibility === "ALL" ? 1 :
      anchorVisibility === "DIMMED" ? 0.32 : 0;

  const anchorStyle = anchorOpacity < 1
    ? { opacity: anchorOpacity, transition: "opacity 0.35s ease" }
    : undefined;

  const railSide = isLeft ? styles.railLeft : styles.railRight;
  const readoutLeftSide = isLeft ? styles.readoutGroupRight : styles.readoutGroupLeft;
  const readoutRightSide = isLeft ? styles.readoutGroupLeft : styles.readoutGroupRight;

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId);
  const activeLabel = activeCanvas ? zLabel(activeCanvas.position[1]) : "GRD";

  const scaleRatio = `1:${Math.round(scaleM * 2)}`;

  const anchorLabel =
    anchorVisibility === "ALL" ? "ANCHORS" :
      anchorVisibility === "DIMMED" ? "DIMMED" : "FOCUS";

  function cycleAnchorVisibility() {
    const next =
      anchorVisibility === "ALL" ? "DIMMED" :
        anchorVisibility === "DIMMED" ? "FOCUS" : "ALL";
    setAnchorVisibility(next);
  }

  return (
    <>
      {/* Perimeter track */}
      <div className={styles.perimeterTrack} />

      {/* WFS context chips — top bar (handoff §5.4) */}
      <WfsChips
        northBearingDeg={northBearingDeg}
        scaleRatio={scaleRatio}
        keylessOverlays={keylessOverlays}
        easementRingCount={easementRingCount}
        canopy={canopy}
      />

      {/* Tool ribbon — vertical glass panel, hand-opposite edge (handoff §5) */}
      <ToolRibbon />

      {/* Camera dock — bottom centre, 4 presets (handoff §6.1) */}
      <CameraDock />

      {/* Depth Rail -- wider, more legible */}
      <div className={`${styles.rail} ${railSide}`} style={anchorStyle}>
        <div className={styles.railHeader}>Z</div>
        {sortedCanvases.map((canvas) => {
          const isActive = canvas.id === activeCanvasId;
          const currentTag = (canvas.season_tag ?? "ALL") as SeasonTag;
          return (
            <div key={canvas.id} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <button
                className={`${styles.cell} ${isActive ? styles.cellActive : ""}`}
                onClick={() => setActiveCanvasId(canvas.id)}
                title={canvas.label ?? `Plane +${canvas.position[1]}m`}
              >
                {zLabel(canvas.position[1])}
              </button>
              <button
                className={`${styles.seasonTag} ${currentTag === "SUMMER"
                  ? styles.seasonTagSummer
                  : currentTag === "WINTER"
                    ? styles.seasonTagWinter
                    : styles.seasonTagAll
                  }`}
                onClick={(e) => {
                  e.stopPropagation();
                  updateSketchCanvas(canvas.id, {
                    ...canvas,
                    season_tag: nextSeasonTag(currentTag),
                  });
                }}
                title={`Season: ${canvas.season_tag ?? "ALL"} -- click to cycle`}
              >
                {seasonTagLabel(currentTag)}
              </button>
            </div>
          );
        })}
        <button
          className={`${styles.cell} ${activeCanvasId === null ? styles.cellActive : ""}`}
          onClick={() => setActiveCanvasId(null)}
          title="Ground plane"
        >
          GRD
        </button>
        <button
          className={`${styles.cell} ${styles.cellAdd}`}
          onClick={() => addSketchCanvas(createCanvas(nextZ))}
          title={`Add plane at +${nextZ}m`}
        >
          +
        </button>

        {/* Ground-line divider — separates positive planes from subsurface */}
        <div className={styles.railGroundLine} />

        {/* Subsurface utility depths — redline accent (handoff §5.3) */}
        <div className={styles.railSubsurfaceLabel}>SUB</div>
        {SUBSURFACE_DEPTHS.map((u) => {
          const active = trenchTool === u.kind;
          return (
            <button
              key={u.id}
              className={`${styles.cell} ${styles.cellSubsurface} ${active ? styles.cellActive : ""}`}
              onClick={() => setTrenchTool(active ? null : u.kind)}
              title={`${u.label} — ${u.depth}m below ground · click to arm the ${u.kind} trench trace`}
            >
              {u.label}
            </button>
          );
        })}
      </div>

      {/* Readout -- cut/fill volumes (bottom-left) */}
      <div className={`${styles.readoutGroup} ${readoutLeftSide}`} style={anchorStyle}>
        {cutFill ? (
          <>
            <div className={styles.readoutPillCut}>
              <span className={styles.readoutValueCut}>{cutFill.cut}</span> CUT m3
            </div>
            <div className={styles.readoutPillCut}>
              <span className={styles.readoutValueFill}>{cutFill.fill}</span> FILL m3
            </div>
          </>
        ) : (
          <div className={styles.readoutPillCut}>
            PLANE <span className={styles.readoutValueCut}>{activeLabel}</span>
          </div>
        )}
      </div>

      {/* Readout -- anchor state (bottom-right) */}
      <div className={`${styles.readoutGroup} ${readoutRightSide}`} style={anchorStyle}>
        <button
          className={styles.readoutPillCut}
          onClick={cycleAnchorVisibility}
          title="Cycle anchor visibility (Opt+F)"
          style={{ pointerEvents: "auto", cursor: "pointer" }}
        >
          {anchorLabel}
        </button>
      </div>

      {/* Extrusion panel -- appears when MASS tool is armed + stroke selected */}
      {extrusionToolArmed && selectedExtrusionStrokeId && (
        <div className={styles.extPanel}>
          <span className={styles.extLabel}>DEPTH</span>
          <input
            type="range"
            className={styles.extSlider}
            min={0.1}
            max={5}
            step={0.1}
            value={activeExtrusionDepth}
            onChange={(e) => setActiveExtrusionDepth(parseFloat(e.target.value))}
          />
          <span className={styles.extValue}>
            {activeExtrusionDepth.toFixed(1)}m
          </span>
          <button
            className={styles.extCommit}
            onClick={() => commitExtrusion(selectedExtrusionStrokeId, activeExtrusionDepth)}
            title="Commit extrusion depth to the stroke"
          >
            COMMIT
          </button>
        </div>
      )}

      {/* AI site setup modal -- frosted-glass ingestion overlay. */}
      {siteSetupOpen && (
        <SiteSetupModal onClose={() => setSiteSetupOpen(false)} />
      )}
    </>
  );
}
