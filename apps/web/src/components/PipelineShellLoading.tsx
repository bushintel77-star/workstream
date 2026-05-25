import shell from "./projectPipelineShell.module.css";
import sh from "./pipelineImageShell.module.css";
import p from "../app/projects/[id]/project.module.css";
import sk from "../styles/skeleton.module.css";

const TAB_COUNT = 11;

type Props = {
  variant?: "immersive" | "content";
  label?: string;
};

/** Loading skeleton matching ProjectPipelineShell chrome + image grid. */
export function PipelineShellLoading({
  variant = "content",
  label = "Loading project",
}: Props) {
  const immersive = variant === "immersive";

  return (
    <div
      className={`${shell.frame} ${immersive ? shell.frameImmersive : shell.frameContent}`}
      data-testid="project-pipeline-shell"
      data-shell-variant={variant}
      aria-busy="true"
      aria-label={label}
    >
      <header className={shell.chrome}>
        <div className={shell.chromeRow}>
          <div className={`${sk.skel} ${sk.line} ${sk.w40}`} />
          <div className={`${sk.skel} ${sk.lineSm} ${sk.w60}`} />
        </div>
        <nav className={`${p.subnav} ${shell.subnav}`} aria-hidden="true">
          {Array.from({ length: TAB_COUNT }, (_, i) => (
            <span key={i} className={`${sk.skel} ${sk.tab}`} aria-hidden="true" />
          ))}
        </nav>
      </header>
      <main
        className={`${shell.stage} ${immersive ? shell.stageImmersive : shell.stageContent}`}
      >
        {immersive ? (
          <div className={sh.imageShell}>
            <div className={sh.workspace}>
              <div className={sh.canvasCol}>
                <div className={`${sk.skel} ${sh.canvas}`} style={{ minHeight: 280 }} />
              </div>
              <aside className={sh.sideRail}>
                <div className={`${sk.skel} ${sk.lineLg} ${sk.w60}`} />
                <div className={`${sk.skel} ${sk.line} ${sk.w80}`} />
                <div className={sk.pipelineRow}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className={`${sk.skel} ${sk.stage}`} />
                  ))}
                </div>
              </aside>
            </div>
          </div>
        ) : (
          <div className={shell.content}>
            <div className={`${sk.skel} ${sk.lineLg} ${sk.w40}`} />
            <div className={`${sk.skel} ${sk.line} ${sk.w80}`} />
            <div className={sk.metricsRow}>
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className={`${sk.skel} ${sk.metric}`} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
