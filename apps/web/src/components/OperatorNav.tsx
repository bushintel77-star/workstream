import Link from "next/link";
import nav from "./operatorNav.module.css";

export function OperatorNav() {
  return (
    <nav className={nav.bar} aria-label="Workstream">
      <Link href="/" className={nav.brand}>
        Workstream
        <span className={nav.brandSub}>Curtis &amp; Co</span>
      </Link>
      <div className={nav.links}>
        <Link href="/" className={nav.link}>
          Projects
        </Link>
        <Link href="/settings" className={nav.link}>
          Settings
        </Link>
      </div>
    </nav>
  );
}
