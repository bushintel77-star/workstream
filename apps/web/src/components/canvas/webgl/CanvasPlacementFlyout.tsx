"use client";

/**
 * Spatial Sketching — Canvas Placement Flyout (Mental Canvas roadmap,
 * Phase A1).
 *
 * Replaces the depth rail's old bare "+" button (which stamped an unnamed
 * flat plane at the next stacked height, no orientation choice — see
 * docs/MENTAL-CANVAS-ROADMAP.md Phase A). Blooms off the rail's `+` cell,
 * following the same "bloom a panel off an anchor" idiom as ToolFlyout.tsx,
 * but as its own component: ToolFlyout is hardcoded to the tool ribbon's
 * DOM/handedness, not a clean fit for the depth rail's opposite-edge layout
 * (confirmed by this session's research before writing this file).
 *
 * Required naming (§14b "naming is required on create") + the five spec
 * presets + a numeric height/bearing field (spec's own flagged requirement:
 * "every flyout parameter needs tap-to-type entry"). Placing arms the
 * Parallel/Hinge Projection handle (ParallelProjectionHandle.tsx /
 * HingeProjectionGizmo.tsx, A1/A2) on the new plane so the operator can
 * immediately fine-tune by dragging.
 */

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { SketchCanvas } from "@workstream/contracts";
import {
  CANVAS_PRESETS,
  poseForPreset,
  computePlanePose,
  type PlaneOrientation,
  type CanvasPreset,
} from "./canvasPlacement";
import { useStudioStore } from "./studioStore";
import styles from "./CanvasPlacementFlyout.module.css";

const EDGE_MARGIN_PX = 20;

export interface CanvasPlacementFlyoutProps {
  open: boolean;
  onClose: () => void;
  /** Height (m) to offer as the default for a fresh flat plane — the rail's
   *  existing next-stacked-height logic, reused so manual placement still
   *  avoids colliding with existing planes. */
  defaultHeightM: number;
}

