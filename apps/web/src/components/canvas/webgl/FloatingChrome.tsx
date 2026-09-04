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
import type { DesignKeylessOverlay } from "@workstream/contracts";
import type { CanvasMode } from "../../../lib/canvas-mode";
import type { CanopyComplianceResult } from "./canopyCompliance";
import { useStudioStore } from "./studioStore";
import { StrikeChip } from "./StrikeChip";
import { FailureState } from "./FailureState";
import { HistoryScrub } from "./HistoryScrub";
import type { StrikeAlertData } from "./features/SubsurfaceEngine";
import { SiteSetupModal } from "./SiteSetupModal";
import type { HeightmapPoint } from "./coordTransform";
import { createElevationSampler } from "./terrainMath";
import { padStrokes, padCutFill, CUT_FILL_CELL_M } from "./cutFill";
import { ToolRibbon } from "./ToolRibbon";
import { ToolFlyout } from "./ToolFlyout";
import { CanvasPlacementFlyout } from "./CanvasPlacementFlyout";
import { BirdsEyeHud } from "./BirdsEyeHud";
import { CameraDock } from "./CameraDock";
import { WfsChips } from "./WfsChips";
import { LayersPanel } from "./LayersPanel";
import { DepthRail } from "./DepthRail";
import { CanvasCardsRail } from "./CanvasCardsRail";
import { ViewpointFilmstrip } from "./ViewpointFilmstrip";
import { CalibrateModal } from "./CalibrateModal";
import { DrawViewToggle } from "./DrawViewToggle";
import { SelectionModeToggle } from "./SelectionModeToggle";
import dynamic from "next/dynamic";
import { SelectionIsolationOverlay } from "./SelectionIsolationOverlay";
import { NumericSlider } from "./NumericSlider";
import { PinnedConflictCard } from "./StrikeChip";
import { LiveNibReadout } from "./LiveNibReadout";
import styles from "./FloatingChrome.module.css";

// Lazy: TidyHud only ever renders behind `tidyHud &&` below — it is a
// transient actor that spawns at a stroke's pen-lift point and self-
// destructs on commit/dismiss, so most page loads never mount it at all.
// Same reasoning as SheetComposer's dynamic() boundary just above.
const TidyHud = dynamic(() => import("./TidyHud").then((m) => m.TidyHud), {
  ssr: false,
});

/* ---- helpers ---- */

function zLabel(z: number): string {
  if (z === 0) return "GRD";
  return z.toFixed(1).replace(/\.0$/, "");
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
  /** True when the project has no confirmed scale — shows the UNSCALED badge. */
  unscaled?: boolean;
  boardAspect: number;
  northBearingDeg: number | null;
  heightmapPoints: HeightmapPoint[];
  /** The active studio mode — drives which rail renders (16a depth vs 16b cards). */
  mode: CanvasMode;
  /** Project id — needed by the calibrate modal to persist the new board_width_m. */
  projectId: string;
  /** KEYLESS Vicmap/DELWP site-frame overlays → WFS chip pills (§5.4). */
  keylessOverlays?: DesignKeylessOverlay[];
  /** Title-plan easement ring count → the dig-safety easement pill. */
  easementRingCount?: number;
  /** ResCode A2-6 canopy compliance → the A2-6 obligation pill. */
  canopy?: CanopyComplianceResult | null;
  /** Phase N — strike alerts for the strike chip + conflict card. */
  strikeAlerts?: StrikeAlertData[];
  /** Phase O — re-run the site-truth import behind the overlay failure card.
   *  Omitted = the card offers dismiss only, never a Retry that does nothing. */
  onRetrySiteTruth?: () => void;
}

