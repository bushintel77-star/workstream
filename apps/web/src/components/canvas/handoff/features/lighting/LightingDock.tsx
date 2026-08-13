"use client";

import type { CSSProperties } from "react";
import type { LvCircuitAssessment, LvWireGauge } from "@workstream/domain";
import { CameraChrome } from "../../CameraChrome";
import css from "./lighting.module.css";

type Props = {
  assessment: LvCircuitAssessment;
  kelvin: number;
  onKelvin: (k: number) => void;
  wireGauge: LvWireGauge;
  onWireGauge: (g: LvWireGauge) => void;
  transformerVa: number;
  onTransformerVa: (va: number) => void;
  onUpgradeTransformer: () => void;
  onSplitHint: () => void;
  onClose: () => void;
  /** When set, links out to the standalone 3D subsurface studio. */
  projectId?: string;
};

/**
 * Low-voltage lighting workspace — capacity ring, Kelvin, gauge.
 * Overload: pulse + upgrade/split actions — never a modal.
 */
export function LightingDock({
  assessment,
  kelvin,
  onKelvin,
  wireGauge,
  onWireGauge,
  transformerVa,
  onTransformerVa,
  onUpgradeTransformer,
  onSplitHint,
  onClose,
  projectId,
}: Props) {
  const pct = Math.min(1.35, Math.max(0, assessment.loadFraction));
  const ringDeg = Math.round(pct * 360);
  const overload = assessment.overloaded;

  return (
    <CameraChrome place={{ kind: "dock" }} zIndex={46} testId="lighting-workspace-chrome">
      <aside
        className={css.dock}
        data-testid="lighting-workspace-dock"
        data-overloaded={overload ? "1" : "0"}
      >
        <div className={css.head}>
          <p className={css.kicker}>Lighting</p>
          <button
            type="button"
            className={css.close}
            data-testid="lighting-workspace-close"
            aria-label="Close lighting workspace"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className={css.ringRow}>
          <div
            className={css.ring}
            data-testid="lighting-capacity-ring"
            data-overloaded={overload ? "1" : "0"}
            style={
              {
                "--ring-deg": `${ringDeg}deg`,
              } as CSSProperties
            }
            role="img"
            aria-label={`${Math.round(assessment.loadFraction * 100)} percent of transformer capacity`}
          >
            <span className={css.ringCore}>
              {Math.round(assessment.loadFraction * 100)}%
            </span>
          </div>
          <div className={css.ringMeta}>
            <p className={css.metaLine}>
              {Math.round(assessment.designLoadW)} W design
              <span className={css.metaMuted}>
                {" "}
                · {assessment.fixtureCount} fixtures
              </span>
            </p>
            <p className={css.metaLine}>
              {transformerVa} VA · 80% = {Math.round(assessment.capacityW)} W
            </p>
            <p className={css.tip} data-warn={overload || assessment.dropWarn ? "1" : "0"}>
              {assessment.tip}
            </p>
          </div>
        </div>

        {overload ? (
          <div className={css.actions} data-testid="lighting-overload-actions">
            <button
              type="button"
              className={css.actionPrimary}
              data-testid="lighting-upgrade-tx"
              onClick={onUpgradeTransformer}
            >
              Upgrade transformer
            </button>
            <button
              type="button"
              className={css.actionGhost}
              data-testid="lighting-split-circuit"
              onClick={onSplitHint}
            >
              Split circuit
            </button>
          </div>
        ) : null}

        <div className={css.row}>
          <label className={css.label} htmlFor="lv-kelvin">
            Kelvin
          </label>
          <input
            id="lv-kelvin"
            className={css.range}
            type="range"
            min={2200}
            max={4000}
            step={100}
            value={kelvin}
            data-testid="lighting-kelvin"
            onChange={(e) => onKelvin(Number(e.target.value))}
          />
          <span className={css.mono}>{kelvin}K</span>
        </div>

        <div className={css.row}>
          <p className={css.label}>Cable</p>
          <div className={css.chipRow} role="radiogroup" aria-label="Wire gauge">
            {(["12/2", "14/2"] as const).map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                className={css.chip}
                data-on={wireGauge === g ? "1" : "0"}
                data-testid={`lighting-gauge-${g.replace("/", "")}`}
                aria-checked={wireGauge === g}
                onClick={() => onWireGauge(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className={css.row}>
          <p className={css.label}>Transformer</p>
          <div className={css.chipRow} role="radiogroup" aria-label="Transformer VA">
            {[150, 200, 300, 600].map((va) => (
              <button
                key={va}
                type="button"
                role="radio"
                className={css.chip}
                data-on={transformerVa === va ? "1" : "0"}
                data-testid={`lighting-tx-${va}`}
                aria-checked={transformerVa === va}
                onClick={() => onTransformerVa(va)}
              >
                {va} VA
              </button>
            ))}
          </div>
        </div>

        <p className={css.foot}>
          Drop {assessment.voltageDropPct.toFixed(1)}% over{" "}
          {assessment.runLengthM.toFixed(1)} m · confirm with electrician
        </p>
        {projectId ? (
          <a
            className={css.studioLink}
            href={`/subsurface-studio/${projectId}`}
            data-testid="open-subsurface-studio"
          >
            Open 3D subsurface studio ↗
          </a>
        ) : null}
      </aside>
    </CameraChrome>
  );
}
