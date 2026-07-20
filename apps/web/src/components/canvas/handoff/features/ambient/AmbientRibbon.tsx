"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  SURVEY_TOOLS,
  TOOLS,
  type StudioMode,
  type StudioTool,
} from "../../studioCatalog";
import type { LayerKey, LayerOpacity } from "../../state/studioTypes";
import { ATELIER_LINGER_MS } from "../kitInventory/atelierPresence";
import { LOCAL_ARC_SPAN_DEG, LOCAL_ACTION_PX } from "../reach/fittsProximity";
import { playInstrumentTick } from "./instrumentTick";
import css from "./ambientRibbon.module.css";

type LayerChip = {
  key: LayerKey;
  label: string;
  count: number;
};

type Props = {
  tool: StudioTool;
  mode?: StudioMode;
  locked: boolean;
  canUndo: boolean;
  canRedo: boolean;
  layerChips: LayerChip[];
  layerOpacity: LayerOpacity;
  parchmentPeel: number;
  hasAerial: boolean;
  /**
   * Sticky board-% home — pinned on empty canvas margin clicks.
   * Does not follow selection (selection uses the niche carousel).
   */
  anchorXPct: number;
  anchorYPct: number;
  /**
   * Explicit summon from empty margin click (off the lot drawing).
   * Selecting geometry / items must not set this.
   */
  summoned: boolean;
  onDismissSummon?: () => void;
  onTool: (t: StudioTool) => void;
  onMeasure: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (delta: number) => void;
  onFit: () => void;
  onOpacity: (key: LayerKey, value: number) => void;
  onParchmentPeel: (v: number) => void;
};

type Phase = "shadow" | "awake" | "carousel";

type Instrument = {
  id: StudioTool | "measure" | "zoomOut" | "fit" | "zoomIn" | "undo" | "redo";
  label: string;
  icon: string;
  title?: string;
  kind: "draft" | "view" | "history";
};

/**
 * Drawing instruments — summon from empty canvas margin, or the hub.
 * Selecting CAD lines / symbols does not open this toolbar (Figma-style).
 */
