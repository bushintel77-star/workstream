import s from "../../../../styles/app.module.css";
import sk from "../../../../styles/skeleton.module.css";
import sp from "../../../../components/sitePlan.module.css";

export default function SurveyLoading() {
  return (
    <main className={s.page} aria-busy="true" aria-label="Loading survey">
      <div className={`${sk.skel} ${sk.lineLg} ${sk.w40}`} />
      <div className={`${sk.skel} ${sk.line} ${sk.w70}`} />
      <div className={`${sk.skel} ${sp.planSkeleton}`} style={{ marginTop: 16 }} />
      <div className={sk.metricsRow}>
        <div className={`${sk.skel} ${sk.metric}`} />
        <div className={`${sk.skel} ${sk.metric}`} />
        <div className={`${sk.skel} ${sk.metric}`} />
      </div>
    </main>
  );
}
