import home from "./home.module.css";

/**
 * Register loading state. Uses the SAME full-bleed `/home` shell (not the
 * narrow operator column) so no responsive "compromise" frame flashes between
 * the landing page and the desktop register — this app is desktop-only, and
 * the loading state must not momentarily render as a centered ~720px
 * mobile-width card and then jump to full width.
 */
export default function DashboardLoading() {
  return (
    <main className={home.page} aria-busy="true" aria-label="Loading">
      <header className={home.hero}>
        <p className={home.kicker}>Workstream</p>
        <h1 className={home.brand}>Curtis &amp; Co</h1>
      </header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "16px",
          marginTop: "28px",
        }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            style={{
              minHeight: "200px",
              borderRadius: "12px",
              border: "1px solid var(--line-hairline)",
              background: "var(--surface-elevated)",
              animation: "skelPulse 1.4s ease infinite",
            }}
          />
        ))}
      </div>
      <style>{`@keyframes skelPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } } @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`}</style>
    </main>
  );
}
