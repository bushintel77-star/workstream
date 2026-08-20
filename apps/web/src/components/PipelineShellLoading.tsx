import css from "./canvas/siteCanvas.module.css";
import sk from "../styles/skeleton.module.css";

type Props = {
  variant?: "immersive" | "content";
  label?: string;
};

/** Canvas-first loading shell — no pipeline tab chrome. */
export function PipelineShellLoading({
  label = "Loading project",
}: Props) {
  return (
    <div
      className={css.root}
      data-testid="canvas-shell-loading"
      aria-busy="true"
      aria-label={label}
    >
      <div
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "var(--gs-space-4)",
          zIndex: "var(--cf-z-chrome)",
        }}
      >
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className={`${sk.skel} ${sk.line}`}
            style={{ width: 72, height: 32, borderRadius: "var(--gs-radius-xl)" }}
          />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          inset: "20% 8% 28%",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          className={`${sk.skel}`}
          style={{ width: "min(92vw, 720px)", height: "100%", borderRadius: 26 }}
        />
      </div>
    </div>
  );
}
