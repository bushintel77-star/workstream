import Link from "next/link";
import s from "../../../styles/app.module.css";
import p from "./project.module.css";
import type { Project } from "../../../lib/api";

const TABS: Array<{ slug: string; label: string }> = [
  { slug: "", label: "Overview" },
  { slug: "survey", label: "Survey" },
  { slug: "design", label: "Design" },
  { slug: "costing", label: "Costing" },
  { slug: "audit", label: "Audit" },
  { slug: "outputs", label: "Outputs" },
  { slug: "filing", label: "Filing" },
  { slug: "tasks", label: "Tasks" },
  { slug: "recordings", label: "Recordings" },
  { slug: "measurements", label: "Measurements" },
  { slug: "carbon", label: "Carbon" },
];

export function ProjectMasthead({
  project,
  active,
}: {
  project: Project;
  active:
    | "overview"
    | "survey"
    | "design"
    | "costing"
    | "audit"
    | "outputs"
    | "filing"
    | "tasks"
    | "recordings"
    | "measurements"
    | "carbon";
}) {
  return (
    <>
      <header className={s.masthead}>
        <div className={s.brand}>
          {project.address}
          <span className={s.brandSub}>
            Project · created{" "}
            {new Date(project.created_at).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        <Link href="/" className={s.crumb}>
          ← Projects
        </Link>
      </header>
      <nav className={p.subnav} aria-label="Project sections">
        {TABS.map((t) => {
          const slug = t.slug || "overview";
          const href = t.slug
            ? `/projects/${project.id}/${t.slug}`
            : `/projects/${project.id}`;
          const isActive = active === slug;
          return (
            <Link
              key={t.slug}
              href={href}
              className={`${p.subnavItem} ${isActive ? p.subnavItemActive : ""}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function NotFoundPage({ message }: { message: string }) {
  return (
    <main className={s.pageNarrow}>
      <header className={s.masthead}>
        <div className={s.brand}>
          Project not found
          <span className={s.brandSub}>Workstream</span>
        </div>
        <Link href="/" className={s.crumb}>
          ← Projects
        </Link>
      </header>
      <div className={s.empty}>{message}</div>
    </main>
  );
}
