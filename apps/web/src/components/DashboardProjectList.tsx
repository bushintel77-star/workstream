"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { Project, ProjectStatus } from "../lib/api";
import { deleteProjectAction, restoreProjectAction } from "../app/actions";
import { useToast } from "./ToastHost";
import home from "../app/home.module.css";

const FILTERS = ["DRAFT", "ACTIVE", "REVIEW", "COMPLETE"] as const;
type StatusFilter = (typeof FILTERS)[number];
type SortKey = "date" | "name";

const STATUS_LABEL: Record<ProjectStatus, StatusFilter> = {
  draft: "DRAFT",
  recording: "ACTIVE",
  processing: "ACTIVE",
  survey_review: "REVIEW",
  design_review: "REVIEW",
  cost_review: "REVIEW",
  audit: "REVIEW",
  outputs: "COMPLETE",
  complete: "COMPLETE",
};

function formatBusinessTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  const day = new Intl.DateTimeFormat("en-AU", { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat("en-AU", { month: "short" }).format(date);
  const year = new Intl.DateTimeFormat("en-AU", { year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${day} ${month} ${year} · ${time}`;
}

export function DashboardProjectList({ projects }: { projects: Project[] }) {
  const toast = useToast();
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<Set<StatusFilter>>(new Set());
  const [sort, setSort] = useState<SortKey>("date");

  const visibleProjects = useMemo(() => {
    const rows = projects.filter((project) => {
      if (filters.size === 0) return true;
      return filters.has(STATUS_LABEL[project.status]);
    });
    return rows.sort((a, b) => {
      if (sort === "name") return a.address.localeCompare(b.address, "en-AU");
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filters, projects, sort]);

  const toggleFilter = (filter: StatusFilter) => {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  };

  const deleteProject = (project: Project) => {
    setPendingProjectId(project.id);
    startTransition(async () => {
      const data = new FormData();
      data.set("id", project.id);
      await deleteProjectAction(data);
      setPendingProjectId(null);
      toast.show("Project deleted", "success", 5000, {
        action: {
          label: "Undo",
          onClick: () => {
            startTransition(async () => {
              const restore = new FormData();
              restore.set("id", project.id);
              await restoreProjectAction(restore);
              toast.show("Project restored", "success", 3000);
            });
          },
        },
      });
    });
  };

  if (projects.length === 0) {
    return (
      <div className={home.emptyState}>
        <svg className={home.emptySvg} viewBox="0 0 120 120" aria-hidden>
          <rect x="22" y="26" width="76" height="68" rx="12" />
          <path d="M34 76 52 58l13 12 18-24 12 30" />
          <circle cx="44" cy="44" r="7" />
        </svg>
        <h3>No projects yet</h3>
        <p>Start with an address to generate the first survey, sketch, and quote.</p>
        <a className={home.emptyCta} href="#new-project">
          Start your first project
        </a>
      </div>
    );
  }

  return (
    <>
      <div className={home.filters} aria-label="Project filters">
        <div className={home.filterChips}>
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`${home.filterChip}${filters.has(filter) ? ` ${home.filterChipActive}` : ""}`}
              onClick={() => toggleFilter(filter)}
              aria-pressed={filters.has(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
        <label className={home.sortLabel}>
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="date">Date</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>
      {visibleProjects.length === 0 ? (
        <div className={home.filteredEmpty} role="status">
          No projects match those filters.
        </div>
      ) : (
        <ul className={home.ul}>
          {visibleProjects.map((project) => (
            <li key={project.id} className={home.projectCard}>
              <Link className={home.row} href={`/projects/${project.id}`}>
                <span className={home.cardMain}>
                  <span className={home.statusChip}>{STATUS_LABEL[project.status]}</span>
                  <span className={home.addr}>{project.address}</span>
                  <span className={home.timestamp}>
                    {formatBusinessTimestamp(project.created_at)}
                  </span>
                </span>
                <span className={home.meta}>Open</span>
              </Link>
              <button
                type="button"
                className={home.deleteBtn}
                disabled={isPending && pendingProjectId === project.id}
                onClick={() => deleteProject(project)}
              >
                {isPending && pendingProjectId === project.id ? "Deleting" : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
