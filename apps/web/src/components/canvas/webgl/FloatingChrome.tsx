"use client";

/**
 * Spatial Sketching — FloatingChrome.
 *
 * The 2D "liquid glass" overlay that floats above the 3D canvas. Contains:
 *   - Depth Rail: vertical pill showing each SketchCanvas plane's Z-height.
 *     Clicking a cell sets the active canvas. A "+" cell adds a new plane.
 *   - Toggles: handedness (RIGHT/LEFT) and mode (DRAFTING/SKETCHING) pills.
 *   - Readout: active plane + mode status (bottom corner).
 *
 * Handedness mirrors every anchor left/right (depth rail, toggles, readout).
 * Per the design handoff §6.1: "Mirrors, left-right: primary chip, status
 * pills, depth rail, both bottom readouts, and the scale margin."
 *
 * Styling: CSS Modules + CSS variables (no Tailwind). The glass effect uses
 * --cf-glass-dark + backdrop-filter: blur(18px), matching the design handoff
 * tokens for glass background and border colour.
 */

import { useMemo, useState } from "react";
import type { SketchCanvas } from "@workstream/contracts";
import { useStudioStore } from "./studioStore";
import { SiteSetupModal } from "./SiteSetupModal";
import styles from "./FloatingChrome.module.css";

/** The three season tags, in cycle order. */
const SEASON_TAGS = ["ALL", "SUMMER", "WINTER"] as const;
type SeasonTag = (typeof SEASON_TAGS)[number];

/** Cycle to the next season tag. */
function nextSeasonTag(current: SeasonTag): SeasonTag {
  const idx = SEASON_TAGS.indexOf(current);
  return SEASON_TAGS[(idx + 1) % SEASON_TAGS.length]!;
}

/** Short label for the season tag toggle. */
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

/** Format a Z-height as a compact label (e.g. 1.5 -> "1.5", 0 -> "GRD"). */
function zLabel(z: number): string {
  if (z === 0) return "GRD";
  return z.toFixed(1).replace(/\.0$/, "");
}

/** Create a new SketchCanvas at a default raised position. */
function createCanvas(z: number): SketchCanvas {
  return {
    id: crypto.randomUUID(),
    position: [0, z, 0],
    rotation: [0, 0, 0, 1], // identity quaternion
    label: `Plane +${z.toFixed(1)}m`,
    season_tag: "ALL",
  };
}

