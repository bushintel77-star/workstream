"use client";

/**
 * Phase K — NumericSlider: a slider + tap-to-type numeric entry.
 *
 * The spec (§5.3) says "every numeric parameter needs tap-to-type entry.
 * Sliders alone are insufficient for a profession that works to 1:14."
 *
 * This component combines an `<input type="range">` with a small numeric
 * `<input type="number">` that shows the current value. Clicking the
 * number field lets the operator type a precise value; Enter or blur
 * commits it (clamped to min/max). The slider and number stay in sync.
 *
 * Pure DOM chrome — never inside the R3F <Canvas>.
 */

import { useCallback, useEffect, useState } from "react";
import styles from "./NumericSlider.module.css";

export interface NumericSliderProps {
  /** Parameter label (short, uppercase mono per the chrome label convention). */
  label: string;
  /** Minimum value. */
  min: number;
  /** Maximum value. */
  max: number;
  /** Step size for the slider and number input. */
  step: number;
  /** Current value. */
  value: number;
  /** Called when the value changes (via slider drag or numeric entry). */
  onChange: (value: number) => void;
  /** Optional unit suffix (e.g. "px", "s", "m"). Appended to the number display. */
  unit?: string;
  /** Optional title/tooltip for the whole control. */
  title?: string;
  /** Optional test id for the slider container. */
  testId?: string;
  /** Number of decimal places to show in the readout (default: derived from step). */
  decimals?: number;
}

/**
 * Tier-1 slider duality (§2.3): the slider answers arrow keys with `step`
 * (×10 with shift), clamped. Pure so the duality is unit-testable. The
 * handler takes over the arrows entirely so the shift-multiplication is
 * consistent instead of fighting the native range behaviour.
 */
export function steppedValue(
  value: number,
  direction: 1 | -1,
  step: number,
  min: number,
  max: number,
  factor: number,
): number {
  const raw = value + direction * step * factor;
  // Kill float drift (0.1 + 0.2 → 0.30000000000000004) without snapping the
  // value onto the step grid — the current value may legitimately sit
  // between steps (e.g. a nib's 1.5px base on a 0.5 slider).
  const fixed = parseFloat(raw.toFixed(10));
  return Math.max(min, Math.min(max, fixed));
}

export function NumericSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  unit,
  title,
  testId,
  decimals,
}: NumericSliderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  // Derive decimal places from the step if not specified. Uses string
  // parsing to handle steps like 0.25 (2 dp) correctly — log10-based
  // math gives the wrong answer for non-power-of-10 steps.
  const dp =
    decimals ??
    (step < 1
      ? Math.max(0, step.toString().split(".")[1]?.length ?? 0)
      : 0);

  // Clamp + commit a raw numeric string.
  const commit = useCallback(
    (raw: string) => {
      const parsed = parseFloat(raw);
      if (Number.isFinite(parsed)) {
        onChange(Math.max(min, Math.min(max, parsed)));
      }
    },
    [min, max, onChange],
  );

  // When entering edit mode, seed the draft with the current value (no unit).
  const startEdit = useCallback(() => {
    setDraft(value.toFixed(dp));
    setEditing(true);
  }, [value, dp]);

  // When leaving edit mode, commit the draft.
  const endEdit = useCallback(() => {
    commit(draft);
    setEditing(false);
  }, [commit, draft]);

  // Keep the draft in sync while editing (allows mid-typ correction).
  useEffect(() => {
    if (!editing) return;
    setDraft(value.toFixed(dp));
  }, [value, dp, editing]);

  // The number input always receives a pure numeric value (no unit
  // suffix) — `<input type="number">` rejects values like "0.50s".
  // The unit is displayed as a separate span beside the input.
  const inputValue = editing ? draft : value.toFixed(dp);

  return (
    <div className={styles.container} data-testid={testId} title={title}>
      <span className={styles.label}>{label}</span>
      <input
        type="range"
        className={styles.range}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onKeyDown={(e) => {
          const direction =
            e.key === "ArrowRight" || e.key === "ArrowUp"
              ? 1
              : e.key === "ArrowLeft" || e.key === "ArrowDown"
                ? -1
                : 0;
          if (direction === 0) return;
          e.preventDefault();
          onChange(
            steppedValue(value, direction, step, min, max, e.shiftKey ? 10 : 1),
          );
        }}
        aria-label={label}
        title={title ? `${title} — arrow keys step, Shift+arrow ×10` : undefined}
      />
      <input
        type="number"
        className={styles.number}
        min={min}
        max={max}
        step={step}
        value={inputValue}
        onFocus={startEdit}
        onBlur={endEdit}
        onChange={(e) => {
          if (editing) {
            setDraft(e.target.value);
          } else {
            commit(e.target.value);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setEditing(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label={`${label} value`}
        data-testid={testId ? `${testId}-input` : undefined}
      />
      {unit ? <span className={styles.unit}>{unit}</span> : null}
    </div>
  );
}
