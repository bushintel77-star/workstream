"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { StudioGlyph } from "../../StudioGlyph";
import { playInstrumentTick } from "../ambient/instrumentTick";
import { CameraChrome } from "../../CameraChrome";
import type { BoardCamera } from "../../geometry/cameraPointer";
import {
  LOCAL_ACTION_PX,
  LOCAL_ARC_SPAN_DEG,
} from "../reach/fittsProximity";
import {
  ATELIER_LINGER_MS,
  type AtelierPhase,
} from "./atelierPresence";
import type { NicheTool } from "./nicheTools";
import css from "./nicheToolCarousel.module.css";

type Props = {
  /** Board-% — fans above the selected object. */
  xPct: number;
  yPct: number;
  tools: NicheTool[];
  activeId: string | null;
  /**
   * Live board camera — the tool fan portals through it so the arc chips
   * stay a constant screen size regardless of camera zoom / rotate.
   */
  cam?: BoardCamera;
  onSelect: (tool: NicheTool) => void;
  testId?: string;
  label?: string;
};

/**
 * Contextual material fan — CAD marking-menu pattern on the canvas.
 * Slow atelier presence; slots borrow inventory clarity without game chrome.
 */
export function NicheToolCarousel({
  xPct,
  yPct,
  tools,
  activeId,
  cam,
  onSelect,
  testId = "niche-tool-carousel",
  label = "Materials",
}: Props) {
  const [hover, setHover] = useState(false);
  const [lingering, setLingering] = useState(true);
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverRef = useRef(false);

  const activeIdx = Math.max(
    0,
    activeId ? tools.findIndex((t) => t.id === activeId) : 0,
  );

  const clearLinger = useCallback(() => {
    if (lingerTimer.current) {
      clearTimeout(lingerTimer.current);
      lingerTimer.current = null;
    }
  }, []);

  const beginLinger = useCallback(() => {
    clearLinger();
    setLingering(true);
    lingerTimer.current = setTimeout(() => {
      setLingering(false);
      lingerTimer.current = null;
    }, ATELIER_LINGER_MS);
  }, [clearLinger]);

  const stayEngaged = useCallback(() => {
    clearLinger();
    setLingering(true);
  }, [clearLinger]);

  useEffect(() => {
    if (hoverRef.current) {
      stayEngaged();
      return clearLinger;
    }
    beginLinger();
    return clearLinger;
  }, [activeId, tools, beginLinger, stayEngaged, clearLinger]);

  const phase: AtelierPhase = hover
    ? "open"
    : lingering
      ? "linger"
      : "rest";

  const arcAngles = useMemo(() => {
    const n = tools.length;
    if (n <= 1) return [0];
    const span = LOCAL_ARC_SPAN_DEG;
    const start = -span / 2;
    return tools.map((_, i) => {
      const base = start + (span * i) / (n - 1);
      const activeAngle = start + (span * activeIdx) / (n - 1);
      return base - activeAngle;
    });
  }, [activeIdx, tools]);

  const cycle = useCallback(
    (dir: 1 | -1) => {
      if (tools.length === 0) return;
      const next = (activeIdx + dir + tools.length) % tools.length;
      const pick = tools[next];
      if (!pick) return;
      playInstrumentTick("step");
      onSelect(pick);
      if (!hoverRef.current) beginLinger();
      else stayEngaged();
    },
    [activeIdx, tools, onSelect, beginLinger, stayEngaged],
  );

  const ax = Math.max(10, Math.min(90, xPct));
  const ay = Math.max(12, Math.min(88, yPct));

  const innerStyle: CSSProperties = {
    ["--arc-radius" as string]: `${LOCAL_ACTION_PX}px`,
  };

  const inner = (
    <div
      className={css.root}
      data-testid={testId}
      data-phase={phase}
      aria-label={label}
      style={innerStyle}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={() => {
        hoverRef.current = true;
        stayEngaged();
        setHover(true);
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
        setHover(false);
        beginLinger();
      }}
      onWheel={(e) => {
        if (Math.abs(e.deltaY) < 2) return;
        e.preventDefault();
        cycle(e.deltaY > 0 ? 1 : -1);
      }}
    >
      <div className={css.well}>
        {tools.map((t, i) => {
          const on = t.id === activeId;
          const angle = arcAngles[i] ?? 0;
          return (
            <button
              key={t.id}
              type="button"
              className={`${css.slot}${on ? ` ${css.slotOn}` : ""}`}
              data-testid={
                t.material ? `paint-swatch-${t.material}` : `niche-tool-${t.id}`
              }
              title={t.label}
              style={
                {
                  ["--arc" as string]: `${angle}deg`,
                } as CSSProperties
              }
              onClick={() => {
                playInstrumentTick("arm");
                onSelect(t);
                if (!hoverRef.current) beginLinger();
                else stayEngaged();
              }}
            >
              {t.material ? (
                <span className={css.swatchGlyph} aria-hidden>
                  <StudioGlyph type={t.material} ink />
                </span>
              ) : (
                <span className={css.glyph} aria-hidden>
                  {t.icon}
                </span>
              )}
              <span className={css.label}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (!cam) {
    return (
      <div style={{ position: "absolute", left: `${ax}%`, top: `${ay}%` }}>
        {inner}
      </div>
    );
  }

  return (
    <CameraChrome
      place={{
        kind: "project",
        pct: { x: ax, y: ay },
        cam,
        transform: "none",
      }}
    >
      {inner}
    </CameraChrome>
  );
}
