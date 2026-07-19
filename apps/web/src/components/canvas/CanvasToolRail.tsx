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
  onUndo?: () => void;
  onRedo?: () => void;
  zoomLabel?: string;
};

const TOOLS: Array<{ id: CanvasTool; label: string; icon: string }> = [
  { id: "trace", label: "Trace", icon: "✎" },
  { id: "edit", label: "Edit", icon: "◇" },
  { id: "add", label: "Add", icon: "+" },
  { id: "lock", label: "Lock", icon: "⬡" },
  { id: "reset", label: "Reset", icon: "↺" },
  { id: "pan", label: "Pan", icon: "✥" },
  { id: "measure", label: "Measure", icon: "⟷" },
];

export function CanvasToolRail({
  tool,
  onTool,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onUndo,
  onRedo,
  zoomLabel = "100%",
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
          <span className={css.icon} aria-hidden>
            {t.icon}
          </span>
          <span className={css.label}>{t.label}</span>
        </button>
      ))}
      <div className={css.divider} />
      <button type="button" className={css.zoomBtn} title="Zoom in" onClick={onZoomIn}>
        ＋
      </button>
      <div className={css.zoomTxt}>{zoomLabel}</div>
      <button type="button" className={css.zoomBtn} title="Zoom out" onClick={onZoomOut}>
        −
      </button>
      <button type="button" className={css.fitBtn} title="Fit view" onClick={onZoomFit}>
        FIT
      </button>
      <div className={css.divider} />
      <button
        type="button"
        className={css.histBtn}
        title="Undo"
        onClick={onUndo}
        disabled={!onUndo}
      >
        ↩
      </button>
      <button
        type="button"
        className={css.histBtn}
        title="Redo"
        onClick={onRedo}
        disabled={!onRedo}
      >
        ↪
      </button>
    </nav>
  );
}
