"use client";

/**
 * FloatingChrome -- Bento redesign (Apple Vision Pro style).
 *
 * Premium frosted-glass docks -- substantial, legible, feature-rich.
 * No microscopic text. No scattered dots. Cohesive glass panels.
 *
 * Anchor slots (mirrored by handedness):
 *   PrimaryChip  -- top corner, hand-side-opposite (project + scale info)
 *   ContextBar   -- top corner, hand-side (unified: theme + UI scale + drafting + tilt)
 *   DepthRail    -- side edge, vertically centred (wider, more legible)
 *   ToolDock     -- bottom centre (premium dock: Sketch/Extrude/Transfer/Measure/Reference)
 *   Readouts     -- bottom corners (cut/fill + anchor state)
 *   PerimeterTrack -- 1px inset border framing the viewport
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

export interface FloatingChromeProps {
  scaleM: number;
  boardAspect: number;
  northBearingDeg: number | null;
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
  const canvasTheme = useStudioStore((s) => s.canvasTheme);
  const projectAddress = useStudioStore((s) => s.projectAddress);
  const liveRig = useStudioStore((s) => s.liveRig);
  const sketchMode = useStudioStore((s) => s.sketchMode);
  const earthworksView = useStudioStore((s) => s.earthworksView);
  const extrusionToolArmed = useStudioStore((s) => s.extrusionToolArmed);
  const selectedExtrusionStrokeId = useStudioStore((s) => s.selectedExtrusionStrokeId);
  const activeExtrusionDepth = useStudioStore((s) => s.activeExtrusionDepth);
  const sliceActive = useStudioStore((s) => s.sliceActive);
  const transferToolArmed = useStudioStore((s) => s.transferToolArmed);
  const measureActive = useStudioStore((s) => s.measureActive);
  const setActiveCanvasId = useStudioStore((s) => s.setActiveCanvasId);
  const setHandedness = useStudioStore((s) => s.setHandedness);
  const setDraftingMode = useStudioStore((s) => s.setDraftingMode);
  const setAnchorVisibility = useStudioStore((s) => s.setAnchorVisibility);
  const setUiScale = useStudioStore((s) => s.setUiScale);
  const toggleCanvasTheme = useStudioStore((s) => s.toggleCanvasTheme);
  const setSketchMode = useStudioStore((s) => s.setSketchMode);
  const setEarthworksView = useStudioStore((s) => s.setEarthworksView);
  const toggleExtrusionTool = useStudioStore((s) => s.toggleExtrusionTool);
  const setActiveExtrusionDepth = useStudioStore((s) => s.setActiveExtrusionDepth);
  const commitExtrusion = useStudioStore((s) => s.commitExtrusion);
  const setSliceActive = useStudioStore((s) => s.setSliceActive);
  const setTransferToolArmed = useStudioStore((s) => s.setTransferToolArmed);
  const setMeasureActive = useStudioStore((s) => s.setMeasureActive);
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

  const primarySide = isLeft ? styles.primaryChipLeft : styles.primaryChipRight;
  const contextSide = isLeft ? styles.contextBarLeft : styles.contextBarRight;
  const railSide = isLeft ? styles.railLeft : styles.railRight;
  const readoutLeftSide = isLeft ? styles.readoutGroupRight : styles.readoutGroupLeft;
  const readoutRightSide = isLeft ? styles.readoutGroupLeft : styles.readoutGroupRight;

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId);
  const activeLabel = activeCanvas ? zLabel(activeCanvas.position[1]) : "GRD";

  const scaleRatio = `1:${Math.round(scaleM * 2)}`;
  const tiltDeg = Math.round(liveRig.tiltDeg);
  const tiltLabel = tiltDeg === 0 ? "PLAN" : `AXO ${tiltDeg}deg`;
  const northLabel = northBearingDeg != null ? "N-up" : "N?";

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

      {/* Primary chip -- project name + scale info */}
      <div className={`${styles.primaryChip} ${primarySide}`} style={anchorStyle}>
        <div className={styles.primaryAccentSquare} />
        <span className={styles.primaryName}>
          {projectAddress || "Untitled site"}
        </span>
        <span className={styles.primaryMeta}>
          {tiltLabel} {northLabel} {scaleRatio}
        </span>
      </div>

      {/* Context bar -- unified glass panel (theme + UI scale + drafting + tilt) */}
      <div className={`${styles.contextBar} ${contextSide}`} style={anchorStyle}>
        <button
          className={`${styles.contextCell} ${canvasTheme === "DARK" ? styles.contextCellAccent : ""}`}
          onClick={toggleCanvasTheme}
          title="Toggle light/dark canvas theme"
        >
          {canvasTheme === "DARK" ? "DARK" : "LIGHT"}
        </button>
        <div className={styles.contextDivider} />
        <div className={styles.contextCell} title="UI scale">
          <span>UI</span>
          <input
            type="range"
            className={styles.contextSlider}
            min={0.85}
            max={1.3}
            step={0.05}
            value={uiScale}
            onChange={(e) => setUiScale(parseFloat(e.target.value))}
          />
          <span>{Math.round(uiScale * 100)}%</span>
        </div>
        <div className={styles.contextDivider} />
        <button
          className={`${styles.contextCell} ${draftingMode ? styles.contextCellAccent : ""}`}
          onClick={() => setDraftingMode(!draftingMode)}
          title="Toggle drafting/sketching (Opt+R)"
        >
          {draftingMode ? "SNAP 1.0m" : "FREE"}
        </button>
        <div className={styles.contextDivider} />
        <span className={styles.contextCell} title="Camera tilt">
          {tiltDeg}deg
        </span>
        <div className={styles.contextDivider} />
        <button
          className={styles.contextCell}
          onClick={() => setHandedness(isLeft ? "RIGHT" : "LEFT")}
          title="Toggle handedness (Opt+H)"
        >
          {handedness === "RIGHT" ? "RH" : "LH"}
        </button>
      </div>

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
      </div>

      {/* Tool dock -- premium frosted glass dock (bottom centre) */}
      <div className={styles.toolDock} style={anchorStyle}>
        <button
          className={`${styles.puck} ${sketchMode ? styles.puckActive : ""}`}
          onClick={() => setSketchMode(!sketchMode)}
          title="Sketch -- draw strokes on the active plane (S)"
        >
          <span className={styles.puckIcon}>~</span>
          <span className={styles.puckLabel}>SKETCH</span>
        </button>
        <button
          className={`${styles.puck} ${extrusionToolArmed ? styles.puckActive : ""}`}
          onClick={() => toggleExtrusionTool()}
          title="Extrude -- extrude a closed stroke into a 3D mass"
        >
          <span className={styles.puckIcon}>[]</span>
          <span className={styles.puckLabel}>EXTRUDE</span>
        </button>
        <button
          className={`${styles.puck} ${transferToolArmed ? styles.puckActive : ""}`}
          onClick={() => setTransferToolArmed(!transferToolArmed)}
          title="Transfer -- project a stroke onto another plane"
        >
          <span className={styles.puckIcon}>{"->"}</span>
          <span className={styles.puckLabel}>TRANSFER</span>
        </button>
        <button
          className={`${styles.puck} ${measureActive ? styles.puckActive : ""}`}
          onClick={() => setMeasureActive(!measureActive)}
          title="Measure -- tape measure between two points"
        >
          <span className={styles.puckIcon}>|</span>
          <span className={styles.puckLabel}>MEASURE</span>
        </button>
        <button
          className={`${styles.puck} ${earthworksView ? styles.puckLight : ""}`}
          onClick={() => setEarthworksView(!earthworksView)}
          title="Grading -- cut/fill earthworks overlay"
        >
          <span className={styles.puckIcon}>~</span>
          <span className={styles.puckLabel}>GRADE</span>
        </button>
        <button
          className={`${styles.puck} ${sliceActive ? styles.puckActive : ""}`}
          onClick={() => setSliceActive(!sliceActive)}
          title="Section -- section slice instrument"
        >
          <span className={styles.puckIcon}>=</span>
          <span className={styles.puckLabel}>SECTION</span>
        </button>
        <button
          className={styles.puck}
          onClick={() => setSiteSetupOpen(true)}
          title="Reference -- import survey/site truth underlay"
        >
          <span className={styles.puckIcon}>+</span>
          <span className={styles.puckLabel}>REF</span>
        </button>
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

      {/* Extrusion panel -- appears when EXTRUDE tool is armed + stroke selected */}
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
