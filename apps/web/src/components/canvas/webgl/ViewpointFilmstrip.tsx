"use client";

/**
 * Viewpoint filmstrip + walk/record controls (Phase C, turn 7a / screen 16b).
 *
 * Spec §4 Geometry: "Viewpoint filmstrip | thumbs 82x52, radius 9px; active
 * 1.5px accent border + 0 0 0 3px accent/.18".
 * Spec §5 Class B selected: matte lift + 1.5px accent border + 0 0 0 3px
 * accent/.18 ring + 18x2px accent.hi pip.
 * Spec §9 state shape: "sketch: active, viewpoints [{ id, camera, thumb }],
 * playing, recording".
 *
 * Renders only in Sketch mode (screen 16b). Sits beside the camera dock
 * (bottom-centre). The filmstrip is a horizontal strip of viewpoint thumbs;
 * a capture button (+) adds a new viewpoint; a play button triggers the
 * fly-through walk; a record button captures the walk as a WebM video.
 *
 * The existing FlythroughRig.tsx plays the spline through the camera; this
 * component is the UI that drives it. The existing store fields
 * (cameraBookmarks, isPlayingFlythrough, toggleFlythrough) are reused —
 * Phase C extends them with thumb + rig snapshot + recording state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasMode } from "../../../lib/canvas-mode";
import { VisibilityPanel } from "./VisibilityPanel";
import { useStudioStore } from "./studioStore";
import { captureViewpointThumbnail } from "./viewpointThumbnail";
import styles from "./ViewpointFilmstrip.module.css";

export interface ViewpointFilmstripProps {
  /** The active studio mode — filmstrip renders only in Sketch. */
  mode: CanvasMode;
}

