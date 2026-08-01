import s from "../styles/app.module.css";

export default function DashboardLoading() {
  return (
    <main className={s.pageNarrow} aria-busy="true" aria-label="Loading">
      <header className={s.masthead}>
        <div className={s.brand}>
          Curtis &amp; Co
          <span className={s.brandSub}>Workstream · Projects</span>
        </div>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "24px" }}>
        <div style={{ height: "28px", width: "40%", borderRadius: "5px", background: "var(--surface-elevated)", animation: "skelPulse 1.4s ease infinite" }} />
        <div style={{ height: "16px", width: "80%", borderRadius: "5px", background: "var(--surface-elevated)", animation: "skelPulse 1.4s ease infinite" }} />
        <div style={{ height: "16px", width: "60%", borderRadius: "5px", background: "var(--surface-elevated)", animation: "skelPulse 1.4s ease infinite" }} />
        <div style={{ height: "1px", background: "var(--line-subtle)", margin: "16px 0" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} style={{ minHeight: "220px", borderRadius: "7px", border: "1px solid var(--line-hairline)", background: "var(--surface-elevated)", animation: "skelPulse 1.4s ease infinite" }} />
          ))}
        </div>
      </div>
      <style>{`@keyframes skelPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } } @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`}</style>
    </main>
  );
}
