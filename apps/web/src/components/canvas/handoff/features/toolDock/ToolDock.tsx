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
  { id: "edit", label: "Edit", icon: "◇", title: "Edit nodes" },
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
  { id: "pan", label: "Pan", icon: "✥", title: "Pan" },
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
 * Static column — no carousel / fisheye motion on the shell or chips.
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
    if (chip.id === tool) {
      onTool("pan");
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
