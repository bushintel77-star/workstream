import Link from "next/link";
import type { IntegrationSummary } from "../lib/api";
import s from "../styles/app.module.css";
import nav from "./app-nav.module.css";

export function AppNav({
  summary,
}: {
  summary: IntegrationSummary | null;
}) {
  const plan = summary?.plan ?? "lite";
  const attention = summary?.needs_attention ?? false;

  return (
    <nav className={nav.bar} aria-label="Workstream">
      <Link href="/" className={nav.brand}>
        Workstream
      </Link>
      <div className={nav.links}>
        <Link href="/" className={nav.link}>
          Projects
        </Link>
        <Link href="/settings" className={nav.link}>
          Integrations
          {attention && (
            <span className={nav.dot} aria-label="Setup incomplete" />
          )}
        </Link>
        <Link href="/settings/accounting" className={nav.link}>
          Accounting
        </Link>
      </div>
      <span
        className={`${s.pill} ${plan === "studio" ? s.pillOk : s.pillInfo} ${nav.plan}`}
      >
        {plan === "studio" ? "Studio" : "Lite"}
      </span>
    </nav>
  );
}
