import s from "../../../../styles/app.module.css";
import sk from "../../../../styles/skeleton.module.css";

export default function ProcessingLoading() {
  return (
    <main className={s.page} aria-busy="true" aria-label="Loading processing">
      <div className={`${sk.skel} ${sk.lineLg} ${sk.w50}`} />
      <div className={`${sk.skel} ${sk.line} ${sk.w90}`} />
      <div className={`${sk.skel} ${sk.card}`} style={{ marginTop: 20, minHeight: 180 }} />
    </main>
  );
}
