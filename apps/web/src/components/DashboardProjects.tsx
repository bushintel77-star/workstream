"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { deleteProjectAction, restoreProjectAction } from "../app/actions";
import { useToast } from "./ToastHost";
import { Dialog } from "./ui";
import { KitButton, KitSelect } from "./ui/kit";
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
  const sortLabel =
    sort === "activity" ? "Recent activity" : sort === "name" ? "Project name" : "Estimated cost";

  function deleteProject(project: DashboardProject) {
    setConfirmDelete(project);
  }

  function confirmDeleteProject() {
    const project = confirmDelete;
    if (!project) return;
    setConfirmDelete(null);

    const formData = new FormData();
    formData.set("id", project.id);
    setItems((current) => current.filter((item) => item.id !== project.id));
    startTransition(() => {
      void deleteProjectAction(formData)
        .then(() => {
          toast.show("Project deleted", "info", 5000, {
            action: {
              label: "Undo",
              onClick: () => restoreProject(project),
            },
          });
        })
        .catch((err: unknown) => {
          setItems((current) =>
            current.some((item) => item.id === project.id)
              ? current
              : [project, ...current],
          );
          toast.show(
            err instanceof Error ? err.message : "Project delete failed",
            "error",
          );
        });
    });
  }

  function restoreProject(project: DashboardProject) {
    const formData = new FormData();
    formData.set("id", project.id);
    startTransition(() => {
      void restoreProjectAction(formData)
        .then(() => {
          setItems((current) =>
            current.some((item) => item.id === project.id)
              ? current
              : [project, ...current],
          );
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
          Projects register
        </p>
        <p className={home.indexCount} aria-live="polite">
          {visibleProjects.length} shown
        </p>
      </div>

      {loadError ? (
        <div className={home.errorCard} role="alert" data-testid="home-load-error">
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
          <KitSelect
            size="sm"
            value={sort}
            onChange={(event) => setSort(event.target.value as DashboardSort)}
            aria-label="Sort projects"
            className={home.sortSelect}
          >
            <option value="activity">Recent</option>
            <option value="name">Name</option>
            <option value="cost">Cost</option>
          </KitSelect>
          <span className={home.searchHint}>{visibleProjects.length} shown · {sortLabel}</span>
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
        <ul className={home.cardGrid} aria-busy={isPending}>
          {visibleProjects.map((project) => (
            <li key={project.id} className={home.cardItem}>
              <Link
                href={`/projects/${project.id}`}
                className={`${home.card} ${home[`status_${project.status}`]}`}
              >
                {/* Thumbnail — stage tag as identity, not a giant index number */}
                <div className={home.cardThumb}>
                  <span className={home.cardStageTag}>
                    {project.stageLabel}
                  </span>
                  <span
                    className={`${home.cardDot} ${home[`status_${project.status}`]}`}
                    aria-hidden
                  />
                </div>

                {/* Body — project name + address */}
                <div className={home.cardBody}>
                  <span className={home.cardName}>{project.projectName}</span>
                  <span className={home.cardAddress}>{project.address}</span>
                </div>

                {/* Footer — cost + date */}
                <div className={home.cardFooter}>
                  {project.costTotal != null ? (
                    <span className={home.cardCost}>
                      {formatMoney(project.costTotal)}
                    </span>
                  ) : (
                    <span className={`${home.cardCost} ${home.cardCostPending}`}>
                      —
                    </span>
                  )}
                  <span className={home.cardDate}>
                    {formatDate(project.createdAt)}
                  </span>
                </div>
              </Link>
              {/* Quiet secondary actions — the card body is the open affordance. */}
              <div className={home.cardActions}>
                <Link
                  href={`/projects/${project.id}/outputs`}
                  className={home.cardSurfaceLinkSecondary}
                  aria-label={`Records for ${project.projectName}`}
                >
                  Records
                </Link>
                <button
                  type="button"
                  className={home.cardDeleteBtn}
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
            <KitButton variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
              Cancel
            </KitButton>
            <KitButton variant="destructive" size="sm" onClick={confirmDeleteProject}>
              Delete
            </KitButton>
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
