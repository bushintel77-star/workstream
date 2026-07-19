"use client";

import { useMemo } from "react";
import { ptsAttr, type PctPoint } from "../../geometry";
import css from "./tactileGround.module.css";

type Props = {
  /** Board zoom — drives adaptive metric subdivision. */
  zoom?: number;
  /** Metres across the board width (indicative). */
  scaleM?: number;
  /** Soft parchment underlay opacity when aerial is present (0–1). */
  parchmentStrength?: number;
  /** True when satellite/aerial is showing above. */
  hasAerial?: boolean;
  darkOn?: boolean;
  /** Ghost cadastral infill once a site/address is known. */
  boundary?: PctPoint[];
  building?: PctPoint[];
  siteLabel?: string | null;
};

function pickStepM(visibleM: number): number {
  if (visibleM < 35) return 1;
  if (visibleM < 70) return 5;
  if (visibleM < 160) return 10;
  if (visibleM < 320) return 25;
  if (visibleM < 700) return 50;
  return 100;
}

/**
 * Living tactile ground — parchment earth + adaptive metric mesh + true-north rose.
 * Aerial/survey cross-fades above; parchment remains a soft underlay (never a void).
 */
export function TactileGround({
  zoom = 1,
  scaleM = 110,
  parchmentStrength = 1,
  hasAerial = false,
  darkOn = false,
  boundary = [],
  building = [],
  siteLabel = null,
}: Props) {
  const visibleM = scaleM / Math.max(0.4, zoom);
  const stepM = pickStepM(visibleM);
  const stepPct = (stepM / scaleM) * 100;

  const lines = useMemo(() => {
    const major: number[] = [];
    const minor: number[] = [];
    const minorStep = stepPct / 5;
    for (let p = 0; p <= 100 + 0.01; p += stepPct) {
      major.push(Number(p.toFixed(3)));
    }
    if (minorStep > 0.4) {
      for (let p = 0; p <= 100 + 0.01; p += minorStep) {
        const n = Number(p.toFixed(3));
        if (!major.some((m) => Math.abs(m - n) < 0.05)) minor.push(n);
      }
    }
    return { major, minor };
  }, [stepPct]);

  const edgeLabels = useMemo(() => {
    const out: Array<{ pct: number; label: string }> = [];
    let metres = 0;
    for (const pct of lines.major) {
      if (pct > 0 && pct < 100) {
        out.push({ pct, label: `${metres} m` });
      }
      metres += stepM;
    }
    return out;
  }, [lines.major, stepM]);

  const parchmentOp = hasAerial
    ? Math.max(0.12, Math.min(0.45, parchmentStrength * 0.38))
    : Math.max(0.85, parchmentStrength);

  return (
    <div
      className={`${css.ground}${darkOn ? ` ${css.groundDark}` : ""}${hasAerial ? ` ${css.withAerial}` : ""}`}
      data-testid="tactile-ground"
      data-step-m={stepM}
      style={{ ["--parchment-op" as string]: String(parchmentOp) }}
      aria-hidden
    >
      <div className={css.parchment} />
      <div className={css.tooth} />

      <svg className={css.mesh} viewBox="0 0 100 100" preserveAspectRatio="none">
        {lines.minor.map((p) => (
          <g key={`mi${p}`}>
            <line
              x1={p}
              y1={0}
              x2={p}
              y2={100}
              className={css.minor}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={0}
              y1={p}
              x2={100}
              y2={p}
              className={css.minor}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
        {lines.major.map((p) => (
          <g key={`ma${p}`}>
            <line
              x1={p}
              y1={0}
              x2={p}
              y2={100}
              className={css.major}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={0}
              y1={p}
              x2={100}
              y2={p}
              className={css.major}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {boundary.length >= 3 ? (
          <polygon
            points={ptsAttr(boundary)}
            className={css.cadastral}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {building.length >= 3 ? (
          <polygon
            points={ptsAttr(building)}
            className={css.footprint}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>

      <div className={css.edgeScale} data-edge="left">
        {edgeLabels.map((l) => (
          <span key={`L${l.pct}`} style={{ top: `${l.pct}%` }}>
            {l.label}
          </span>
        ))}
      </div>
      <div className={css.edgeScale} data-edge="bottom">
        {edgeLabels.map((l) => (
          <span key={`B${l.pct}`} style={{ left: `${l.pct}%` }}>
            {l.label}
          </span>
        ))}
      </div>

      <div className={css.compass} title="True north">
        <span className={css.compassN}>N</span>
        <span className={css.compassRose} />
      </div>

      {siteLabel ? (
        <p className={css.siteCue}>{siteLabel}</p>
      ) : (
        <p className={css.siteCue}>Parchment ground · indicative metres</p>
      )}
    </div>
  );
}
