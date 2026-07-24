"use client";

import { useMemo } from "react";
import { CameraChrome } from "../../CameraChrome";
import {
  SURVEY_TOOLS,
  type StudioMode,
  type StudioTool,
} from "../../studioCatalog";
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
  /** Survey Servc / Level / Calib — survey tab only, before Quote lock. */
  surveyServicesAuthoring?: boolean;
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
 * Static column — no carousel / fisheye motion on the shell or chips.
 */
export function ToolDock({
  tool,
  mode,
  surveyServicesAuthoring = false,
  locked,
  night = false,
  gridOn,
  onTool,
  onMeasure,
  onToggleGrid,
}: Props) {
  const chips = useMemo<Chip[]>(() => {
    const surveyExtras = surveyServicesAuthoring
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
  }, [surveyServicesAuthoring]);

  const isActive = (chip: Chip): boolean => {
    if (chip.id === "grid") return gridOn;
    if (chip.id === "lock") return locked && tool === "lock";
    return tool === chip.id;
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
      >
        <ul className={css.list}>
          {chips.map((chip) => {
            const active = isActive(chip);
            return (
              <li
                key={chip.id}
                className={chip.trail ? css.slotTrail : undefined}
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
                  <span className={css.glyph} aria-hidden>
                    {chip.icon}
                  </span>
                  <span className={css.label}>{chip.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </CameraChrome>
  );
}
