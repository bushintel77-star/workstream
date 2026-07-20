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
  /** Kept for API compat — layer inventory is the Layers panel, not this dock. */
  layerChips: LayerChip[];
  layerOpacity: LayerOpacity;
  parchmentPeel: number;
  hasAerial: boolean;
  anchorXPct: number;
  anchorYPct: number;
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

const SLOT_PX = 40;

/**
 * Drawing instruments — clean vertical draft stack + east utilities.
 * Layer chips live in the Layers panel (structure rail), not piled here.
 */
export function AmbientRibbon({
  tool,
  mode = "cad",
  locked,
  canUndo,
  canRedo,
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

  const ax = Math.max(10, Math.min(90, anchorXPct));
  const ay = Math.max(12, Math.min(88, anchorYPct));

  /* Disappearing UI — no sticky hub; instruments exist only when summoned. */
  if (!summoned) return null;

  return (
    <nav
      ref={rootRef}
      className={css.ribbon}
      data-testid="ambient-ribbon"
      data-phase={phase}
      data-expanded={open ? "true" : "false"}
      data-summoned={summoned ? "true" : "false"}
      aria-label="Drawing instruments"
      style={{ left: `${ax}%`, top: `${ay}%` } as CSSProperties}
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
          /* Closest tool nearest the hub (Fitts). */
          const stackPx = (draftInstruments.length - i) * SLOT_PX;
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
                  ["--stack" as string]: `${stackPx}px`,
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

      {hasAerial ? (
        <div className={css.peel}>
          <button
            type="button"
            className={css.chip}
            data-testid="parchment-peel"
            title="Peel underlay"
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
        </div>
      ) : null}
    </nav>
  );
}
