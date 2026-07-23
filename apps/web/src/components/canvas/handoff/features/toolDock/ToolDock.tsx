"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { CameraChrome } from "../../CameraChrome";
import {
  SURVEY_TOOLS,
  type StudioMode,
  type StudioTool,
} from "../../studioCatalog";
import {
  DOCK_CURVE,
  dockChipPose,
  dockFocusFromPointer,
  spinDockFocus,
} from "./dockCarousel";
import css from "./toolDock.module.css";

const PRIMARY: Array<{
  id: StudioTool | "measure";
  label: string;
  icon: string;
  title?: string;
}> = [
  { id: "trace", label: "Trace", icon: "✎", title: "Trace boundary or building" },
  {
    id: "select",
    label: "Select",
    icon: "➤",
    title: "Select — grab, marquee, edit nodes (Esc)",
  },
  { id: "add", label: "Add", icon: "+", title: "Place from inventory" },
  {
    id: "paint",
    label: "Paint",
    icon: "▣",
    title: "Fill swatch — click a shape",
  },
  {
    id: "zone",
    label: "Zone",
    icon: "〰",
    title: "Drip or lighting path",
  },
  { id: "measure", label: "Measure", icon: "⟋", title: "Measure" },
  { id: "lock", label: "Lock", icon: "⬡", title: "Lock selection" },
];

type Chip = {
  id: StudioTool | "measure" | "grid";
  label: string;
  icon: string;
  title?: string;
  trail?: boolean;
};

type Props = {
  tool: StudioTool;
  mode: StudioMode;
  servicesEdit?: boolean;
  locked: boolean;
  night?: boolean;
  gridOn: boolean;
  onTool: (t: StudioTool) => void;
  onMeasure: () => void;
  onToggleGrid: () => void;
};

/**
 * Single left tool dock — steering-wheel home for mode changes.
 * Fixed frost rail via CameraChrome dock; never under zoom-world.
 *
 * Curve carousel: chips ride a gentle arc that leans toward the drawing
 * surface. The crest follows the pointer, spins with the wheel and settles
 * on the active tool (math in dockCarousel.ts; hit targets stay 44px).
 */
export function ToolDock({
  tool,
  mode,
  servicesEdit = false,
  locked,
  night = false,
  gridOn,
  onTool,
  onMeasure,
  onToggleGrid,
}: Props) {
  const chips = useMemo<Chip[]>(() => {
    const surveyExtras =
      mode === "survey" || servicesEdit
        ? SURVEY_TOOLS.map((t) => ({
            id: t.id as StudioTool,
            label: t.label,
            icon: t.icon,
            title: t.title,
          }))
        : [];
    return [
      ...PRIMARY,
      ...surveyExtras,
      { id: "grid", label: "Grid", icon: "▦", title: "Drafting grid", trail: true },
    ];
  }, [mode, servicesEdit]);

  const listRef = useRef<HTMLUListElement | null>(null);
  const [crest, setCrest] = useState<number | null>(null);

  const isActive = (chip: Chip): boolean => {
    if (chip.id === "grid") return gridOn;
    if (chip.id === "lock") return locked && tool === "lock";
    return tool === chip.id;
  };

  const activeIndex = chips.findIndex(isActive);
  /** Rest crest: the active tool, or the middle of the arc when nothing is armed. */
  const restCrest = activeIndex >= 0 ? activeIndex : (chips.length - 1) / 2;
  const focus = crest ?? restCrest;
  const amplitude = crest != null ? 1 : DOCK_CURVE.restAmplitude;

  const trackPointer = (clientY: number) => {
    const list = listRef.current;
    if (!list) return;
    const rect = list.getBoundingClientRect();
    const pitch = rect.height / chips.length;
    setCrest(dockFocusFromPointer(clientY - rect.top, pitch, chips.length));
  };

  const pick = (chip: Chip) => {
    if (chip.id === "grid") {
      onToggleGrid();
      return;
    }
    if (chip.id === "measure") {
      onMeasure();
      return;
    }
    // Toggling the armed tool off drops back to the Select ground state.
    if (chip.id === tool && chip.id !== "select") {
      onTool("select");
      return;
    }
    onTool(chip.id as StudioTool);
  };

  return (
    <CameraChrome place={{ kind: "dock" }} testId="tool-dock-chrome">
      <nav
        className={`${css.dock}${night ? ` ${css.dockNight}` : ""}`}
        data-testid="tool-dock"
        aria-label="Drawing tools"
        onPointerMove={(e) => trackPointer(e.clientY)}
        onPointerLeave={() => setCrest(null)}
        onWheel={(e) => {
          e.stopPropagation();
          setCrest((cur) =>
            spinDockFocus(cur ?? restCrest, e.deltaY, chips.length),
          );
        }}
      >
        <ul className={css.list} ref={listRef}>
          {chips.map((chip, index) => {
            const active = isActive(chip);
            const pose = dockChipPose(index, focus, amplitude);
            return (
              <li
                key={chip.id}
                className={`${css.slot}${chip.trail ? ` ${css.slotTrail}` : ""}`}
              >
                <button
                  type="button"
                  className={`${css.btn}${active ? ` ${css.btnActive}` : ""}`}
                  data-testid={
                    chip.id === "measure"
                      ? "canvas-tool-measure"
                      : `canvas-tool-${chip.id}`
                  }
                  title={chip.title ?? chip.label}
                  aria-pressed={active}
                  onClick={() => pick(chip)}
                >
                  <span
                    className={css.chipBody}
                    style={
                      {
                        "--dock-lean": `${pose.leanPx.toFixed(2)}px`,
                        "--dock-scale": pose.scale.toFixed(3),
                        "--dock-fade": active
                          ? 1
                          : pose.opacity.toFixed(3),
                      } as CSSProperties
                    }
                  >
                    <span className={css.glyph} aria-hidden>
                      {chip.icon}
                    </span>
                    <span className={css.label}>{chip.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </CameraChrome>
  );
}
