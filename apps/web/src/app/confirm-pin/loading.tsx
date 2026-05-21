import s from "../../styles/app.module.css";
import sk from "../../styles/skeleton.module.css";
import cp from "./confirm-pin.module.css";

export default function ConfirmPinLoading() {
  return (
    <main className={s.pageNarrow} aria-busy="true" aria-label="Loading aerial">
      <div className={`${sk.skel} ${sk.lineLg} ${sk.w40}`} />
      <div className={`${sk.skel} ${sk.line} ${sk.w80}`} />
      <div className={`${sk.skel} ${cp.aerialSkeleton}`} style={{ width: "100%", aspectRatio: "5/3", marginTop: 16 }} />
    </main>
  );
}
