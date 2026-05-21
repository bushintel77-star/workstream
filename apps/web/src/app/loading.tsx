import s from "../styles/app.module.css";
import sk from "../styles/skeleton.module.css";

export default function DashboardLoading() {
  return (
    <main className={s.pageNarrow} aria-busy="true" aria-label="Loading">
      <header className={s.masthead}>
        <div className={s.brand}>
          Curtis &amp; Co
          <span className={s.brandSub}>Workstream · Projects</span>
        </div>
      </header>
      <div className={`${sk.skel} ${sk.lineLg} ${sk.w40}`} />
      <div className={`${sk.skel} ${sk.line} ${sk.w80}`} />
      <div className={`${sk.skel} ${sk.line} ${sk.w60}`} />
      <div style={{ height: 24 }} />
      <div className={`${sk.skel} ${sk.card}`} />
      <div className={`${sk.skel} ${sk.card}`} />
      <div className={`${sk.skel} ${sk.card}`} />
    </main>
  );
}
