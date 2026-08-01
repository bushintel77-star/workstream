"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { deleteProjectAction, restoreProjectAction } from "../app/actions";
import { useToast } from "./ToastHost";
import { Button, Dialog, Popover, SkeletonRow } from "./ui";
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

const STATUS_FILTERS: Array<{ value: DashboardStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "review", label: "Review" },
  { value: "complete", label: "Complete" },
  { value: "deleted", label: "Deleted" },
];

const DATE_FORMAT = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const MONEY_FORMAT = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatTimestamp(value: string): string {
  return DATE_FORMAT.format(new Date(value)).replace(",", " ·");
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
  const [selectedStatuses, setSelectedStatuses] = useState<DashboardStatus[]>([]);
  const [sort, setSort] = useState<DashboardSort>("activity");
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<DashboardProject | null>(null);
  const [loadingSkeleton, setLoadingSkeleton] = useState(false);

  const visibleProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((project) => {
      const matchesQuery =
        q.length === 0 ||
        project.projectName.toLowerCase().includes(q) ||
        project.address.toLowerCase().includes(q);
      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(project.status);
      return matchesQuery && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.projectName.localeCompare(b.projectName);
      if (sort === "cost") return (b.costTotal ?? -1) - (a.costTotal ?? -1);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, query, selectedStatuses, sort]);

  function toggleStatus(status: DashboardStatus) {
    setSelectedStatuses((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    );
  }

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
      <div className={home.panelHead}>
        <div>
          <p className={home.kicker}>Operator dashboard</p>
          <h2 id="sites-heading" className={home.listTitle}>
            Project register
          </h2>
        </div>
        <a className={home.newProjectButton} href="#project-address">
          New project
        </a>
      </div>

      {loadError ? (
        <div className={home.errorCard} role="alert">
          <strong>Could not load projects</strong>
          <span>{loadError}</span>
        </div>
      ) : null}

      <div className={home.filterBar} aria-label="Project filters">
        <label className={home.searchLabel}>
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={home.searchInput}
            type="search"
            placeholder="Name or address"
          />
        </label>

        <div className={home.statusChips} aria-label="Status filters">
          {STATUS_FILTERS.map((filter) => {
            const active = selectedStatuses.includes(filter.value);
            return (
              <button
                key={filter.value}
                type="button"
                className={`${home.filterChip} ${active ? home.filterChipActive : ""}`}
                aria-pressed={active}
                onClick={() => toggleStatus(filter.value)}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className={home.sortLabel} role="group" aria-label="Sort projects">
          <span>Sort</span>
          <div className={home.sortChips}>
            {(
              [
                ["activity", "Last activity"],
                ["name", "Name"],
                ["cost", "Cost"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`${home.filterChip} ${sort === value ? home.filterChipActive : ""}`}
                aria-pressed={sort === value}
                onClick={() => setSort(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loadingSkeleton ? (
        <SkeletonRow count={3} />
      ) : items.length === 0 ? (
        <DashboardEmptyState />
      ) : visibleProjects.length === 0 ? (
        <div className={home.noResults}>
          <DashboardIllustration />
          <h3>No matching projects</h3>
          <p>Adjust the search or status filters to bring projects back into view.</p>
        </div>
      ) : (
        <ul className={home.projectGrid} aria-busy={isPending}>
          {visibleProjects.map((project) => (
            <li key={project.id}>
              <article className={home.projectCard}>
                <div className={home.cardTopline}>
                  <span className={`${home.statusChip} ${home[`status_${project.status}`]}`}>
                    {project.status}
                  </span>
                  <Popover trigger={<>Actions</>} label="Project actions">
                    <Link href={`/projects/${project.id}`}>Open</Link>
                    <button
                      type="button"
                      data-variant="danger"
                      onClick={() => deleteProject(project)}
                    >
                      Delete
                    </button>
                  </Popover>
                </div>
                <Link href={`/projects/${project.id}`} className={home.cardLink}>
                  <h3>{project.projectName}</h3>
                  <p>{project.address}</p>
                  <dl className={home.cardMeta}>
                    <div>
                      <dt>Stage</dt>
                      <dd>{project.stageLabel}</dd>
                    </div>
                    <div>
                      <dt>Last activity</dt>
                      <dd>{formatTimestamp(project.createdAt)}</dd>
                    </div>
                  </dl>
                  {project.costTotal != null ? (
                    <span className={home.costTotal}>{formatMoney(project.costTotal)}</span>
                  ) : (
                    <span className={home.costPending}>Costing pending</span>
                  )}
                </Link>
              </article>
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
            The project moves to trash and can be restored from the dashboard.
          </p>
        ) : null}
      </Dialog>
    </section>
  );
}

function DashboardEmptyState() {
  return (
    <div className={home.emptyState}>
      <DashboardIllustration />
      <h3>No projects yet</h3>
      <p>Start your first project with a Melbourne site address and confirm the aerial pin.</p>
      <a className={home.emptyCta} href="#project-address">
        Start your first project
      </a>
    </div>
  );
}

function DashboardIllustration() {
  return (
    <svg className={home.emptyIllustration} viewBox="0 0 120 120" aria-hidden="true">
      <rect x="20" y="24" width="80" height="72" rx="4" />
      <path d="M32 76L48 58L62 70L78 48L92 66" />
      <circle cx="44" cy="44" r="7" />
      <path d="M28 88H92" />
    </svg>
  );
}
