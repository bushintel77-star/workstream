import Link from "next/link";
import s from "../../styles/app.module.css";
import p from "../projects/[id]/project.module.css";

const TABS: Array<{ slug: string; label: string }> = [
  { slug: "", label: "Integrations" },
  { slug: "rate-card", label: "Rate card" },
  { slug: "plant-palette", label: "Plant palette" },
  { slug: "design-assets", label: "Design assets" },
  { slug: "crew", label: "Crew" },
  { slug: "suppliers", label: "Suppliers" },
  { slug: "accounting", label: "Accounting" },
];

export function SettingsMasthead({
  active,
  subtitle,
}: {
  active:
    | "integrations"
    | "rate-card"
    | "plant-palette"
    | "design-assets"
    | "crew"
    | "suppliers"
    | "accounting";
  subtitle: string;
}) {
  return (
    <>
      <header className={s.masthead}>
        <div className={s.brand}>
          Curtis &amp; Co
          <span className={s.brandSub}>Settings · {subtitle}</span>
        </div>
        <Link href="/" className={s.crumb}>
          ← Projects
        </Link>
      </header>
      <nav className={p.subnav} aria-label="Settings sections">
        {TABS.map((t) => {
          const slug = t.slug || "integrations";
          const href = t.slug ? `/settings/${t.slug}` : "/settings";
          const isActive = active === slug;
          return (
            <Link
              key={t.slug || "integrations"}
              href={href}
              className={`${p.subnavItem} ${isActive ? p.subnavItemActive : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
