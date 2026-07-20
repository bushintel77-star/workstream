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
  /** Board-% anchor — selection, draw cursor, or last work point. */
  anchorXPct: number;
  anchorYPct: number;
  onTool: (t: StudioTool) => void;
  onMeasure: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (delta: number) => void;
  onFit: () => void;
  onOpacity: (key: LayerKey, value: number) => void;
  onParchmentPeel: (v: number) => void;
};

/** Tools that mean “I’m drafting” — ribbon stays armed as a soft arc. */
const DRAFTING: ReadonlySet<string> = new Set([
  "trace",
  "edit",
  "add",
  "paint",
  "zone",
  "measure",
  "calib",
  "level",
  "service",
  "sketch",
]);

const PROX_PCT = 14;
const FADE_MS = 900;

type Phase = "shadow" | "awake" | "carousel" | "armed";

type Instrument = {
  id: StudioTool | "measure" | "zoomOut" | "fit" | "zoomIn" | "undo" | "redo";
  label: string;
  icon: string;
  title?: string;
  kind: "draft" | "view" | "history";
};

/**
 * Context-aware instruments — float on the drawing, not a far-left dock.
 * Shadow hub → awaken near work → half-circle carousel while drafting.
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
  const drafting = DRAFTING.has(tool) || (tool === "lock" && locked);
  const rootRef = useRef<HTMLElement>(null);
  const [proximity, setProximity] = useState(false);
  const [hovered, setHovered] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lingering, setLingering] = useState(false);

  const hot = proximity || hovered || lingering;

  const phase: Phase = useMemo(() => {
    if (hot && drafting) return "carousel";
    if (hot) return "awake";
    if (drafting) return "armed";
    return "shadow";
  }, [hot, drafting]);

  const clearFade = useCallback(() => {
    if (fadeTimer.current) {
      clearTimeout(fadeTimer.current);
      fadeTimer.current = null;
    }
  }, []);

  const scheduleFade = useCallback(() => {
    clearFade();
    setLingering(true);
    fadeTimer.current = setTimeout(() => {
      setLingering(false);
      fadeTimer.current = null;
    }, FADE_MS);
  }, [clearFade]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const board = rootRef.current?.closest(
        "[data-testid='studio-board']",
      ) as HTMLElement | null;
      const el = board ?? rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const px = ((e.clientX - r.left) / r.width) * 100;
      const py = ((e.clientY - r.top) / r.height) * 100;
      const near =
        Math.hypot(px - anchorXPct, py - anchorYPct) <= PROX_PCT;
      setProximity(near);
      if (near) {
        clearFade();
        setLingering(false);
      }
    };
    const onLeave = () => {
      setProximity(false);
      scheduleFade();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      clearFade();
    };
  }, [anchorXPct, anchorYPct, clearFade, scheduleFade]);

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

  const draftInstruments = instruments.filter((i) => i.kind === "draft");
  const utilityInstruments = instruments.filter((i) => i.kind !== "draft");

  const activeDraftIdx = Math.max(
    0,
    draftInstruments.findIndex(
      (i) => i.id === tool || (i.id === "lock" && locked && tool === "lock"),
    ),
  );

  const runInstrument = useCallback(
    (id: Instrument["id"]) => {
      if (id === "measure") {
        playInstrumentTick("arm");
        onMeasure();
        return;
      }
      if (id === "zoomOut") {
        playInstrumentTick("step");
        onZoom(-0.1);
        return;
      }
      if (id === "zoomIn") {
        playInstrumentTick("step");
        onZoom(0.1);
        return;
      }
      if (id === "fit") {
        playInstrumentTick("arm");
        onFit();
        return;
      }
      if (id === "undo") {
        playInstrumentTick("step");
        onUndo();
        return;
      }
      if (id === "redo") {
        playInstrumentTick("step");
        onRedo();
        return;
      }
      playInstrumentTick("arm");
      onTool(id);
    },
    [onFit, onMeasure, onRedo, onTool, onUndo, onZoom],
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
    },
    [activeDraftIdx, draftInstruments, onMeasure, onTool],
  );

  const arcAngles = useMemo(() => {
    const n = draftInstruments.length;
    if (n <= 1) return [0];
    const span = 150;
    const start = -span / 2;
    return draftInstruments.map((_, i) => {
      const base = start + (span * i) / (n - 1);
      const activeAngle = start + (span * activeDraftIdx) / (n - 1);
      return base - activeAngle;
    });
  }, [activeDraftIdx, draftInstruments]);

  const ax = Math.max(12, Math.min(88, anchorXPct));
  const ay = Math.max(14, Math.min(86, anchorYPct));

  return (
    <nav
      ref={rootRef}
      className={css.ribbon}
      data-testid="ambient-ribbon"
      data-phase={phase}
      data-expanded={hot ? "true" : "false"}
      aria-label="Drawing instruments"
      style={
        {
          left: `${ax}%`,
          top: `${ay}%`,
        } as CSSProperties
      }
      onMouseEnter={() => {
        clearFade();
        setHovered(true);
        setLingering(false);
      }}
      onMouseLeave={() => {
        setHovered(false);
        scheduleFade();
      }}
      onWheel={(e) => {
        if (phase !== "carousel" && phase !== "awake") return;
        if (Math.abs(e.deltaY) < 2) return;
        e.preventDefault();
        cycleDraft(e.deltaY > 0 ? 1 : -1);
      }}
    >
      <button
        type="button"
        className={css.hub}
        data-testid="instrument-hub"
        title="Instruments"
        aria-label="Open drawing instruments"
        onClick={() => {
          clearFade();
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