export function AmbientRibbon({
  tool,
  mode = "cad",
  locked,
  canUndo,
  canRedo,
  layerChips,
  layerOpacity,
  parchmentPeel,
  hasAerial,
  anchorXPct,
  anchorYPct,
  summoned,
  onDismissSummon,
  onTool,
  onMeasure,
  onUndo,
  onRedo,
  onZoom,
  onFit,
  onOpacity,
  onParchmentPeel,
}: Props) {
  const surveyMode = mode === "survey";
  const rootRef = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lingering, setLingering] = useState(false);

  const clearFade = useCallback(() => {
    if (fadeTimer.current) {
      clearTimeout(fadeTimer.current);
      fadeTimer.current = null;
    }
  }, []);

  const beginLinger = useCallback(() => {
    clearFade();
    setLingering(true);
    fadeTimer.current = setTimeout(() => {
      setLingering(false);
      fadeTimer.current = null;
      onDismissSummon?.();
    }, ATELIER_LINGER_MS);
  }, [clearFade, onDismissSummon]);

  const stayEngaged = useCallback(() => {
    clearFade();
    setLingering(true);
  }, [clearFade]);

  // Fresh margin summon → open and hold, then settle.
  useEffect(() => {
    if (!summoned) return;
    stayEngaged();
    if (!hovered) beginLinger();
    return clearFade;
  }, [summoned, stayEngaged, beginLinger, clearFade, hovered]);

  const open = hovered || lingering || summoned;
  const phase: Phase = open ? "carousel" : "shadow";

  const instruments = useMemo((): Instrument[] => {
    const draft: Instrument[] = TOOLS.filter((t) => t.id !== "reset").map(
      (t) => ({
        id: t.id,
        label: t.label,
        icon: t.icon,
        title: "title" in t && t.title ? t.title : t.label,
        kind: "draft" as const,
      }),
    );
    const survey: Instrument[] = surveyMode
      ? SURVEY_TOOLS.map((t) => ({
          id: t.id,
          label: t.label,
          icon: t.icon,
          title: t.title,
          kind: "draft" as const,
        }))
      : [];
    const rest: Instrument[] = [
      {
        id: "measure",
        label: "Measure",
        icon: "⟋",
        title: "Measure",
        kind: "draft",
      },
      { id: "zoomOut", label: "Out", icon: "−", title: "Zoom out", kind: "view" },
      { id: "fit", label: "Fit", icon: "⛶", title: "Fit outdoor", kind: "view" },
      { id: "zoomIn", label: "In", icon: "+", title: "Zoom in", kind: "view" },
      { id: "undo", label: "Undo", icon: "↩", title: "Undo", kind: "history" },
      { id: "redo", label: "Redo", icon: "↪", title: "Redo", kind: "history" },
    ];
    return [...draft, ...survey, ...rest];
  }, [surveyMode]);

  const draftInstruments = instruments.filter((t) => t.kind === "draft");
  const utilityInstruments = instruments.filter((t) => t.kind !== "draft");

  const activeDraftIdx = Math.max(
    0,
    draftInstruments.findIndex(
      (t) => t.id === tool || (t.id === "lock" && locked && tool === "lock"),
    ),
  );

  const runInstrument = useCallback(
    (id: Instrument["id"]) => {
      playInstrumentTick("arm");
      stayEngaged();
      if (id === "measure") onMeasure();
      else if (id === "zoomOut") onZoom(-0.1);
      else if (id === "zoomIn") onZoom(0.1);
      else if (id === "fit") onFit();
      else if (id === "undo") onUndo();
      else if (id === "redo") onRedo();
      else if (id === tool) {
        // Click active draft tool again → return to pan (same as Esc).
        onTool("pan");
      } else onTool(id as StudioTool);
    },
    [onFit, onMeasure, onRedo, onTool, onUndo, onZoom, stayEngaged, tool],
  );

  const cycleDraft = useCallback(
    (dir: 1 | -1) => {
      if (draftInstruments.length === 0) return;
      const next =
        (activeDraftIdx + dir + draftInstruments.length) %
        draftInstruments.length;
      const pick = draftInstruments[next]!;
      playInstrumentTick("step");
      if (pick.id === "measure") onMeasure();
      else onTool(pick.id as StudioTool);
      stayEngaged();
    },
    [activeDraftIdx, draftInstruments, onMeasure, onTool, stayEngaged],
  );

  const arcAngles = useMemo(() => {
    const n = draftInstruments.length;
    if (n <= 1) return [0];
    const span = LOCAL_ARC_SPAN_DEG;
    const start = -span / 2;
    return draftInstruments.map((_, i) => {
      const base = start + (span * i) / (n - 1);
      const activeAngle = start + (span * activeDraftIdx) / (n - 1);
      return base - activeAngle;
    });
  }, [activeDraftIdx, draftInstruments]);

  const ax = Math.max(10, Math.min(90, anchorXPct));
  const ay = Math.max(12, Math.min(88, anchorYPct));

  return (
    <nav
      ref={rootRef}
      className={css.ribbon}
      data-testid="ambient-ribbon"
      data-phase={phase}
      data-expanded={open ? "true" : "false"}
      data-summoned={summoned ? "true" : "false"}
      aria-label="Drawing instruments"
      style={
        {
          left: `${ax}%`,
          top: `${ay}%`,
          ["--arc-radius" as string]: `${LOCAL_ACTION_PX}px`,
        } as CSSProperties
      }
      onMouseEnter={() => {
        stayEngaged();
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
        beginLinger();
      }}
      onWheel={(e) => {
        if (phase !== "carousel") return;
        if (Math.abs(e.deltaY) < 2) return;
        e.preventDefault();
        cycleDraft(e.deltaY > 0 ? 1 : -1);
      }}
    >
      <button
        type="button"
        className={css.hub}
        data-testid="instrument-hub"
        title="Instruments — or click empty canvas margin to summon"
        aria-label="Open drawing instruments"
        onClick={() => {
          stayEngaged();
          setHovered(true);
          playInstrumentTick("step");
        }}
      >
        ◈
      </button>

      <div className={css.draftWell} data-testid="instrument-carousel">
        {draftInstruments.map((t, i) => {
          const active =
            tool === t.id || (t.id === "lock" && locked && tool === "lock");
          const angle = arcAngles[i] ?? 0;
          return (
            <button
              key={t.id}
              type="button"
              className={`${css.btn}${active ? ` ${css.active}` : ""}`}
              data-testid={
                t.id === "measure"
                  ? "canvas-tool-measure"
                  : `canvas-tool-${t.id}`
              }
              data-kind="draft"
              title={t.title ?? t.label}
              style={
                {
                  ["--arc" as string]: `${angle}deg`,
                  ["--stack" as string]: `${(draftInstruments.length - 1 - i) * 38}px`,
                } as CSSProperties
              }
              onClick={() => runInstrument(t.id)}
            >
              <span className={css.glyph}>{t.icon}</span>
              <span className={css.label}>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className={css.utility}>
        {utilityInstruments.map((t) => {
          const disabled =
            (t.id === "undo" && !canUndo) || (t.id === "redo" && !canRedo);
          return (
            <button
              key={t.id}
              type="button"
              className={css.btn}
              data-kind="utility"
              title={t.title ?? t.label}
              disabled={disabled}
              onClick={() => runInstrument(t.id)}
            >
              <span className={css.glyph}>{t.icon}</span>
              <span className={css.label}>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className={css.layers} data-testid="ambient-layer-chips">
        {hasAerial ? (
          <button
            type="button"
            className={css.chip}
            data-testid="parchment-peel"
            title="Peel parchment underlay"
            onClick={() => {
              const steps = [0.12, 0.28, 0.42, 0.62, 0.85];
              const idx = steps.findIndex(
                (s) => Math.abs(s - parchmentPeel) < 0.05,
              );
              const next = steps[(idx + 1) % steps.length]!;
              playInstrumentTick("step");
              onParchmentPeel(next);
              stayEngaged();
            }}
          >
            <span className={css.chipName}>Peel</span>
            <span className={css.chipCount}>
              {Math.round(parchmentPeel * 100)}
            </span>
          </button>
        ) : null}
        {layerChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className={css.chip}
            title={`${chip.label} · ${Math.round(layerOpacity[chip.key] * 100)}%`}
            onClick={() => {
              const cur = layerOpacity[chip.key];
              const next = cur < 0.35 ? 1 : cur < 0.7 ? 0.3 : 0.55;
              playInstrumentTick("step");
              onOpacity(chip.key, next);
              stayEngaged();
            }}
          >
            <span className={css.chipName}>{chip.label}</span>
            <span className={css.chipCount}>{chip.count}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
