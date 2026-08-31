"use client";

/**
 * Spatial Sketching -- FloatingChrome (pack S5.1 / cards 2d + 3a).
 *
 * The locked canvas composition: an opinionated, fixed layout of thin edge
 * chrome + a plane-locked scale margin, with the primary tools as pucks and
 * secondary tools in the command palette. Per the pack S3b:
 * "Panel positions, docking and toolbar contents are intentionally not
 * configurable -- the canvas composition is the product."
 *
 * Anchor slots (mirrored by handedness, pack S6.1):
 *   PrimaryChip  -- top corner, hand-side-opposite (project + scale info)
 *   StatusPills  -- top corner, hand-side (read-only workspace state)
 *   DepthRail    -- side edge, vertically centred (existing)
 *   ToolDock     -- bottom centre (5 pucks: PEN GRD MAS CUT REF)
 *   Readouts     -- bottom corners (cut/fill + anchor state)
 *   PerimeterTrack -- 1px inset border framing the viewport
 *
 * Secondary tools (XFER, EXT, GIS, AI, RENDER, VIEW, JUMP, fly-through)
 * live in the command palette (pack S5.3: "the palette is the
 * tool-of-last-resort in Focus mode").
 */

import { useMemo, useState } from "react";
import type { SketchCanvas } from "@workstream/contracts";
import { useStudioStore } from "./studioStore";
import { SiteSetupModal } from "./SiteSetupModal";
import type { HeightmapPoint } from "./coordTransform";
import { createElevationSampler } from "./terrainMath";
import { padStrokes, padCutFill, CUT_FILL_CELL_M } from "./cutFill";
import styles from "./FloatingChrome.module.css";

/* ---- helpers ---- */

/** The three season tags, in cycle order. */
const SEASON_TAGS = ["ALL", "SUMMER", "WINTER"] as const;
type SeasonTag = (typeof SEASON_TAGS)[number];

function nextSeasonTag(current: SeasonTag): SeasonTag {
  const idx = SEASON_TAGS.indexOf(current);
  return SEASON_TAGS[(idx + 1) % SEASON_TAGS.length]!;
}

