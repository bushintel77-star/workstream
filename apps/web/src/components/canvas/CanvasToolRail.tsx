"use client";

import css from "./canvasToolRail.module.css";

export type CanvasTool =
  | "trace"
  | "edit"
  | "add"
  | "lock"
  | "reset"
  | "pan"
  | "measure";

type Props = {
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomFit?: () => void;
};

const TOOLS: Array<{ id: CanvasTool; label: string }> = [
  { id: "trace", label: "Trace" },
  { id: "edit", label: "Edit" },
  { id: "add", label: "Add" },
  { id: "lock", label: "Lock" },
  { id: "reset", label: "Reset" },
  { id: "pan", label: "Pan" },
  { id: "measure", label: "Measure" },
];

export function CanvasToolRail({
  tool,
  onTool,
  onZoomIn,
  onZoomOut,
  onZoomFit,
}: Props) {
  return (
    <nav className={css.rail} aria-label="Drawing tools" data-testid="canvas-tool-rail">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`${css.btn}${tool === t.id ? ` ${css.btnActive}` : ""}`}
          aria-pressed={tool === t.id}
          data-testid={`canvas-tool-${t.id}`}
          title={t.label}
          onClick={() => onTool(t.id)}
        >
          {t.label}
        </button>
      ))}
      <div className={css.divider} />
      <div className={css.zoomRow}>
        <button type="button" className={css.btn} title="Zoom in" onClick={onZoomIn}>
          +
        </button>
        <button type="button" className={css.btn} title="Zoom out" onClick={onZoomOut}>
          −
        </button>
        <button type="button" className={css.btn} title="Fit view" onClick={onZoomFit}>
          Fit
        </button>
      </div>
    </nav>
  );
}
