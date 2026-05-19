import s from "../../../styles/app.module.css";
import sk from "../../../styles/skeleton.module.css";

export default function ProjectHubLoading() {
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
      <div style={{ height: 16 }} />
      <div className={sk.pipelineRow}>
        <div className={`${sk.skel} ${sk.stage}`} />
        <div className={`${sk.skel} ${sk.stage}`} />
        <div className={`${sk.skel} ${sk.stage}`} />
        <div className={`${sk.skel} ${sk.stage}`} />
        <div className={`${sk.skel} ${sk.stage}`} />
      </div>
      <div className={sk.metricsRow}>
        <div className={`${sk.skel} ${sk.metric}`} />
        <div className={`${sk.skel} ${sk.metric}`} />
        <div className={`${sk.skel} ${sk.metric}`} />
        <div className={`${sk.skel} ${sk.metric}`} />
        <div className={`${sk.skel} ${sk.metric}`} />
        <div className={`${sk.skel} ${sk.metric}`} />
      </div>
    </main>
  );
}