function seasonTagLabel(tag: SeasonTag): string {
  switch (tag) {
    case "SUMMER":
      return "SUM";
    case "WINTER":
      return "WIN";
    case "ALL":
    default:
      return "ALL";
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

/** Compute real cut/fill m3 from pad strokes + terrain (pack S5.1 readout).
 *  Returns null when no pads or no terrain -- never fabricates numbers. */
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

export interface FloatingChromeProps {
  /** Board scale in metres (for the 1:200 scale readout + cut/fill math). */
  scaleM: number;
  /** Board aspect (always 1 per the project page). */
  boardAspect: number;
  /** True north bearing in degrees (for the N-up indicator). */
  northBearingDeg: number | null;
  /** Spot levels -- cut/fill is computed against this terrain surface. */
  heightmapPoints: HeightmapPoint[];
}

export function FloatingChrome({
  scaleM,
  boardAspect,
  northBearingDeg,
  heightmapPoints,
}: FloatingChromeProps) {
  const canvases = useStudioStore((s) => s.sketchCanvases);
  const activeCanvasId = useStudioStore((s) => s.activeCanvasId);
  const handedness = useStudioStore((s) => s.handedness);
  const draftingMode = useStudioStore((s) => s.draftingMode);
  const anchorVisibility = useStudioStore((s) => s.anchorVisibility);
  const uiScale = useStudioStore((s) => s.uiScale);
  const projectAddress = useStudioStore((s) => s.projectAddress);
  const liveRig = useStudioStore((s) => s.liveRig);
  const sketchMode = useStudioStore((s) => s.sketchMode);
  const earthworksView = useStudioStore((s) => s.earthworksView);
  const extrusionToolArmed = useStudioStore((s) => s.extrusionToolArmed);
  const selectedExtrusionStrokeId = useStudioStore((s) => s.selectedExtrusionStrokeId);
  const activeExtrusionDepth = useStudioStore((s) => s.activeExtrusionDepth);
  const sliceActive = useStudioStore((s) => s.sliceActive);
  const setActiveCanvasId = useStudioStore((s) => s.setActiveCanvasId);
  const setHandedness = useStudioStore((s) => s.setHandedness);
  const setDraftingMode = useStudioStore((s) => s.setDraftingMode);
  const setAnchorVisibility = useStudioStore((s) => s.setAnchorVisibility);
  const setSketchMode = useStudioStore((s) => s.setSketchMode);
  const setEarthworksView = useStudioStore((s) => s.setEarthworksView);
  const toggleExtrusionTool = useStudioStore((s) => s.toggleExtrusionTool);
  const setActiveExtrusionDepth = useStudioStore((s) => s.setActiveExtrusionDepth);
  const commitExtrusion = useStudioStore((s) => s.commitExtrusion);
  const setSliceActive = useStudioStore((s) => s.setSliceActive);
  const addSketchCanvas = useStudioStore((s) => s.addSketchCanvas);
  const updateSketchCanvas = useStudioStore((s) => s.updateSketchCanvas);
  const [siteSetupOpen, setSiteSetupOpen] = useState(false);

  const isLeft = handedness === "LEFT";
  const cutFill = useCutFill(scaleM, heightmapPoints, boardAspect);

  // Sorted by Z-height descending (highest plane at top of the rail).
  const sortedCanvases = useMemo(
    () => [...canvases].sort((a, b) => b.position[1] - a.position[1]),
    [canvases],
  );

  const nextZ = useMemo(() => {
    if (sortedCanvases.length === 0) return 1.5;
    const maxZ = sortedCanvases[0]!.position[1];
    return Math.round((maxZ + 1.5) * 10) / 10;
  }, [sortedCanvases]);

  // Anchor opacity from visibility mode (pack S6.2).
  const anchorOpacity =
    anchorVisibility === "ALL" ? 1 :
      anchorVisibility === "DIMMED" ? 0.32 :
        0;

  const anchorStyle = anchorOpacity < 1
    ? { opacity: anchorOpacity, transition: "opacity 0.35s ease" }
    : undefined;

  // Handedness mirrors every anchor left/right (pack S6.1).
  const primarySide = isLeft ? styles.primaryChipLeft : styles.primaryChipRight;
  const pillsSide = isLeft ? styles.statusPillsLeft : styles.statusPillsRight;
  const railSide = isLeft ? styles.railLeft : styles.railRight;
  const readoutLeftSide = isLeft ? styles.readoutGroupRight : styles.readoutGroupLeft;
  const readoutRightSide = isLeft ? styles.readoutGroupLeft : styles.readoutGroupRight;

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId);
  const activeLabel = activeCanvas
    ? zLabel(activeCanvas.position[1])
    : "GRD";

  // Scale readout: 1:200 is the design scale; the board scale in m.
  const scaleRatio = `1:${Math.round(scaleM * 2)}`;
  const tiltDeg = Math.round(liveRig.tiltDeg);
  const tiltLabel = tiltDeg === 0 ? "PLAN" : `AXO ${tiltDeg}deg`;
  const northLabel = northBearingDeg != null ? "N-up" : "N?";

  // Anchor state readout (pack S5.1).
  const anchorLabel =
    anchorVisibility === "ALL" ? "ANCHORS ON" :
      anchorVisibility === "DIMMED" ? "ANCHORS DIM" :
        "FOCUS";

  // Cycle anchor visibility: ALL -> DIMMED -> FOCUS -> ALL (pack S6.2, Opt+F).
  function cycleAnchorVisibility() {
    const next =
      anchorVisibility === "ALL" ? "DIMMED" :
        anchorVisibility === "DIMMED" ? "FOCUS" : "ALL";
    setAnchorVisibility(next);
  }

  return (
    <>
      {/* Perimeter track -- 1px inset border framing the viewport */}
      <div className={styles.perimeterTrack} />

      {/* Primary chip -- project name + scale info (top, hand-opposite) */}
      <div className={`${styles.primaryChip} ${primarySide}`} style={anchorStyle}>
        <div className={styles.primaryAccentSquare} />
        <span className={styles.primaryName}>
          {projectAddress || "Untitled site"}
        </span>
        <span className={styles.primaryMeta}>
          {tiltLabel} {northLabel} {scaleRatio}
        </span>
      </div>

      {/* Status pills -- read-only workspace state (top, hand-side) */}
      <div className={`${styles.statusPills} ${pillsSide}`} style={anchorStyle}>
        <button
          className={styles.statusPill}
          onClick={() => setHandedness(isLeft ? "RIGHT" : "LEFT")}
          title="Toggle handedness (Opt+H)"
        >
          {handedness}-HANDED
        </button>
        <span className={styles.statusPill}>
          UI {Math.round(uiScale * 100)}%
        </span>
        <button
          className={`${styles.statusPill} ${draftingMode ? styles.statusPillAccent : ""}`}
          onClick={() => setDraftingMode(!draftingMode)}
          title="Toggle drafting/sketching (Opt+R)"
        >
          {draftingMode ? "DRAFTING 1.0m SNAP" : "SKETCHING FREE"}
        </button>
        <span className={styles.statusPill}>
          TILT {tiltDeg}deg
        </span>
      </div>

      {/* Depth Rail -- vertical pill showing the plane stack (side edge) */}
      <div className={`${styles.rail} ${railSide}`} style={anchorStyle}>
        <div className={styles.railHeader}>Z</div>
        {sortedCanvases.map((canvas) => {
          const isActive = canvas.id === activeCanvasId;
          const currentTag = (canvas.season_tag ?? "ALL") as SeasonTag;
          return (
            <div key={canvas.id} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
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
        {/* Ground plane cell -- always present (canvas_id = null) */}
        <button
          className={`${styles.cell} ${activeCanvasId === null ? styles.cellActive : ""}`}
          onClick={() => setActiveCanvasId(null)}
          title="Ground plane"
        >
          GRD
        </button>
        {/* Add new plane */}
        <button
          className={`${styles.cell} ${styles.cellAdd}`}
          onClick={() => addSketchCanvas(createCanvas(nextZ))}
          title={`Add plane at +${nextZ}m`}
        >
          +
        </button>
      </div>

      {/* Tool dock -- 5 primary pucks (bottom centre, pack S5.1) */}
      <div className={styles.toolDock} style={anchorStyle}>
        <button
          className={`${styles.puck} ${sketchMode ? styles.puckLight : ""}`}
          onClick={() => setSketchMode(!sketchMode)}
          title="Pen -- draw strokes on the active plane (S)"
        >
          PEN
        </button>
        <button
          className={`${styles.puck} ${earthworksView ? styles.puckActive : ""}`}
          onClick={() => setEarthworksView(!earthworksView)}
          title="Grading -- cut/fill earthworks overlay"
        >
          GRD
        </button>
        <button
          className={`${styles.puck} ${extrusionToolArmed ? styles.puckActive : ""}`}
          onClick={() => toggleExtrusionTool()}
          title="Mass -- extrude a closed stroke into a 3D mass"
        >
          MAS
        </button>
        <button
          className={`${styles.puck} ${sliceActive ? styles.puckActive : ""}`}
          onClick={() => setSliceActive(!sliceActive)}
          title="Cut -- section slice instrument"
        >
          CUT
        </button>
        <button
          className={styles.puck}
          onClick={() => setSiteSetupOpen(true)}
          title="Reference -- import survey/site truth underlay"
        >
          REF
        </button>
      </div>

      {/* Readout -- cut/fill volumes (bottom-left, pack S5.1) */}
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

      {/* Readout -- anchor state (bottom-right, pack S5.1) */}
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

      {/* Extrusion panel -- appears when MAS tool is armed and a stroke is
          selected. Slider adjusts depth in real-time; COMMIT finalizes. */}
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

      {/* AI site setup modal -- frosted-glass ingestion overlay (REF puck). */}
      {siteSetupOpen && (
        <SiteSetupModal onClose={() => setSiteSetupOpen(false)} />
      )}
    </>
  );
}
