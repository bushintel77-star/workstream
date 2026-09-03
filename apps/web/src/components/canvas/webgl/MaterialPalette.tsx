"use client";

/**
 * Phase M.1 — Material palette picker for the ToolFlyout.
 *
 * 21 named materials, grouped (Softscape / Hardscape / Soil / Markup),
 * 22px swatches, no colour wheel. Active swatch carries the spec's ring
 * (0 0 0 2px panel bg, 0 0 0 3.6px ink). A build-up ramp shows the selected
 * material at 0.22 / 0.42 / 0.62 / 0.82 / 1.0 alpha — the five layers the
 * multiply nib produces.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase M.1.
 * Reference: README §7.1.
 */

import { useStudioStore } from "./studioStore";
import {
  MATERIALS,
  MATERIAL_GROUPS,
  BUILD_UP_RAMP,
  materialsByGroup,
  type MaterialEntry,
} from "./materials";
import styles from "./ToolFlyout.module.css";

export function MaterialPalette() {
  const activeMaterialId = useStudioStore((s) => s.activeMaterialId);
  const setActiveMaterialId = useStudioStore((s) => s.setActiveMaterialId);
  const active = activeMaterialId
    ? MATERIALS.find((m) => m.id === activeMaterialId)
    : undefined;

  return (
    <div className={styles.section} data-testid="material-palette">
      <div className={styles.header}>
        <span className={styles.headerTitle}>Materials</span>
      </div>
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
