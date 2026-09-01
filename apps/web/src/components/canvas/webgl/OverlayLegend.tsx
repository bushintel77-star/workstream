"use client";

/**
 * Overlay Layers legend — the "what am I looking at" decoder for the Vicmap
 * government-overlay washes. Opens when the LAYERS ribbon tool is armed
 * (activeTool === "layers") and lists each overlay kind present on the site
 * with its scene colour and a per-kind visibility toggle. The scene washes
 * (GovernmentOverlays) read the same store state, so hiding here hides the
 * linework but never deletes the data.
 */
import type { DesignKeylessOverlay } from "@workstream/contracts";
import type { KeylessOverlayKind } from "@workstream/contracts";
import {
  OVERLAY_COLORS,
  OVERLAY_LABELS,
  OVERLAY_ORDER,
  isOverlayVisible,
} from "./overlayMeta";
import { useStudioStore } from "./studioStore";
import styles from "./OverlayLegend.module.css";

export function OverlayLegend({ overlays }: { overlays: DesignKeylessOverlay[] }) {
  const hiddenOverlayKinds = useStudioStore((s) => s.hiddenOverlayKinds);
  const toggleOverlayKind = useStudioStore((s) => s.toggleOverlayKind);

  if (overlays.length === 0) return null;
  const present = new Set<KeylessOverlayKind>(overlays.map((o) => o.kind));
  const kinds = OVERLAY_ORDER.filter((k) => present.has(k));
  if (kinds.length === 0) return null;

  return (
    <div className={styles.legend} data-testid="overlay-legend">
      <div className={styles.header}>Layers</div>
      {kinds.map((kind) => {
        const visible = isOverlayVisible(hiddenOverlayKinds, kind);
        return (
          <button
            key={kind}
            type="button"
            className={styles.row}
            onClick={() => toggleOverlayKind(kind)}
            aria-pressed={visible}
            data-overlay-kind={kind}
          >
            <span
              className={styles.swatch}
              style={{ backgroundColor: OVERLAY_COLORS[kind] }}
            />
            <span className={styles.label}>{OVERLAY_LABELS[kind]}</span>
            <span className={`${styles.tick} ${visible ? styles.tickOn : ""}`} />
          </button>
        );
      })}
    </div>
  );
}