export function ViewpointFilmstrip({ mode }: ViewpointFilmstripProps) {
  const bookmarks = useStudioStore((s) => s.cameraBookmarks);
  const activeViewpointId = useStudioStore((s) => s.activeViewpointId);
  const isPlayingFlythrough = useStudioStore((s) => s.isPlayingFlythrough);
  const isRecordingWalk = useStudioStore((s) => s.isRecordingWalk);
  const captureViewpoint = useStudioStore((s) => s.captureViewpoint);
  const restoreViewpoint = useStudioStore((s) => s.restoreViewpoint);
  const removeCameraBookmark = useStudioStore((s) => s.removeCameraBookmark);
  const toggleFlythrough = useStudioStore((s) => s.toggleFlythrough);
  const setRecordingWalk = useStudioStore((s) => s.setRecordingWalk);
  // Phase C2 — timeline controls.
  const walkLingerS = useStudioStore((s) => s.walkLingerS);
  const walkTransitionS = useStudioStore((s) => s.walkTransitionS);
  const walkLoop = useStudioStore((s) => s.walkLoop);
  const walkProgress = useStudioStore((s) => s.walkProgress);
  const setWalkLingerS = useStudioStore((s) => s.setWalkLingerS);
  const setWalkTransitionS = useStudioStore((s) => s.setWalkTransitionS);
  const toggleWalkLoop = useStudioStore((s) => s.toggleWalkLoop);

  // Phase J — visibility panel state (local UI state, not store).
  const [visibilityPanelOpen, setVisibilityPanelOpen] = useState(false);

  // MediaRecorder ref for the walk-through video capture.
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Find the live WebGL canvas element for thumbnail capture + video recording.
  const getCanvas = useCallback((): HTMLCanvasElement | null => {
    const studio = document.querySelector('[data-testid="webgl-studio"]');
    if (!studio) return null;
    return studio.querySelector("canvas");
  }, []);

  // Capture a viewpoint: grab the current frame as a thumbnail, then store it.
  const onCapture = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const thumb = captureViewpointThumbnail(canvas);
    if (!thumb) return;
    captureViewpoint(thumb);
  }, [getCanvas, captureViewpoint]);

  // Restore a viewpoint by clicking its thumb.
  const onRestore = useCallback(
    (id: string) => {
      restoreViewpoint(id);
    },
    [restoreViewpoint],
  );

  // Delete a viewpoint.
  const onDelete = useCallback(
    (id: string) => {
      removeCameraBookmark(id);
    },
    [removeCameraBookmark],
  );

  // Play/pause the fly-through walk.
  const onToggleWalk = useCallback(() => {
    if (bookmarks.length < 2) return;
    toggleFlythrough();
  }, [bookmarks.length, toggleFlythrough]);

  // Start/stop recording the walk as a WebM video.
  const onToggleRecord = useCallback(() => {
    if (isRecordingWalk) {
      // Stop recording.
      recorderRef.current?.stop();
      setRecordingWalk(false);
      return;
    }
    const canvas = getCanvas();
    if (!canvas) return;
    // captureStream is not available in all browsers; guard with typeof.
    if (typeof canvas.captureStream !== "function") return;
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9",
    });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workstream-walkthrough-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecordingWalk(true);
  }, [isRecordingWalk, getCanvas, setRecordingWalk]);

  // Clean up the recorder on unmount.
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
  }, []);

  // The filmstrip renders only in Sketch mode (screen 16b).
  if (mode !== "sketch") return null;

  const canWalk = bookmarks.length >= 2;

  return (
    <div className={styles.filmstrip} data-testid="viewpoint-filmstrip">
      {/* Capture button — adds a new viewpoint at the current camera pose. */}
      <button
        className={styles.captureBtn}
        onClick={onCapture}
        title="Capture viewpoint (adds the current camera pose to the filmstrip)"
        data-testid="viewpoint-capture"
      >
        +
      </button>

      {/* Viewpoint thumbs — horizontal strip, 82x52 each per ss4 Geometry. */}
      <div className={styles.thumbsRow} data-testid="viewpoint-thumbs">
        {bookmarks.map((vp, i) => (
          <button
            key={vp.id}
            className={`${styles.thumb} ${activeViewpointId === vp.id ? styles.thumbActive : ""}`}
            onClick={() => onRestore(vp.id)}
            title={`Viewpoint ${i + 1}${vp.preset ? ` (${vp.preset.toUpperCase()})` : ""}`}
            data-testid="viewpoint-thumb"
            data-viewpoint-id={vp.id}
            data-active={activeViewpointId === vp.id ? "true" : "false"}
          >
            {vp.thumb ? (
              <img
                src={vp.thumb}
                alt={`Viewpoint ${i + 1}`}
                className={styles.thumbImg}
                draggable={false}
              />
            ) : (
              <span className={styles.thumbPlaceholder}>{i + 1}</span>
            )}
            {/* Class B pip — 18x2px accent.hi bar at the top when active. */}
            {activeViewpointId === vp.id && <span className={styles.thumbPip} />}
            {/* Hover delete button. */}
            <span
              className={styles.thumbDelete}
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(vp.id);
              }}
              title="Delete viewpoint"
            >
              x
            </span>
          </button>
        ))}
      </div>

      {/* Walk/record controls. */}
      <div className={styles.controls}>
        <button
          className={`${styles.walkBtn} ${isPlayingFlythrough ? styles.walkBtnActive : ""}`}
          onClick={onToggleWalk}
          disabled={!canWalk}
          title={
            canWalk
              ? isPlayingFlythrough
                ? "Pause walk-through"
                : "Play walk-through (fly through all viewpoints)"
              : "Need 2+ viewpoints to walk"
          }
          data-testid="viewpoint-walk"
        >
          {isPlayingFlythrough ? "II" : ">"}
        </button>
        <button
          className={`${styles.recordBtn} ${isRecordingWalk ? styles.recordBtnActive : ""}`}
          onClick={onToggleRecord}
          disabled={!canWalk}
          title={
            canWalk
              ? isRecordingWalk
                ? "Stop recording"
                : "Record walk-through as video"
              : "Need 2+ viewpoints to record"
          }
          data-testid="viewpoint-record"
        >
          {isRecordingWalk ? "STOP" : "REC"}
        </button>
        {/* Phase J — visibility panel toggle. Opens the per-viewpoint
            canvas visibility keyframe matrix. */}
        <button
          className={`${styles.visibilityBtn} ${visibilityPanelOpen ? styles.visibilityBtnActive : ""}`}
          onClick={() => setVisibilityPanelOpen((o) => !o)}
          disabled={bookmarks.length === 0}
          title={
            bookmarks.length === 0
              ? "Capture viewpoints first to keyframe visibility"
              : visibilityPanelOpen
                ? "Close visibility panel"
                : "Edit per-viewpoint canvas visibility"
          }
          data-testid="viewpoint-visibility"
        >
          VIS
        </button>
      </div>

      {/* Phase C2 — timeline controls: linger, transition, loop, progress. */}
      <div className={styles.timelineControls} data-testid="viewpoint-timeline">
        <label className={styles.timelineLabel} title="Seconds the camera pauses at each viewpoint">
          <span className={styles.timelineLabelText}>LINGER</span>
          <input
            type="range"
            className={styles.timelineSlider}
            min={0}
            max={5}
            step={0.25}
            value={walkLingerS}
            onChange={(e) => setWalkLingerS(parseFloat(e.target.value))}
            data-testid="walk-linger-slider"
          />
          <span className={styles.timelineValue}>{walkLingerS.toFixed(1)}s</span>
        </label>
        <label className={styles.timelineLabel} title="Seconds for the camera to fly between viewpoints">
          <span className={styles.timelineLabelText}>TRANSITION</span>
          <input
            type="range"
            className={styles.timelineSlider}
            min={0.5}
            max={10}
            step={0.5}
            value={walkTransitionS}
            onChange={(e) => setWalkTransitionS(parseFloat(e.target.value))}
            data-testid="walk-transition-slider"
          />
          <span className={styles.timelineValue}>{walkTransitionS.toFixed(1)}s</span>
        </label>
        <button
          className={`${styles.loopBtn} ${walkLoop ? styles.loopBtnActive : ""}`}
          onClick={toggleWalkLoop}
          title={walkLoop ? "Loop on (walk repeats)" : "Loop off (walk stops after one pass)"}
          data-testid="walk-loop-toggle"
        >
          {walkLoop ? "\u21BB" : "\u2192"}
        </button>
      </div>

      {/* Phase C2 — progress bar showing the walk playback head. */}
      {isPlayingFlythrough && (
        <div className={styles.progressBar} data-testid="walk-progress-bar">
          <div
            className={styles.progressFill}
            style={{ width: `${Math.round(walkProgress * 100)}%` }}
          />
        </div>
      )}

      {/* Phase J — visibility panel (per-viewpoint canvas visibility
          keyframing). Drops down above the filmstrip. */}
      <VisibilityPanel
        open={visibilityPanelOpen}
        onClose={() => setVisibilityPanelOpen(false)}
      />
    </div>
  );
}
