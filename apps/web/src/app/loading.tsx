import home from "./home.module.css";

/**
 * Register loading state. Uses the SAME full-bleed `/home` shell so no
 * responsive "compromise" frame flashes before the desktop register renders.
 * Skeleton mirrors the operator ledger (hairline rows, not cards).
 */
export default function DashboardLoading() {
  return (
    <main className={home.page} aria-busy="true" aria-label="Loading">
      <div className={home.layout}>
        <aside className={home.aside}>
          <header className={home.masthead}>
            <div className={home.titleBlock}>
              <p className={home.mastheadMark}>Workstream · Melbourne</p>
              <div className={home.titleBlockMeta}>
                <span>DWG-001</span>
                <span>1:200</span>
              </div>
            </div>
            <h1 className={home.mastheadTitle}>Workstream</h1>
            <div className={home.dimLine} aria-hidden />
          </header>
        </aside>
        <section className={home.index}>
          <div className={home.indexHead}>
            <p className={home.indexLabel}>Projects</p>
            <p className={home.indexCount}>— entries</p>
          </div>
          <ul className={`${home.ledgerList} ${home.ledgerSkeleton}`}>
            {Array.from({ length: 7 }, (_, i) => (
              <li key={i} className={home.rowItem}>
                <div className={home.row} aria-hidden>
                  <span className={home.rowGlyph}>○</span>
                  <span className={home.rowMain}>
                    <span className={home.rowName} style={{ opacity: 0.3 }}>
                      Loading project
                    </span>
                    <span className={home.rowAddress} style={{ opacity: 0.2 }}>
                      —
                    </span>
                  </span>
                  <span className={home.rowStage}>—</span>
                  <span className={home.rowCost}>—</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <style>{`@keyframes skelPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } } .${home.ledgerSkeleton} .${home.row} { animation: skelPulse 1.4s ease infinite; } @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`}</style>
    </main>
  );
}
