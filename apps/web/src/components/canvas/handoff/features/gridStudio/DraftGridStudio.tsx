"use client";

import { useEffect, useRef, useState } from "react";
import type { GridGrain } from "../../geometry/snap";
import {
  GRID_FORMATIONS,
  GRID_FORMATION_LABEL,
  GRID_GRAINS,
  GRID_INK_LABEL,
  GRID_INK_STROKE,
  GRID_INKS,
  nextInRing,
  type GridFormation,
  type GridInk,
} from "../../geometry/gridStudio";
import { playInstrumentTick } from "../ambient/instrumentTick";
import css from "./draftGridStudio.module.css";

type Props = {
  /** Board-% — sits near the work, not a screen corner. */
  anchorXPct: number;
  anchorYPct: number;
  formation: GridFormation;
  ink: GridInk;
  grain: GridGrain;
  snap: boolean;
  /** Live preview while hovering the formation face (does not commit). */
  onPreviewFormation: (f: GridFormation | null) => void;
  onPreviewInk: (ink: GridInk | null) => void;
  onCommit: (patch: {
    formation?: GridFormation;
    ink?: GridInk;
    grain?: GridGrain;
    snap?: boolean;
  }) => void;
};

/**
 * Micro grid studio — shadow glyph that awakens on hover.
 * Formation face auto-cycles on dwell; click commits. Ink / grain / snap
 * are one-tap cycles. Top-tier: tiny, opaque when idle, alive on demand.
 */
