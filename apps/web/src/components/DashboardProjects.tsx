"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { deleteProjectAction, restoreProjectAction } from "../app/actions";
import { useToast } from "./ToastHost";
import { Dialog, Button } from "./ui";
import home from "../app/home.module.css";

type DashboardStatus = "draft" | "active" | "review" | "complete" | "deleted";
type DashboardSort = "activity" | "name" | "cost";

export type DashboardProject = {
  id: string;
  address: string;
  createdAt: string;
  status: DashboardStatus;
  stageLabel: string;
  projectName: string;
  costTotal: number | null;
};

const STATUS_LABEL: Record<DashboardStatus, string> = {
  draft: "Draft",
  active: "Active",
  review: "Review",
  complete: "Complete",
  deleted: "Deleted",
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const MONEY_FORMAT = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatDate(value: string): string {
  return DATE_FORMAT.format(new Date(value));
}

function formatMoney(value: number): string {
  return MONEY_FORMAT.format(value);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function DashboardProjects({
  projects,
  loadError,
}: {
  projects: DashboardProject[];
  loadError: string | null;
}) {
  const toast = useToast();
  const [items, setItems] = useState(projects);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<DashboardSort>("activity");
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<DashboardProject | null>(null);

  const visibleProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((project) => {
      const matchesQuery =
        q.length === 0 ||
        project.projectName.toLowerCase().includes(q) ||
        project.address.toLowerCase().includes(q);
      return matchesQuery && project.status !== "deleted";
    });

    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.projectName.localeCompare(b.projectName);
      if (sort === "cost") return (b.costTotal ?? -1) - (a.costTotal ?? -1);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, query, sort]);

  function deleteProject(project: DashboardProject) {
    setConfirmDelete(project);
  }

  function confirmDeleteProject() {
    const project = confirmDelete;
    if (!project) return;
    setConfirmDelete(null);

    const formData = new FormData();
    formData.set("id", project.id);
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== project.id));
    startTransition(() => {
      void deleteProjectAction(formData)
        .then(() => {
          toast.show("Project deleted", "info", 5000, {
            action: {
              label: "Undo",
              onClick: () => restoreProject(project, previous),
            },
          });
        })
        .catch((err: unknown) => {
          setItems(previous);
          toast.show(
            err instanceof Error ? err.message : "Project delete failed",
            "error",
          );
        });
    });
  }

  function restoreProject(project: DashboardProject, fallback: DashboardProject[]) {
    const formData = new FormData();
    formData.set("id", project.id);
    startTransition(() => {
      void restoreProjectAction(formData)
        .then(() => {
          setItems(fallback);
          toast.show("Project restored", "success");
        })
        .catch((err: unknown) => {
          toast.show(
            err instanceof Error ? err.message : "Project restore failed",
            "error",
          );
        });
    });
  }

  return (
    <section className={home.projectsPanel} aria-labelledby="sites-heading">
      {/* Index header */}
      <div className={home.indexHead}>
        <p id="sites-heading" className={home.indexLabel}>
          {items.length > 0 ? "Projects" : "Projects"}
        </p>
        <p className={home.indexCount}>
          {items.length} {items.length === 1 ? "entry" : "entries"}
        </p>
      </div>

      {loadError ? (
        <div className={home.errorCard} role="alert">
          <strong>Could not load projects</strong>
          <span>{loadError}</span>
        </div>
      ) : null}

      {/* Search — minimal single input */}
      {items.length > 0 ? (
        <div className={home.searchRow}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={home.searchInput}
            type="search"
            placeholder="Search by name or address"
            aria-label="Search projects"
          />
          <span className={home.searchHint}>
            {visibleProjects.length} shown
          </span>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className={home.emptyState}>
          <h3>No projects yet</h3>
          <p>
            Start your first project with a Melbourne site address above.
          </p>
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className={home.noResults}>
          <h3>No matching projects</h3>
          <p>Adjust your search to bring projects back into view.</p>
        </div>
      ) : (
        <ul className={home.projectList} aria-busy={isPending}>
          {visibleProjects.map((project, i) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className={home.projectRow}
              >
                <span className={home.rowIndex}>{pad2(i + 1)}</span>
                <span className={home.rowBody}>
                  <span className={home.rowName}>{project.projectName}</span>
                  <span className={home.rowAddress}>{project.address}</span>
                  <span className={home.rowMeta}>
                    <span className={home.statusGroup}>
                      <span
                        className={`${home.statusDot} ${home[`status_${project.status}`]}`}
                        aria-hidden
                      />
                      <span className={home.statusText}>
                        {STATUS_LABEL[project.status]}
                      </span>
                    </span>
                    <span className={home.rowStage}>{project.stageLabel}</span>
                    {project.costTotal != null ? (
                      <span className={home.rowCost}>
                        {formatMoney(project.costTotal)}
                      </span>
                    ) : (
                      <span className={`${home.rowCost} ${home.rowCostPending}`}>
                        —
                      </span>
                    )}
                    <span className={home.rowDate}>
                      {formatDate(project.createdAt)}
                    </span>
                  </span>
                </span>
                <span className={home.rowArrow} aria-hidden>
                  {"\u2192"}
                </span>
              </Link>
              <div className={home.rowActions}>
                <button
                  type="button"
                  className={home.rowDeleteBtn}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteProject(project);
                  }}
                  aria-label={`Delete ${project.projectName}`}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={confirmDelete != null}
        onClose={() => setConfirmDelete(null)}
        title="Delete project?"
        destructive
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDeleteProject}>
              Delete
            </Button>
          </>
        }
      >
        {confirmDelete ? (
          <p>
            <strong>{confirmDelete.projectName}</strong>
            <br />
            {confirmDelete.address}
            <br />
            <br />
            The project moves to trash and can be restored.
          </p>
        ) : null}
      </Dialog>
    </section>
  );
}
