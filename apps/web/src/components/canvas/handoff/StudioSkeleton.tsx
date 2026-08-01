import s from "./StudioSkeleton.module.css";

export function StudioSkeleton() {
  return (
    <div className={s.root} data-testid="studio-skeleton" aria-busy="true">
      <div className={s.frameTop}>
        <div className={s.frameLeft} />
        <div className={s.frameRight} />
      </div>
      <div className={s.board}>
        <div className={s.ghostGrid} />
        <div className={s.ghostCard} style={{ width: "180px", top: "20%", left: "8%" }} />
        <div className={s.ghostCard} style={{ width: "140px", top: "60%", left: "12%" }} />
        <div className={s.ghostCard} style={{ width: "200px", top: "35%", right: "8%" }} />
        <div className={s.ghostDock} />
      </div>
      <div className={s.frameBottom} />
    </div>
  );
}