export function DraftGridStudio({
  anchorXPct,
  anchorYPct,
  formation,
  ink,
  grain,
  snap,
  onPreviewFormation,
  onPreviewInk,
  onCommit,
}: Props) {
  const [awake, setAwake] = useState(false);
  const [previewF, setPreviewF] = useState<GridFormation | null>(null);
  const [previewI, setPreviewI] = useState<GridInk | null>(null);
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceHot = useRef(false);

  const shownF = previewF ?? formation;
  const shownI = previewI ?? ink;

  useEffect(() => {
    return () => {
      if (cycleRef.current) clearInterval(cycleRef.current);
      onPreviewFormation(null);
      onPreviewInk(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCycle = () => {
    if (cycleRef.current) {
      clearInterval(cycleRef.current);
      cycleRef.current = null;
    }
  };

  const startFormationCycle = () => {
    faceHot.current = true;
    stopCycle();
    let cur = formation;
    cycleRef.current = setInterval(() => {
      if (!faceHot.current) return;
      cur = nextInRing(GRID_FORMATIONS, cur);
      setPreviewF(cur);
      onPreviewFormation(cur);
      playInstrumentTick("step");
    }, 700);
  };

  const leaveFormationFace = () => {
    faceHot.current = false;
    stopCycle();
    setPreviewF(null);
    onPreviewFormation(null);
  };

  const ax = Math.max(14, Math.min(86, anchorXPct));
  const ay = Math.max(18, Math.min(88, anchorYPct + 16));

  return (
    <div
      className={css.root}
      data-testid="draft-grid-studio"
      data-awake={awake ? "true" : "false"}
      data-formation={shownF}
      data-ink={shownI}
      style={{ left: `${ax}%`, top: `${ay}%` }}
      onMouseEnter={() => setAwake(true)}
      onMouseLeave={() => {
        setAwake(false);
        leaveFormationFace();
        setPreviewI(null);
        onPreviewInk(null);
      }}
    >
      <button
        type="button"
        className={css.face}
        data-testid="grid-formation-face"
        title={`${GRID_FORMATION_LABEL[shownF]} · hover to skim · click to keep`}
        aria-label={`Grid formation ${shownF}`}
        onMouseEnter={startFormationCycle}
        onMouseLeave={leaveFormationFace}
        onClick={() => {
          const next = previewF ?? nextInRing(GRID_FORMATIONS, formation);
          stopCycle();
          faceHot.current = false;
          setPreviewF(null);
          onPreviewFormation(null);
          playInstrumentTick("arm");
          onCommit({ formation: next, snap: true });
        }}
      >
        <FormationGlyph formation={shownF} ink={shownI} />
      </button>

      <div className={css.tray} aria-hidden={!awake}>
        <button
          type="button"
          className={css.ink}
          data-testid="grid-ink-cycle"
          title={`${GRID_INK_LABEL[shownI]} · click next ink`}
          aria-label={`Grid ink ${shownI}`}
          style={{ ["--ink" as string]: GRID_INK_STROKE[shownI] }}
          onMouseEnter={() => {
            const n = nextInRing(GRID_INKS, ink);
            setPreviewI(n);
            onPreviewInk(n);
          }}
          onMouseLeave={() => {
            setPreviewI(null);
            onPreviewInk(null);
          }}
          onClick={() => {
            const next = previewI ?? nextInRing(GRID_INKS, ink);
            setPreviewI(null);
            onPreviewInk(null);
            playInstrumentTick("step");
            onCommit({ ink: next });
          }}
        />
        <button
          type="button"
          className={css.grain}
          data-testid="grid-grain-cycle"
          title={`Grain ${grain} · click to step fine → med → coarse`}
          aria-label={`Grid grain ${grain}`}
          data-grain={grain}
          onClick={() => {
            const next = nextInRing(GRID_GRAINS, grain);
            playInstrumentTick("step");
            onCommit({ grain: next, snap: true });
          }}
        >
          {grain === "fine" ? "·" : grain === "medium" ? ":" : "∷"}
        </button>
        <button
          type="button"
          className={`${css.snap}${snap ? ` ${css.snapOn}` : ""}`}
          data-testid="draft-snap-toggle"
          title={snap ? "Snap on" : "Free — no magnet"}
          aria-label={snap ? "Snap on" : "Snap off"}
          onClick={() => {
            playInstrumentTick("step");
            onCommit({ snap: !snap });
          }}
        >
          {snap ? "⊕" : "○"}
        </button>
      </div>
    </div>
  );
}

/** Face preview strokes on blush frost glass (canvas mesh keeps GRID_INK_STROKE). */
const CONTROL_STROKE: Record<GridInk, string> = {
  charcoal: "rgba(36, 19, 24, 0.72)",
  slate: "rgba(122, 85, 96, 0.78)",
  paper: "rgba(176, 138, 149, 0.55)",
  mist: "rgba(176, 138, 149, 0.4)",
  signal: "rgba(194, 69, 95, 0.85)",
};

function FormationGlyph({
  formation,
  ink,
}: {
  formation: GridFormation;
  ink: GridInk;
}) {
  const stroke = CONTROL_STROKE[ink] ?? GRID_INK_STROKE[ink];
  return (
    <svg className={css.glyph} viewBox="0 0 20 20" aria-hidden>
      {formation === "ortho" || formation === "veil" ? (
        <>
          {[5, 10, 15].map((v) => (
            <g key={v} opacity={formation === "veil" ? 0.45 : 1}>
              <line x1={v} y1={3} x2={v} y2={17} stroke={stroke} strokeWidth={0.9} />
              <line x1={3} y1={v} x2={17} y2={v} stroke={stroke} strokeWidth={0.9} />
            </g>
          ))}
        </>
      ) : null}
      {formation === "dots" ? (
        <>
          {[5, 10, 15].flatMap((x) =>
            [5, 10, 15].map((y) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} fill={stroke} />
            )),
          )}
        </>
      ) : null}
      {formation === "diamond" ? (
        <g transform="translate(10 10) rotate(45)">
          {[-5, 0, 5].map((v) => (
            <g key={v}>
              <line
                x1={v}
                y1={-8}
                x2={v}
                y2={8}
                stroke={stroke}
                strokeWidth={0.9}
              />
              <line
                x1={-8}
                y1={v}
                x2={8}
                y2={v}
                stroke={stroke}
                strokeWidth={0.9}
              />
            </g>
          ))}
        </g>
      ) : null}
    </svg>
  );
}