export function CanvasPlacementFlyout({
  open,
  onClose,
  defaultHeightM,
}: CanvasPlacementFlyoutProps) {
  const addSketchCanvas = useStudioStore((s) => s.addSketchCanvas);
  const setAdjustingCanvasId = useStudioStore((s) => s.setAdjustingCanvasId);

  const panelRef = useRef<HTMLDivElement>(null);
  const [topPx, setTopPx] = useState<number | null>(null);
  const [sidePx, setSidePx] = useState<{ side: "left" | "right"; px: number } | null>(null);

  const [name, setName] = useState("");
  const [orientation, setOrientation] = useState<PlaneOrientation>("flat");
  const [value, setValue] = useState(defaultHeightM);
  const [bearing, setBearing] = useState(0);

  useLayoutEffect(() => {
    if (!open) return;
    setName("");
    setOrientation("flat");
    setValue(defaultHeightM);
    setBearing(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on open only
  }, [open]);

  // Anchor to the rail's "+" cell — measure viewport position (like
  // ToolFlyout's tile-tracking fix) rather than hardcoding handedness, so
  // this works regardless of which edge the depth rail currently sits on.
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = document.querySelector<HTMLElement>(
      '[data-testid="canvas-add-cell"]',
    );
    const panel = panelRef.current;
    if (!anchor || !panel) {
      setTopPx(null);
      return;
    }
    const anchorRect = anchor.getBoundingClientRect();
    const panelHeight = panel.getBoundingClientRect().height;
    const halfHeight = panelHeight / 2;
    const min = EDGE_MARGIN_PX + halfHeight;
    const max = window.innerHeight - EDGE_MARGIN_PX - halfHeight;
    const anchorCenter = anchorRect.top + anchorRect.height / 2;
    setTopPx(Math.min(Math.max(anchorCenter, min), max));

    // Bloom toward screen centre, away from whichever edge the rail sits
    // on — measured from the anchor's real rect rather than guessed from a
    // CSS width variable, so this stays correct regardless of the rail's
    // actual rendered width.
    const gap = 10;
    if (anchorRect.left > window.innerWidth / 2) {
      setSidePx({ side: "left", px: window.innerWidth - anchorRect.left + gap });
    } else {
      setSidePx({ side: "right", px: anchorRect.right + gap });
    }
  }, [open, orientation]);

  if (!open) return null;

  function applyPreset(preset: CanvasPreset) {
    setOrientation(preset.orientation);
    setValue(preset.heightM);
    setBearing(preset.bearingDeg ?? 0);
    if (!name.trim()) setName(preset.label);
  }

  function place() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const preset = CANVAS_PRESETS.find(
      (p) => p.orientation === orientation && p.heightM === value && (p.bearingDeg ?? 0) === bearing,
    );
    const pose = preset
      ? poseForPreset(preset)
      : computePlanePose(orientation, value, bearing);
    const canvas: SketchCanvas = {
      id: crypto.randomUUID(),
      position: pose.position,
      rotation: pose.rotation,
      label: trimmed,
      season_tag: "ALL",
    };
    addSketchCanvas(canvas);
    setAdjustingCanvasId(canvas.id);
    onClose();
  }

  const canPlace = name.trim().length > 0;
  const side = sidePx?.side ?? "right";

  return (
    <div
      ref={panelRef}
      className={`${styles.flyout} ${side === "left" ? styles.flyoutLeft : styles.flyoutRight}`}
      style={
        {
          ...(topPx != null ? { top: topPx } : {}),
          ...(sidePx ? { [sidePx.side]: sidePx.px } : {}),
        } as CSSProperties
      }
      data-testid="canvas-placement-flyout"
      role="dialog"
      aria-label="Place a sketch canvas"
    >
      <span className={`${styles.arrow} ${side === "left" ? styles.arrowLeft : styles.arrowRight}`} />

      <div className={styles.header}>
        <span className={styles.headerTitle}>New plane</span>
      </div>

      <div className={styles.section}>
        <label className={styles.fieldLabel} htmlFor="canvas-placement-name">
          Name
        </label>
        <input
          id="canvas-placement-name"
          className={styles.textInput}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Boundary wall — north"
          autoFocus
          data-testid="canvas-placement-name-input"
        />
      </div>

      <div className={styles.section}>
        <span className={styles.fieldLabel}>Presets</span>
        <div className={styles.presetGrid}>
          {CANVAS_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={styles.preset}
              onClick={() => applyPreset(preset)}
              data-testid={`canvas-preset-${preset.id}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.fieldLabel}>Orientation</span>
        <div className={styles.orientationToggle}>
          <button
            className={`${styles.orientationButton} ${orientation === "flat" ? styles.orientationActive : ""}`}
            onClick={() => setOrientation("flat")}
            data-testid="canvas-orientation-flat"
          >
            Lay flat
          </button>
          <button
            className={`${styles.orientationButton} ${orientation === "standing" ? styles.orientationActive : ""}`}
            onClick={() => setOrientation("standing")}
            data-testid="canvas-orientation-standing"
          >
            Stand up
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <label className={styles.fieldLabel} htmlFor="canvas-placement-value">
          {orientation === "flat" ? "Height (m)" : "Base height (m)"}
        </label>
        <input
          id="canvas-placement-value"
          className={styles.numberInput}
          type="number"
          step={0.1}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          data-testid="canvas-placement-value-input"
        />
        {orientation === "standing" && (
          <>
            <label className={styles.fieldLabel} htmlFor="canvas-placement-bearing">
              Bearing (°)
            </label>
            <input
              id="canvas-placement-bearing"
              className={styles.numberInput}
              type="number"
              step={1}
              min={0}
              max={359}
              value={bearing}
              onChange={(e) => setBearing(Number(e.target.value))}
              data-testid="canvas-placement-bearing-input"
            />
          </>
        )}
      </div>

      <button
        className={styles.placeButton}
        onClick={place}
        disabled={!canPlace}
        data-testid="canvas-placement-place"
      >
        Place
      </button>
    </div>
  );
}
