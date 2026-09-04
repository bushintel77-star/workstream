"use client";

/**
 * Tier-1 widget standard — Widget B: Colour Palette.
 *
 * The material palette as its own ribbon-anchored widget (anchored to the
 * colour-well tile, NOT to a draw tool — colour changes more often than
 * nibs, and the well previews state so this panel can stay closed):
 *
 *   - grouped swatches (softscape / hardscape / soil-water / markup — the
 *     21-material canon is unchanged),
 *   - a RECENT row: the last materials used this session, most recent
 *     first (studioStore.recentMaterialIds, max 6),
 *   - the active well with previous-swap on click (or the X key):
 *     clicking the well swaps current ↔ previous material,
 *   - contrast honesty: the well shows the active material's WCAG contrast
 *     ratio against the live canvas ground (materialContrast.ts — the same
 *     claim the ink-contrast token test enforces, surfaced as a number).
 *
 * Extracted from MaterialPalette.tsx (itself from the Phase M palette in
 * ToolFlyout); binding: docs/MENTAL-CANVAS-ROADMAP.md Phase M.1, README §7.1.
 */

import type { CSSProperties } from "react";
import { useStudioStore } from "./studioStore";
import {
  MATERIALS,
  MATERIAL_GROUPS,
  BUILD_UP_RAMP,
  materialById,
  materialsByGroup,
  type MaterialEntry,
} from "./materials";
import {
  canvasGroundColor,
  contrastReadout,
} from "./materialContrast";
import { FLYOUT_COLUMN_STEP_PX, useFlyoutAnchor } from "./useFlyoutAnchor";
import styles from "./ToolFlyout.module.css";

export interface PaletteWidgetProps {
  /**
   * Column tier. When the active tool's own flyout is also open, the palette
   * blooms in a SECOND column one panel further from the ribbon, so two open
   * widgets compose into a row instead of painting over each other (the
   * collision gate measures exactly this both-open state).
   */
  tier?: number;
}

export function PaletteWidget({ tier = 0 }: PaletteWidgetProps) {
  const recentMaterialIds = useStudioStore((s) => s.recentMaterialIds);
  const previousMaterialId = useStudioStore((s) => s.previousMaterialId);
  const swapActiveMaterial = useStudioStore((s) => s.swapActiveMaterial);
  const { panelRef, topPx, leftPx, rightPx, ribbonOnLeft } = useFlyoutAnchor(
    "colour-well",
    // Stable identity: the effect re-measures when content shape actually
    // changes (recents appear/disappear, swap arms), not on every render.
    `${recentMaterialIds.length}:${previousMaterialId ?? "-"}`,
  );
  const activeMaterialId = useStudioStore((s) => s.activeMaterialId);
  const setActiveMaterialId = useStudioStore((s) => s.setActiveMaterialId);
  const tierShift = tier * FLYOUT_COLUMN_STEP_PX;
  const active = activeMaterialId
    ? MATERIALS.find((m) => m.id === activeMaterialId)
    : undefined;
  const previous = previousMaterialId
    ? materialById(previousMaterialId)
    : undefined;
  const ground = canvasGroundColor(
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement)
      : undefined,
  );

  return (
    <div
      ref={panelRef}
      className={styles.flyout}
      style={
        {
          ...(topPx != null ? { top: topPx } : {}),
          ...(ribbonOnLeft
            ? { left: leftPx != null ? leftPx + tierShift : undefined }
            : { right: rightPx != null ? rightPx + tierShift : undefined }),
        } as CSSProperties
      }
      data-testid="palette-widget"
    >
      <span
        className={`${styles.arrow} ${ribbonOnLeft ? styles.arrowLeft : styles.arrowRight}`}
      />
      <div className={styles.header}>
        <span className={styles.headerTitle}>Palette</span>
        {previous ? <span className={styles.headerHint}>X swaps</span> : null}
      </div>

      {/* Active well — the current material, its name, its contrast against
          the canvas ground, and the previous-swap. Click = swap. */}
      <button
        className={styles.activeWell}
        data-testid="palette-swap"
        data-can-swap={previous ? "true" : undefined}
        onClick={() => previous && swapActiveMaterial()}
        disabled={!previous}
        title={
          previous
            ? `Swap to previous: ${previous.label} (X)`
            : "The previous material appears here once you have used two"
        }
      >
        <span
          className={styles.activeWellColor}
          style={{ background: active?.color ?? "transparent" }}
        />
        <span className={styles.activeWellMeta}>
          <span className={styles.activeWellLabel}>
            {active?.label ?? "Nib colour"}
          </span>
          {active ? (
            <span
              className={styles.activeWellContrast}
              data-testid="contrast-readout"
              title={`Contrast against the canvas ground — the ink-contrast law, as a number`}
            >
              {contrastReadout(active.color, ground)}
            </span>
          ) : null}
        </span>
      </button>

      {/* Recent row — session-scoped, most recent first. */}
      {recentMaterialIds.length > 0 && (
        <div className={styles.materialGroup}>
          <div className={styles.materialGroupLabel}>Recent</div>
          <div className={styles.swatchGrid} data-testid="recent-row">
            {recentMaterialIds.map((id) => {
              const m = materialById(id);
              if (!m) return null;
              return (
                <Swatch
                  key={id}
                  material={m}
                  active={activeMaterialId === m.id}
                  onClick={() => setActiveMaterialId(m.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {MATERIAL_GROUPS.map((group) => (
        <div key={group.id} className={styles.materialGroup}>
          <div className={styles.materialGroupLabel}>{group.label}</div>
          <div className={styles.swatchGrid}>
            {materialsByGroup(group.id).map((m) => (
              <Swatch
                key={m.id}
                material={m}
                active={activeMaterialId === m.id}
                onClick={() => setActiveMaterialId(m.id)}
              />
            ))}
          </div>
        </div>
      ))}
      {/* Build-up ramp — the five alpha layers the multiply nib produces */}
      {active && (
        <div className={styles.buildUpRamp} data-testid="build-up-ramp">
          {BUILD_UP_RAMP.map((alpha) => (
            <div
              key={alpha}
              className={styles.rampSwatch}
              style={{
                background: active.color,
                opacity: alpha,
              }}
              title={`alpha ${alpha.toFixed(2)}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Swatch({
  material,
  active,
  onClick,
}: {
  material: MaterialEntry;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`${styles.swatch} ${active ? styles.swatchActive : ""}`}
      data-material-id={material.id}
      data-active={active}
      data-semantic={material.semantic ? "true" : undefined}
      onClick={onClick}
      title={`${material.label}${material.dash ? " (dash signature)" : ""}`}
    >
      <span
        className={styles.swatchColor}
        style={{ background: material.color }}
      />
    </button>
  );
}