export function FloatingChrome({
  onOpenPalette,
}: {
  onOpenPalette: () => void;
}) {
  const canvases = useStudioStore((s) => s.sketchCanvases);
  const activeCanvasId = useStudioStore((s) => s.activeCanvasId);
  const handedness = useStudioStore((s) => s.handedness);
  const draftingMode = useStudioStore((s) => s.draftingMode);
  const transferToolArmed = useStudioStore((s) => s.transferToolArmed);
  const transferSourceStrokeId = useStudioStore((s) => s.transferSourceStrokeId);
  const setActiveCanvasId = useStudioStore((s) => s.setActiveCanvasId);
  const setHandedness = useStudioStore((s) => s.setHandedness);
  const setDraftingMode = useStudioStore((s) => s.setDraftingMode);
  const setTransferToolArmed = useStudioStore((s) => s.setTransferToolArmed);
  const addSketchCanvas = useStudioStore((s) => s.addSketchCanvas);
  const updateSketchCanvas = useStudioStore((s) => s.updateSketchCanvas);
  const cameraBookmarks = useStudioStore((s) => s.cameraBookmarks);
  const isPlayingFlythrough = useStudioStore((s) => s.isPlayingFlythrough);
  const captureCameraBookmark = useStudioStore((s) => s.captureCameraBookmark);
  const removeCameraBookmark = useStudioStore((s) => s.removeCameraBookmark);
  const toggleFlythrough = useStudioStore((s) => s.toggleFlythrough);
  const extrusionToolArmed = useStudioStore((s) => s.extrusionToolArmed);
  const selectedExtrusionStrokeId = useStudioStore((s) => s.selectedExtrusionStrokeId);
  const activeExtrusionDepth = useStudioStore((s) => s.activeExtrusionDepth);
  const toggleExtrusionTool = useStudioStore((s) => s.toggleExtrusionTool);
  const setActiveExtrusionDepth = useStudioStore((s) => s.setActiveExtrusionDepth);
  const commitExtrusion = useStudioStore((s) => s.commitExtrusion);
  const aiProcessingState = useStudioStore((s) => s.aiProcessingState);
  const processSiteDocuments = useStudioStore((s) => s.processSiteDocuments);
  const renderMode = useStudioStore((s) => s.renderMode);
  const cameraPosture = useStudioStore((s) => s.cameraPosture);
  const toggleRenderMode = useStudioStore((s) => s.toggleRenderMode);
  const setCameraPosture = useStudioStore((s) => s.setCameraPosture);
  const [siteSetupOpen, setSiteSetupOpen] = useState(false);

  const isLeft = handedness === "LEFT";

  // Sorted by Z-height descending (highest plane at top of the rail).
  const sortedCanvases = useMemo(
    () => [...canvases].sort((a, b) => b.position[1] - a.position[1]),
    [canvases],
  );

  // The next Z-height for the "+" button (increment by 1.5m above the highest).
  const nextZ = useMemo(() => {
    if (sortedCanvases.length === 0) return 1.5;
    const maxZ = sortedCanvases[0]!.position[1];
    return Math.round((maxZ + 1.5) * 10) / 10;
  }, [sortedCanvases]);

  const railSide = isLeft ? styles.railLeft : styles.railRight;
  const togglesSide = isLeft ? styles.togglesLeft : styles.togglesRight;
  const readoutSide = isLeft ? styles.readoutLeft : styles.readoutRight;

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId);
  const activeLabel = activeCanvas
    ? zLabel(activeCanvas.position[1])
    : "GRD";

  return (
    <>
      {/* Depth Rail — vertical pill showing the plane stack */}
      <div className={`${styles.rail} ${railSide}`}>
        <div className={styles.railHeader}>Z</div>
        {sortedCanvases.map((canvas) => {
          const isActive = canvas.id === activeCanvasId;
          return (
            <div key={canvas.id} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <button
                className={`${styles.cell} ${isActive ? styles.cellActive : ""}`}
                onClick={() => setActiveCanvasId(canvas.id)}
                title={canvas.label ?? `Plane +${canvas.position[1]}m`}
              >
                {zLabel(canvas.position[1])}
              </button>
              {/* Phase 4: Season tag cycle button — click to cycle ALL -> SUMMER -> WINTER */}
              <button
                className={`${styles.seasonTag} ${canvas.season_tag === "SUMMER"
                  ? styles.seasonTagSummer
                  : canvas.season_tag === "WINTER"
                    ? styles.seasonTagWinter
                    : styles.seasonTagAll
                  }`}
                onClick={(e) => {
                  e.stopPropagation();
                  const currentTag = (canvas.season_tag ?? "ALL") as SeasonTag;
                  updateSketchCanvas(canvas.id, {
                    ...canvas,
                    season_tag: nextSeasonTag(currentTag),
                  });
                }}
                title={`Season: ${canvas.season_tag ?? "ALL"} — click to cycle`}
              >
                {seasonTagLabel((canvas.season_tag ?? "ALL") as SeasonTag)}
              </button>
            </div>
          );
        })}
        {/* Ground plane cell — always present (canvas_id = null) */}
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

      {/* Toggles — handedness + drafting mode */}
      <div className={`${styles.toggles} ${togglesSide}`}>
        <button
          className={`${styles.pill} ${isLeft ? styles.pillActive : ""}`}
          onClick={() => setHandedness(isLeft ? "RIGHT" : "LEFT")}
          title="Toggle handedness (Opt+H)"
        >
          <span className={styles.pillLabel}>HAND</span>
          <span className={styles.pillValue}>{handedness}</span>
        </button>
        <button
          className={`${styles.pill} ${draftingMode ? styles.pillActive : ""}`}
          onClick={() => setDraftingMode(!draftingMode)}
          title="Toggle drafting/sketching mode (Opt+R)"
        >
          <span className={styles.pillLabel}>MODE</span>
          <span className={styles.pillValue}>
            {draftingMode ? "DRAFT" : "SKETCH"}
          </span>
        </button>
        <button
          className={`${styles.pill} ${transferToolArmed ? styles.pillActive : ""}`}
          onClick={() => setTransferToolArmed(!transferToolArmed)}
          title="Arm stroke transfer tool — click a stroke, then click a target canvas"
        >
          <span className={styles.pillLabel}>XFER</span>
          <span className={styles.pillValue}>
            {transferToolArmed
              ? transferSourceStrokeId
                ? "PICK TGT"
                : "PICK SRC"
              : "OFF"}
          </span>
        </button>
        <button
          className={`${styles.pill} ${extrusionToolArmed ? styles.pillActive : ""}`}
          onClick={() => toggleExtrusionTool()}
          title="Arm extrusion tool — click a closed stroke to select it, then set depth and commit"
        >
          <span className={styles.pillLabel}>EXT</span>
          <span className={styles.pillValue}>
            {extrusionToolArmed
              ? selectedExtrusionStrokeId
                ? "SET DEPTH"
                : "PICK"
              : "OFF"}
          </span>
        </button>
        <button
          className={`${styles.pill} ${aiProcessingState !== "IDLE" ? styles.pillActive : ""}`}
          onClick={() => void processSiteDocuments()}
          disabled={aiProcessingState !== "IDLE"}
          title="Sync site truth — fetch Vicmap GIS data to auto-generate the 3D topographic stack, legal setback lines, and building mass"
        >
          <span className={styles.pillLabel}>GIS</span>
          <span className={styles.pillValue}>
            {aiProcessingState === "ANALYZING_SURVEY"
              ? "FETCHING…"
              : aiProcessingState === "GENERATING_SITE"
                ? "GENERATING…"
                : aiProcessingState === "SUCCESS"
                  ? "DONE"
                  : "SYNC"}
          </span>
        </button>
        <button
          className={styles.pill}
          onClick={() => setSiteSetupOpen(true)}
          title="AI site setup — upload a survey PDF to auto-generate the 3D topographic stack + legal setback lines + building mass"
        >
          <span className={styles.pillLabel}>AI</span>
          <span className={styles.pillValue}>SETUP</span>
        </button>
        <button
          className={`${styles.pill} ${renderMode === "IMMERSIVE" ? styles.pillActive : ""}`}
          onClick={() => toggleRenderMode()}
          title="Render mode — TECHNICAL (clean drafting) or IMMERSIVE (AAA post-processing with contact shadows + depth of field)"
        >
          <span className={styles.pillLabel}>RENDER</span>
          <span className={styles.pillValue}>
            {renderMode === "IMMERSIVE" ? "IMMRSV" : "TECH"}
          </span>
        </button>
        <button
          className={`${styles.pill} ${cameraPosture === "PEDESTRIAN" ? styles.pillActive : ""}`}
          onClick={() =>
            setCameraPosture(cameraPosture === "ORBIT" ? "PEDESTRIAN" : "ORBIT")
          }
          title="Camera posture — ORBIT (fused rig) or WALK (1.7m first-person pedestrian, WASD to move)"
        >
          <span className={styles.pillLabel}>VIEW</span>
          <span className={styles.pillValue}>
            {cameraPosture === "PEDESTRIAN" ? "WALK" : "ORBIT"}
          </span>
        </button>
        <button
          className={styles.pill}
          onClick={() => onOpenPalette()}
          title="Open spatial command palette (Cmd/Ctrl+K)"
        >
          <span className={styles.pillLabel}>JUMP</span>
          <span className={styles.pillValue}>⌘K</span>
        </button>
      </div>

      {/* Readout — active plane + mode (bottom corner) */}
      <div className={`${styles.readout} ${readoutSide}`}>
        <div className={styles.readoutPill}>
          PLANE <span className={styles.readoutPillAccent}>{activeLabel}</span>
        </div>
        <div className={styles.readoutPill}>
          {draftingMode ? (
            <>DRAFTING · <span className={styles.readoutPillAccent}>1.0m SNAP</span></>
          ) : (
            <>SKETCHING · FREE</>
          )}
        </div>
      </div>

      {/* Extrusion panel — appears when EXT tool is armed and a stroke is
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

      {/* Fly-through bar — bottom center, frosted glass.
          Capture View saves the current camera position + look-at.
          Bookmark dots show saved views (click to remove).
          PLAY/STOP toggles the spline-based fly-through animation. */}
      <div className={styles.flyBar}>
        <button
          className={styles.flyBtn}
          onClick={() => captureCameraBookmark()}
          title="Capture current view as a bookmark"
        >
          CAPTURE
        </button>
        {cameraBookmarks.length > 0 && (
          <div className={styles.flyDots}>
            {cameraBookmarks.map((bm, i) => (
              <button
                key={bm.id}
                className={styles.flyDot}
                onClick={() => removeCameraBookmark(bm.id)}
                title={`Bookmark ${i + 1} — click to remove`}
              />
            ))}
          </div>
        )}
        <button
          className={`${styles.flyBtn} ${isPlayingFlythrough ? styles.flyBtnStop : styles.flyBtnPlay
            }`}
          onClick={() => toggleFlythrough()}
          disabled={cameraBookmarks.length < 2}
          title={
            cameraBookmarks.length < 2
              ? "Need at least 2 bookmarks to play"
              : isPlayingFlythrough
                ? "Stop fly-through"
                : "Play fly-through"
          }
        >
          {isPlayingFlythrough ? "STOP" : "PLAY"}
        </button>
      </div>

      {/* AI site setup modal — frosted-glass ingestion overlay (Phase 7). */}
      {siteSetupOpen && (
        <SiteSetupModal onClose={() => setSiteSetupOpen(false)} />
      )}
    </>
  );
}
