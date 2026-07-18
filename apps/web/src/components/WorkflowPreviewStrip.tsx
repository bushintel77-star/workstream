import { CANVAS_MODES } from "../lib/canvas-mode";
import canvasCss from "./canvas/siteCanvas.module.css";
import homeCss from "../app/home.module.css";

/** Home-page wayfinding - mirrors the canvas mode strip without interaction. */
export function WorkflowPreviewStrip() {
  return (
    <div className={homeCss.workflowHost}>
      <nav
        className={canvasCss.modeStrip}
        aria-label="Design workflow"
        data-testid="home-workflow-strip"
      >
        {CANVAS_MODES.map((m, i) => (
          <span
            key={m.id}
            className={`${canvasCss.modeBtn} ${i === 0 ? canvasCss.modeBtnActive : canvasCss.modeBtnLocked}`}
            aria-hidden
          >
            {m.label}
            {i > 0 ? (
              <span className={canvasCss.modeLock}>{"\u00b7 next"}</span>
            ) : null}
          </span>
        ))}
      </nav>
    </div>
  );
}
