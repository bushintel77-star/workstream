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
import css from "./contextualToolStrip.module.css";

type Props = {
  tool: StudioTool;
  mode: StudioMode;
  surveyServicesAuthoring?: boolean;
  locked: boolean;
  night?: boolean;
  gridOn: boolean;
  onTool: (t: StudioTool) => void;
  onMeasure: () => void;
  onToggleGrid: () => void;
};

/**
 * Compact horizontal draw tools — same chips as ToolDock, CameraChrome dock,
 * clear of FAB / sheet peek via --ws-safe-bottom.
 */
export function ContextualToolStrip({
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
    if (chip.id === tool && chip.id !== "select") {
      onTool("select");
      return;
    }
    onTool(chip.id as StudioTool);
  };

  return (
    <CameraChrome place={{ kind: "dock" }} testId="contextual-tool-strip-chrome">
      <nav
        className={`${css.strip}${night ? ` ${css.stripNight}` : ""}`}
        data-testid="contextual-tool-strip"
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
