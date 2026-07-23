"use client";

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
  const surveyExtras =
    mode === "survey" || servicesEdit
      ? SURVEY_TOOLS.map((t) => ({
          id: t.id as StudioTool,
          label: t.label,
          icon: t.icon,
          title: t.title,
        }))
      : [];

  return (
    <CameraChrome place={{ kind: "dock" }} testId="tool-dock-chrome">
      <nav
        className={`${css.dock}${night ? ` ${css.dockNight}` : ""}`}
        data-testid="tool-dock"
        aria-label="Drawing tools"
      >
        <ul className={css.list}>
          {PRIMARY.map((t) => {
            const active =
              tool === t.id || (t.id === "lock" && locked && tool === "lock");
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className={`${css.btn}${active ? ` ${css.btnActive}` : ""}`}
                  data-testid={
                    t.id === "measure"
                      ? "canvas-tool-measure"
                      : `canvas-tool-${t.id}`
                  }
                  title={t.title ?? t.label}
                  aria-pressed={active}
                  onClick={() => {
                    if (t.id === "measure") onMeasure();
                    else if (t.id === tool) onTool("pan");
                    else onTool(t.id as StudioTool);
                  }}
                >
                  <span className={css.glyph} aria-hidden>
                    {t.icon}
                  </span>
                  <span className={css.label}>{t.label}</span>
                </button>
              </li>
            );
          })}
          {surveyExtras.map((t) => {
            const active = tool === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className={`${css.btn}${active ? ` ${css.btnActive}` : ""}`}
                  data-testid={`canvas-tool-${t.id}`}
                  title={t.title ?? t.label}
                  aria-pressed={active}
                  onClick={() => onTool(active ? "pan" : t.id)}
                >
                  <span className={css.glyph} aria-hidden>
                    {t.icon}
                  </span>
                  <span className={css.label}>{t.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className={css.trail}>
          <button
            type="button"
            className={`${css.btn}${gridOn ? ` ${css.btnActive}` : ""}`}
            data-testid="canvas-tool-grid"
            title="Drafting grid"
            aria-pressed={gridOn}
            onClick={onToggleGrid}
          >
            <span className={css.glyph} aria-hidden>
              ▦
            </span>
            <span className={css.label}>Grid</span>
          </button>
        </div>
      </nav>
    </CameraChrome>
  );
}
