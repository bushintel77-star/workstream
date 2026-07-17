import Link from "next/link";
import type { Project } from "../lib/api";
import {
  getProjectTabs,
  PROJECT_SECTION_LABELS,
  type ProjectTab,
} from "../lib/project-tabs";
import p from "../app/projects/[id]/project.module.css";
import s from "../styles/app.module.css";
import shell from "./projectPipelineShell.module.css";

type Variant = "immersive" | "content";

type Props = {
  project: Project;
  active: ProjectTab;
  /** Overrides the default section kicker under the address. */
  sectionLabel?: string;
  variant?: Variant;
  children: React.ReactNode;
};

/** Shared pipeline chrome — studio (immersive) and workflow tabs (scrollable content). */
export function ProjectPipelineShell({
  project,
  active,
  sectionLabel,
  variant = "content",
  children,
}: Props) {
  const tabs = getProjectTabs(project);
  const label = sectionLabel ?? PROJECT_SECTION_LABELS[active];
  const immersive = variant === "immersive";

  return (
    <div
      className={`${shell.frame} ${immersive ? shell.frameImmersive : shell.frameContent}`}
      data-testid="project-pipeline-shell"
      data-shell-variant={variant}
    >
      {/* Immersive = canvas-first: no pipeline masthead — studio/CAD owns chrome. */}
      {!immersive ? (
        <header className={shell.chrome}>
          <div className={shell.chromeRow}>
            <Link href="/" className={shell.crumb}>
              ← Projects
            </Link>
            <div className={shell.site}>
              <span className={shell.address}>{project.address}</span>
              <span className={shell.meta}>{label}</span>
            </div>
            <nav className={shell.quickLinks} aria-label="Quick links">
              {active !== "design" ? (
                <Link href={`/projects/${project.id}/design`} className={shell.link}>
                  Studio
                </Link>
              ) : (
                <Link href={`/projects/${project.id}/design/develop`} className={shell.link}>
                  Develop
                </Link>
              )}
              {active !== "overview" ? (
                <Link href={`/projects/${project.id}/overview`} className={shell.link}>
                  Pipeline
                </Link>
              ) : null}
            </nav>
          </div>
          <nav className={`${p.subnav} ${shell.subnav}`} aria-label="Project sections">
            {tabs.map((t) => {
              const href = `/projects/${project.id}/${t.slug}`;
              const isActive = active === t.slug;
              return (
                <Link
                  key={t.slug}
                  href={href}
                  className={`${p.subnavItem} ${isActive ? p.subnavItemActive : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  data-testid={`pipeline-tab-${t.slug}`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </header>
      ) : null}
      <main
        className={`${shell.stage} ${immersive ? shell.stageImmersive : shell.stageContent}`}
      >
        {children}
      </main>
    </div>
  );
}

/** Scrollable inner page body for workflow tabs (replaces `main.page`). */
export function PipelineContent({ children }: { children: React.ReactNode }) {
  return <div className={shell.content}>{children}</div>;
}

type SurveyRequiredProps = {
  projectId: string;
};

export function StudioSurveyRequired({ projectId }: SurveyRequiredProps) {
  return (
    <div className={shell.empty}>
      <h1 className={shell.emptyTitle}>Studio</h1>
      <p className={shell.emptyLede}>
        Run the survey first — the aerial site plan is required before you can sketch on
        satellite imagery.
      </p>
      <Link href={`/projects/${projectId}/survey`} className={s.btn}>
        Complete survey first
      </Link>
    </div>
  );
}