export function FloatingChrome({
  scaleM,
  unscaled = false,
  boardAspect,
  northBearingDeg,
  heightmapPoints,
  mode,
  projectId,
  keylessOverlays = [],
  easementRingCount = 0,
  canopy = null,
  strikeAlerts = [],
  onRetrySiteTruth,
}: FloatingChromeProps) {
  const canvases = useStudioStore((s) => s.sketchCanvases);
  const activeCanvasId = useStudioStore((s) => s.activeCanvasId);
  const handedness = useStudioStore((s) => s.handedness);
  const anchorVisibility = useStudioStore((s) => s.anchorVisibility);
  const extrusionToolArmed = useStudioStore((s) => s.extrusionToolArmed);
  const activeTool = useStudioStore((s) => s.activeTool);
  const selectedExtrusionStrokeId = useStudioStore((s) => s.selectedExtrusionStrokeId);
  const activeExtrusionDepth = useStudioStore((s) => s.activeExtrusionDepth);
  const setAnchorVisibility = useStudioStore((s) => s.setAnchorVisibility);
  const setActiveExtrusionDepth = useStudioStore((s) => s.setActiveExtrusionDepth);
  const commitExtrusion = useStudioStore((s) => s.commitExtrusion);
  const [siteSetupOpen, setSiteSetupOpen] = useState(false);
  const [placementFlyoutOpen, setPlacementFlyoutOpen] = useState(false);
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const scaleView = useStudioStore((s) => s.scaleView);
  const setScaleView = useStudioStore((s) => s.setScaleView);
  // liveCoord is now consumed by LiveNibReadout (cursor-adjacent), not here.
  // Phase O — failure states (drawn, not silent)
  const overlayFetchError = useStudioStore((s) => s.overlayFetchError);
  const importError = useStudioStore((s) => s.importError);
  const underlayError = useStudioStore((s) => s.underlayError);
  const calibrationError = useStudioStore((s) => s.calibrationError);
  const setOverlayFetchError = useStudioStore((s) => s.setOverlayFetchError);
  const setImportError = useStudioStore((s) => s.setImportError);
  const setUnderlayError = useStudioStore((s) => s.setUnderlayError);
  const setCalibrationError = useStudioStore((s) => s.setCalibrationError);
  // Tidy HUD — cursor-anchored classifier feedback
  const tidyHud = useStudioStore((s) => s.tidyHud);
  const dismissTidyHud = useStudioStore((s) => s.dismissTidyHud);
  // Each failure card is a centred `inset: 0` layer, so two at once would
  // print on top of each other. Show the newest; dismissing it reveals the
  // next one down.
  const topFailure = useMemo(() => {
    const live: { key: string; at: number }[] = [];
    if (overlayFetchError) live.push({ key: "overlay", at: overlayFetchError.at });
    if (importError) live.push({ key: "import", at: importError.at });
    if (underlayError) live.push({ key: "underlay", at: underlayError.at });
    if (calibrationError) live.push({ key: "calibration", at: calibrationError.at });
    return live.sort((a, b) => b.at - a.at)[0]?.key ?? null;
  }, [overlayFetchError, importError, underlayError, calibrationError]);
  // The legacy fixed-position coord-chip was removed — the cursor-adjacent
  // LiveNibReadout now tracks the stylus tip directly via translate3d.

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
        unscaled={unscaled}
        onCalibrate={() => setCalibrateOpen(true)}
      />

      {/* Phase N — strike chip in the top bar beside the WFS chips.
          Count + severity, tap cycles and flies the camera. The chip is a
          signal only — the conflict card is a 3D-pinned DOM actor below. */}
      <StrikeChip strikes={strikeAlerts} />

      {/* 3D-pinned conflict card — floats over the clash geometry. Reads
          screen coords from the store (written by ConflictCardProjector in
          the R3F canvas). Stays pinned through orbits/pans; self-destructs
          only on explicit resolve (REROUTE/DEEPEN/FLAG) or close (×). */}
      <PinnedConflictCard strikes={strikeAlerts} />

      {/* Tool ribbon — vertical glass panel, hand-opposite edge (handoff §5) */}
      <ToolRibbon />

      {/* Tool flyout (handoff §5.3 "blooming") — the second-tier column that
          blooms beside the active ribbon tool. Only renders when the active
          tool has real parameter state. Anchored to the ribbon's inner edge. */}
      {activeTool !== "none" && (
        <ToolFlyout tool={activeTool} handedness={handedness} />
      )}

      {/* Layers panel — planes + analysis toggles + WFS overlays, drops below
          the chip bar while the LAYERS ribbon tool is armed. */}
      {activeTool === "layers" && <LayersPanel overlays={keylessOverlays} />}

      {/* ---- Bottom-centre chrome stack ----
          One column of flow children, so a panel that grows pushes its
          neighbours instead of painting over them. These were five
          independently `position: absolute` panels with hand-computed
          `bottom` offsets, and three of them overlapped: the filmstrip sat
          entirely inside the history scrub, the scrub dipped into the dock,
          and the sketch toggles covered the dock's PLAN button. Bottom-up
          order (`column-reverse`) = the operator's order of reach. */}
      <div className={styles.bottomStack} data-testid="bottom-chrome-stack">
        {/* Row 1 — camera dock, 4 presets (handoff §6.1), held on the
            viewport centre line by the row's equal outer tracks. */}
        <div className={styles.dockRow}>
          <div className={styles.dockRowLead}>
            {/* Phase H — Selection Mode toggle. Activates red-mask
                isolation + boolean ops toolbar. */}
            {mode === "sketch" && <SelectionModeToggle />}
            {/* Phase G — Draw/View mode toggle. DRAW locks the camera
                face-on to the active canvas; VIEW allows free orbit. */}
            {mode === "sketch" && <DrawViewToggle />}
          </div>
          <CameraDock />
          {/* Right gutter — empty, and load-bearing: it balances the lead
              so the dock stays centred rather than shoved right. */}
          <div />
        </div>

        {/* Row 2 — Phase P history scrub. Segmented session track, 1:1 with
            the finger, zero easing. Branch-on-edit, never silent overwrite.
            Opens from the ribbon's HISTORY tool, the same way LAYERS opens
            its panel: `activeTool` already carried a `"history"` member and
            the ribbon already drew the tile, but nothing read it, so the
            button did nothing and the scrub instead sat over the drawing in
            every mode for the whole session. */}
        {activeTool === "history" && (
          <HistoryScrub
            scaleM={scaleM}
            boardAspect={boardAspect}
            heightmapPoints={heightmapPoints}
          />
        )}

        {/* Row 3 — viewpoint filmstrip + walk/record (Phase C, screen 16b,
            Sketch only). Collapses to its capture button until viewpoints
            exist, so an unused tool costs the drawing one button. */}
        <ViewpointFilmstrip mode={mode} />
      </div>

      {/* Phase H — Selection Mode isolation overlay + boolean ops toolbar.
          Renders the red-mask vignette and the ops toolbar when active. */}
      <SelectionIsolationOverlay />

      {/* Tidy HUD — cursor-anchored classifier feedback at the stroke terminal.
          Transient DOM actor; self-destructs on commit or ESC. */}
      {tidyHud && (
        <TidyHud
          x={tidyHud.x}
          y={tidyHud.y}
          strokeId={tidyHud.strokeId}
          onDismiss={dismissTidyHud}
        />
      )}

      {/* Live nib readout — cursor-adjacent digital readout tracking the
          stylus tip. The only UI at 100% opacity during a stroke. Positions
          via translate3d on a ref (compositor-only, no layout thrash). */}
      <LiveNibReadout />

      {/* Depth Rail (16a Drafting) — all non-sketch modes. Cells 36×34,
          two-way bands, no user canvas chips (those live in the cards rail). */}
      <DepthRail mode={mode} handedness={handedness} anchorStyle={anchorStyle} />

      {/* Canvas Cards Rail (16b Sketch) — Sketch mode only. Cards 74×46 with
          thumbnails, eye toggle, transparency, inline rename, double-click
          re-arm. The "+" add button lives here (sketch-mode action). */}
      <CanvasCardsRail
        mode={mode}
        handedness={handedness}
        defaultHeightM={nextZ}
        onAddClick={() => setPlacementFlyoutOpen((o) => !o)}
      />

      {/* Canvas placement flyout — blooms off the rail's "+" cell. A sibling
          of the rail (not nested inside it) so its viewport-relative
          position math resolves against the same positioned ancestor as
          ToolFlyout above, not the rail's own box. */}
      <CanvasPlacementFlyout
        open={placementFlyoutOpen}
        onClose={() => setPlacementFlyoutOpen(false)}
        defaultHeightM={nextZ}
      />

      {/* Bird's-eye HUD — mounts itself only while a plane is under the
          placement gizmo (Phase A3). Its own second WebGL context, so it
          must not linger past the drag. */}
      <BirdsEyeHud scaleM={scaleM} boardAspect={boardAspect} />

      {/* Readout -- cut/fill volumes (bottom-left).
          The legacy fixed-position coord-chip was removed — the cursor-
          adjacent LiveNibReadout now tracks the stylus tip directly. */}
      <div className={`${styles.readoutGroup} ${readoutLeftSide}`} style={anchorStyle}>
        {cutFill ? (
          <>
            <div className={styles.readoutPillCut}>
              <span className={styles.readoutValueCut}>{cutFill.cut}</span> CUT m3
            </div>
            <div className={styles.readoutPillCut}>
              <span className={styles.readoutValueFill}>{cutFill.fill}</span> FILL m3
            </div>
            <div className={styles.readoutPillCut}>
              BAL{" "}
              <span className={cutFill.cut >= cutFill.fill ? styles.readoutValueCut : styles.readoutValueFill}>
                {cutFill.cut - cutFill.fill}
              </span>{" "}
              m3
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

      {/* Scale toggle -- its own group above the anchor readout, outside the
          anchor dimming (Opt+F) so the scale switch is always legible. */}
      <div className={`${styles.readoutGroup} ${readoutRightSide} ${styles.scaleToggleGroup}`}>
        <button
          className={`${styles.readoutPillCut} ${scaleView ? styles.scaleToggleOn : ""}`}
          onClick={() => setScaleView(!scaleView)}
          title={
            scaleView
              ? "Hide scale overlays (edge ruler + dimensions)"
              : "Show scale overlays (edge ruler + dimensions)"
          }
          data-toggled={scaleView ? "on" : "off"}
          data-testid="scale-toggle"
          style={{ pointerEvents: "auto", cursor: "pointer" }}
        >
          SCALE {scaleView ? "ON" : "OFF"}
        </button>
      </div>

      {/* Extrusion panel -- appears when MASS tool is armed + stroke selected.
          Phase K — NumericSlider provides tap-to-type entry for depth. */}
      {extrusionToolArmed && selectedExtrusionStrokeId && (
        <div className={styles.extPanel}>
          <NumericSlider
            label="DEPTH"
            min={0.1}
            max={5}
            step={0.1}
            value={activeExtrusionDepth}
            onChange={setActiveExtrusionDepth}
            unit="m"
            title="Extrusion depth in metres"
            testId="extrusion-depth"
          />
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

      {/* Calibrate modal — retroactive two-point scaling (turn 15c).
          Opens from the UNSCALED badge in the chip bar. */}
      {calibrateOpen && (
        <CalibrateModal
          scaleM={scaleM}
          projectId={projectId}
          onClose={() => setCalibrateOpen(false)}
        />
      )}

      {/* Phase O — failure states (drawn, not silent). Each failure mode
          gets a named, actionable surface.

          Retry is only offered where a retry EXISTS. It used to be wired to
          the same handler as Dismiss on all four cards, so a button labelled
          "Retry" cleared the error and did nothing else — the failure looked
          resolved while the underlying import was never re-attempted.

          One at a time: every card is a centred `inset: 0` layer, so two
          live failures would print on top of each other. The newest is
          shown; dismissing it reveals the one beneath. */}
      {topFailure === "overlay" && overlayFetchError && (
        <FailureState
          kind="failed-import"
          title="Site truth import failed"
          detail={overlayFetchError.message}
          source={overlayFetchError.source}
          onRetry={
            onRetrySiteTruth
              ? () => {
                setOverlayFetchError(null);
                onRetrySiteTruth();
              }
              : undefined
          }
          onDismiss={() => setOverlayFetchError(null)}
        />
      )}
      {topFailure === "import" && importError && (
        <FailureState
          kind="failed-import"
          title="Import failed"
          detail={importError.message}
          source={importError.source}
          // No retry: the uploaded survey/title are not held after the
          // request, so a retry would have nothing to send. The operator
          // re-opens site setup and picks the files again.
          onDismiss={() => setImportError(null)}
        />
      )}
      {topFailure === "underlay" && underlayError && (
        <FailureState
          kind="corrupt-underlay"
          title="Underlay unreadable"
          detail={underlayError.message}
          source={underlayError.source}
          // No retry: the texture load already failed for this URI, and
          // re-requesting the same bytes reproduces the same failure.
          onDismiss={() => setUnderlayError(null)}
        />
      )}
      {topFailure === "calibration" && calibrationError && (
        <FailureState
          kind="rejected-calibration"
          title="Calibration not saved"
          detail={calibrationError.message}
          onRetry={() => {
            setCalibrationError(null);
            setCalibrateOpen(true);
          }}
          onDismiss={() => setCalibrationError(null)}
        />
      )}
    </>
  );
}
