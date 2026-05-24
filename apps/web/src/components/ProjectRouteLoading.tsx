import s from "../styles/app.module.css";
import p from "../app/projects/[id]/project.module.css";
import sk from "../styles/skeleton.module.css";

const TAB_COUNT = 11;

/** Shared loading skeleton for project sub-routes. */
export function ProjectRouteLoading() {
  return (
    <main className={s.page} aria-busy="true" aria-label="Loading project">
      <header className={s.masthead}>
        <div className={s.brand}>
          <div className={`${sk.skel} ${sk.line} ${sk.w60}`} />
          <div className={`${sk.skel} ${sk.lineSm} ${sk.w40}`} />
        </div>
      </header>
      <nav className={p.subnav} aria-hidden="true">
        {Array.from({ length: TAB_COUNT }, (_, i) => (
          <span
            key={i}
            className={`${sk.skel} ${sk.tab}`}
            aria-hidden="true"
          />
        ))}
      </nav>
      <div className={`${sk.skel} ${sk.lineLg} ${sk.w40}`} />
      <div className={`${sk.skel} ${sk.line} ${sk.w80}`} />
      <div className={sk.pipelineRow}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`${sk.skel} ${sk.stage}`} />
        ))}
      </div>
      <div className={sk.metricsRow}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className={`${sk.skel} ${sk.metric}`} />
        ))}
      </div>
    </main>
  );
}
