import Link from "next/link";
import type { IntegrationSummary } from "../lib/api";
import s from "../styles/app.module.css";
import nav from "./app-nav.module.css";

type Props = {
  summary: IntegrationSummary | null;
  /** Show Curtis & Co subtitle under the wordmark (settings context). */
  brandSub?: boolean;
};

export function AppNav({ summary, brandSub = false }: Props) {
  const plan = summary?.plan ?? "lite";

  return (
    <nav className={nav.bar} aria-label="Workstream">
      <div className={nav.inner}>
        <Link href="/home" className={nav.brand}>
          <span className={nav.brandMark} aria-hidden />
          <span className={nav.brandText}>
            Workstream
            {brandSub ? (
              <span className={nav.brandSub}>Workstream</span>
            ) : null}
          </span>
        </Link>
        <div className={nav.links}>
          <Link href="/home" className={nav.link}>
            Projects
          </Link>
          <Link href="/settings" className={nav.link}>
            Settings
          </Link>
        </div>
        <details className={nav.mobileMenu}>
          <summary className={nav.menuButton}>Menu</summary>
          <div className={nav.mobilePanel}>
            <Link href="/home" className={nav.mobileLink}>
              Projects
            </Link>
            <Link href="/settings" className={nav.mobileLink}>
              Settings
            </Link>
          </div>
        </details>
        <span
          className={`${s.pill} ${plan === "studio" ? s.pillOk : s.pillInfo} ${nav.plan}`}
        >
          {plan === "studio" ? "Studio" : "Lite"}
        </span>
      </div>
    </nav>
  );
}
