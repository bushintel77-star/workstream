"use client";

import { useMemo } from "react";
import {
  boardScaleM,
  pickMetricStepM,
  resolveGroundPhase,
  visibleMetres,
  type SheetScaleDenom,
} from "./groundMetrics";
import css from "./tactileGround.module.css";

type Props = {
  zoom?: number;
  sheetScaleDenom?: SheetScaleDenom;
  /** 0–1 peel when aerial present; higher = more parchment tooth. */
  parchmentPeel?: number;
  hasAerial?: boolean;
  darkOn?: boolean;
  /** Stage 1 — Vicmap title board phase. */
  foundationCleanse?: boolean;
  /** Authoritative Vicmap / locked title — never say "ghost cadastral". */
  titleLocked?: boolean;
  boundarySource?: "vicmap" | "manual" | "seed";
  siteLabel?: string | null;
  address?: string | null;
  /** CadPlan owns the street cue in title mode. */
  suppressSiteCue?: boolean;
  /**
   * Fit sheet / quiet plate — hide compass, scale chip, and edge ticks
   * (Fit overlay owns N + scale).
   */
  quietChrome?: boolean;
  /** Edge labels are normally owned by the fixed sibling ruler overlay. */
  showEdgeLabels?: boolean;
};

/**
 * Living tactile ground — parchment earth + adaptive metric mesh + true-north rose.
 * CadPlanBoard owns boundary/building vectors; this layer never paints them.
 * Aerial imagery (when allowed) stacks above via AerialSlot.
 */
export function TactileGround({
  zoom = 1,
  sheetScaleDenom = 100,
  parchmentPeel = 0.42,
  hasAerial = false,
  darkOn = false,
  foundationCleanse = false,
  titleLocked = false,
  boundarySource = "seed",
  siteLabel = null,
  address = null,
  suppressSiteCue = false,
  quietChrome = false,
  showEdgeLabels = true,
}: Props) {
  const scaleM = boardScaleM(sheetScaleDenom);
  const visibleM = visibleMetres(sheetScaleDenom, zoom);
  const stepM = pickMetricStepM(visibleM);
  const stepPct = (stepM / scaleM) * 100;
  const phase = foundationCleanse
    ? "cadastral"
    : resolveGroundPhase({
        hasAerial,
        hasBoundary: false,
        address: address ?? siteLabel,
      });

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

  // Soft topo-ish contours — generative context, not survey contours.
  const topo = useMemo(() => {
    if (foundationCleanse || phase === "parchment") return [] as number[];
    return [18, 32, 48, 64, 78];
  }, [foundationCleanse, phase]);

  const parchmentOp = foundationCleanse
    ? 1
    : phase === "aerial"
      ? Math.max(0.1, Math.min(0.55, parchmentPeel))
      : phase === "cadastral"
        ? 0.92
        : 1;

  const vicmapCue =
    titleLocked || foundationCleanse || boundarySource === "vicmap";

  // CadPlan owns street cue in title mode; ground cue only for plain parchment.
  const cue =
    suppressSiteCue || foundationCleanse || phase === "aerial"
      ? null
      : vicmapCue
        ? null
        : phase === "cadastral"
          ? `${siteLabel ?? address ?? "Site"} · indicative metres`
          : "Parchment ground · indicative metres";

  return (
    <div
      className={`${css.ground}${darkOn ? ` ${css.groundDark}` : ""}${foundationCleanse ? ` ${css.phase_foundation}` : ""}${!foundationCleanse && phase === "aerial" ? ` ${css.phase_aerial}` : ""}${!foundationCleanse && phase === "cadastral" ? ` ${css.phase_cadastral}` : ""}${!foundationCleanse && phase === "parchment" ? ` ${css.phase_parchment}` : ""}`}
      data-testid="tactile-ground"
      data-phase={foundationCleanse ? "foundation-cad" : phase}
      data-step-m={stepM}
      style={{ ["--parchment-op" as string]: String(parchmentOp) }}
      aria-hidden
    >
      <div className={css.parchment} />
      {!foundationCleanse ? <div className={css.tooth} /> : null}

      <svg className={css.mesh} viewBox="0 0 100 100" preserveAspectRatio="none">
        {topo.map((r) => (
          <ellipse
            key={`topo${r}`}
            cx={50}
            cy={52}
            rx={r * 0.55}
            ry={r * 0.42}
            className={css.topo}
            vectorEffect="non-scaling-stroke"
          />
        ))}

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
      </svg>

      {!quietChrome ? (
        <>
          {showEdgeLabels ? (
            <>
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
            </>
          ) : null}
          <div className={css.compass} title="True north">
            <span className={css.compassN}>N</span>
            <span className={css.compassRose} />
          </div>
          {cue ? <p className={css.siteCue}>{cue}</p> : null}
          <p className={css.scaleChip} data-testid="ground-metric-step">
            {stepM} m · 1:{sheetScaleDenom}
          </p>
        </>
      ) : null}
    </div>
  );
}
