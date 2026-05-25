import vp from "./studioViewportHud.module.css";

type Props = {
  zoomPercent: number;
  cursorPct: { x: number; y: number } | null;
  toolLabel: string;
};

export function StudioViewportHud({ zoomPercent, cursorPct, toolLabel }: Props) {
  return (
    <div className={vp.hud} aria-hidden data-testid="studio-viewport-hud">
      <span className={vp.chip}>{toolLabel}</span>
      <span className={vp.chip}>{zoomPercent}%</span>
      {cursorPct ? (
        <span className={vp.mono}>
          {cursorPct.x.toFixed(1)}%, {cursorPct.y.toFixed(1)}%
        </span>
      ) : null}
    </div>
  );
}
