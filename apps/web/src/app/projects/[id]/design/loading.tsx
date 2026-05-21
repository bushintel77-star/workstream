import s from "../../../../styles/app.module.css";
import sk from "../../../../styles/skeleton.module.css";

export default function DesignLoading() {
  return (
    <main className={s.page} aria-busy="true" aria-label="Loading design">
      <div className={`${sk.skel} ${sk.lineLg} ${sk.w30}`} />
      <div className={`${sk.skel} ${sk.line} ${sk.w80}`} />
      <div className={`${sk.skel} ${sk.card}`} style={{ marginTop: 24, minHeight: 200 }} />
    </main>
  );
}
