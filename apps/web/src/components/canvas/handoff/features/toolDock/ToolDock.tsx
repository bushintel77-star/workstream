"use client";

import { useMemo } from "react";
import { CameraChrome } from "../../CameraChrome";
import type { StudioMode, StudioTool } from "../../studioCatalog";
import {
  buildToolChips,
  toolChipActive,
  toolChipTestId,
  type ToolChip,
} from "./toolChips";
import { ToolGlyph } from "./ToolGlyph";
import css from "./toolDock.module.css";

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
 * Seated in the gallery frame's left band via CameraChrome frame placement;
 * never under zoom-world, never painted over the drawing.
 * Static column — no carousel / fisheye motion on the shell or chips.
 */
export function ToolDock({
  tool,
  mode: _mode,
  surveyServicesAuthoring = false,
  locked,
  night = false,
  gridOn,
  onTool,
  onMeasure,
  onToggleGrid,
}: Props) {
  const chips = useMemo(
    () => buildToolChips(surveyServicesAuthoring),
    [surveyServicesAuthoring],
  );

  const pick = (chip: ToolChip) => {
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
    <CameraChrome place={{ kind: "frame" }} testId="tool-dock-chrome">
      <nav
        className={`${css.dock}${night ? ` ${css.dockNight}` : ""}`}
        data-frame-rail="left"
        data-testid="tool-dock"
        aria-label="Drawing tools"
      >
        <ul className={css.list}>
          {chips.map((chip) => {
            const active = toolChipActive(chip, { tool, locked, gridOn });
            return (
              <li
                key={chip.id}
                className={chip.trail ? css.slotTrail : undefined}
              >
                <button
                  type="button"
                  className={`${css.btn}${active ? ` ${css.btnActive}` : ""}`}
                  data-testid={toolChipTestId(chip)}
                  title={chip.title ?? chip.label}
                  aria-pressed={active}
                  onClick={() => pick(chip)}
                >
                  {active ? <span className={css.activeBar} aria-hidden /> : null}
                  <ToolGlyph id={chip.id} className={css.glyph} />
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
