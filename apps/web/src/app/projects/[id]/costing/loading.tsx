import s from "../../../../styles/app.module.css";
import sk from "../../../../styles/skeleton.module.css";

export default function CostingLoading() {
  return (
    <main className={s.page} aria-busy="true" aria-label="Loading costing">
      <div className={`${sk.skel} ${sk.lineLg} ${sk.w30}`} />
      <div className={`${sk.skel} ${sk.line} ${sk.w60}`} />
      <div className={sk.metricsRow}>
        <div className={`${sk.skel} ${sk.metric}`} />
        <div className={`${sk.skel} ${sk.metric}`} />
        <div className={`${sk.skel} ${sk.metric}`} />
      </div>
    </main>
  );
}
