import home from "./home.module.css";

/**
 * Register loading state. Uses the SAME full-bleed `/home` shell so no
 * responsive "compromise" frame flashes between the landing page and the
 * desktop register.
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
          <ul className={home.cardGrid}>
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className={home.cardItem}>
                <div className={home.card}>
                  <div className={home.cardThumb}>
                    <span className={home.cardIndex}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className={home.cardBody}>
                    <span className={home.cardName} style={{ opacity: 0.3 }}>
                      Loading project
                    </span>
                    <span className={home.cardAddress} style={{ opacity: 0.2 }}>
                      —
                    </span>
                  </div>
                  <div className={home.cardFooter}>
                    <span className={home.cardStage}>—</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <style>{`@keyframes skelPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } } .${home.card} { animation: skelPulse 1.4s ease infinite; } @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`}</style>
    </main>
  );
}
