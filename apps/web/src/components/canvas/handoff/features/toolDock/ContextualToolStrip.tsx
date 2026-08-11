"use client";

import { useMemo, type PointerEvent } from "react";
import { CameraChrome } from "../../CameraChrome";
import type { StudioMode, StudioTool } from "../../studioCatalog";
import {
  buildToolChips,
  toolChipActive,
  toolChipTestId,
  type ToolChip,
} from "./toolChips";
import { ToolGlyph } from "./ToolGlyph";
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
 * Compact horizontal draw tools — same chips as ToolDock, seated in the gallery
 * frame's bottom band, clear of FAB / sheet peek via --ws-safe-bottom.
 */
export function ContextualToolStrip({
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
  const chips = useMemo(
    () => buildToolChips(mode, surveyServicesAuthoring),
    [mode, surveyServicesAuthoring],
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

  const magnetise = (e: PointerEvent<HTMLElement>) => {
    const target = e.currentTarget;
    const buttons = target.querySelectorAll<HTMLElement>("[data-magnetic]");
    buttons.forEach((button) => {
      const rect = button.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      const influence = Math.max(0, Math.min(1, (15 - distance) / 15));
      button.style.setProperty("--mag-x", `${dx * influence * 0.22}px`);
      button.style.setProperty("--mag-y", `${dy * influence * 0.22}px`);
    });
  };

  const releaseMagnet = (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((button) => {
      button.style.removeProperty("--mag-x");
      button.style.removeProperty("--mag-y");
    });
  };

  return (
    <CameraChrome
      place={{ kind: "frame" }}
      testId="contextual-tool-strip-chrome"
    >
      <nav
        className={`${css.strip}${night ? ` ${css.stripNight}` : ""}`}
        data-frame-rail="bottom"
        data-testid="contextual-tool-strip"
        aria-label="Drawing tools"
        onPointerMove={magnetise}
        onPointerLeave={releaseMagnet}
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
                  data-magnetic="true"
                  data-testid={toolChipTestId(chip)}
                  title={chip.title ?? chip.label}
                  aria-pressed={active}
                  onClick={() => pick(chip)}
                >
                  <ToolGlyph id={chip.id} className={css.glyph} size={17} />
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
