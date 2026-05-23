import s from "../styles/app.module.css";
import sk from "../styles/skeleton.module.css";

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
      <div className={`${sk.skel} ${sk.lineLg} ${sk.w40}`} />
      <div className={`${sk.skel} ${sk.line} ${sk.w80}`} />
      <div className={`${sk.skel} ${sk.line} ${sk.w60}`} />
    </main>
  );
}
