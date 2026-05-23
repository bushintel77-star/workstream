import Link from "next/link";
import s from "../../../styles/app.module.css";
import p from "./project.module.css";
import type { Project } from "../../../lib/api";
import { NotFoundView } from "../../../components/NotFoundView";

const BASE_TABS: Array<{ slug: string; label: string }> = [
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

export type ProjectTab =
  | "overview"
  | "processing"
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

function projectTabs(project: Project) {
  if (project.status !== "processing") return BASE_TABS;
  const tabs = [...BASE_TABS];
  tabs.splice(1, 0, { slug: "processing", label: "Processing" });
  return tabs;
}

export function ProjectMasthead({
  project,
  active,
}: {
  project: Project;
  active: ProjectTab;
}) {
  const tabs = projectTabs(project);

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
        {tabs.map((t) => {
          const slug = t.slug || "overview";
          const href = t.slug
            ? `/projects/${project.id}/${t.slug}`
            : `/projects/${project.id}`;
          const isActive = active === slug;
          return (
            <Link
              key={t.slug || "overview"}
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

export function NotFoundPage({ message }: { message: string }) {
  return <NotFoundView title="Project not found" message={message} />;
}
