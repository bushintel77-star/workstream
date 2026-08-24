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

/* Operator ledger — workflow groups, not one flat rank of cards. Failures
 * surface at the top so a stalled pipeline can't hide three scrolls down. */
type RowGroup = "attention" | "active" | "done";

const GROUPS: Array<{ key: RowGroup; heading: string }> = [
  { key: "attention", heading: "Needs attention" },
  { key: "active", heading: "Active work" },
  { key: "done", heading: "Shared & complete" },
];

function groupFor(project: DashboardProject): RowGroup {
  if (project.stageLabel.startsWith("Attention")) return "attention";
  if (project.status === "complete") return "done";
  return "active";
}

/** Status = shape + ink (design-spec §3.4): ▲ conflict (crimson is reserved
 *  for exactly this), ● active (the single accent), ○ draft, ✓ done. */
function glyphFor(project: DashboardProject): string {
  const group = groupFor(project);
  if (group === "attention") return "▲";
  if (project.status === "complete") return "✓";
  if (project.status === "draft") return "○";
  return "●";
}

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

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((project) => {
      const matchesQuery =
        q.length === 0 ||
        project.projectName.toLowerCase().includes(q) ||
        project.address.toLowerCase().includes(q);
      return matchesQuery && project.status !== "deleted";
    });
    const by = (a: DashboardProject, b: DashboardProject) => {
      if (sort === "name") return a.projectName.localeCompare(b.projectName);
      if (sort === "cost") return (b.costTotal ?? -1) - (a.costTotal ?? -1);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    };
    const buckets: Record<RowGroup, DashboardProject[]> = {
      attention: [],
      active: [],
      done: [],
    };
    for (const project of filtered) buckets[groupFor(project)].push(project);
    for (const key of Object.keys(buckets) as RowGroup[]) buckets[key].sort(by);
    return buckets;
  }, [items, query, sort]);

  const visibleCount =
    grouped.attention.length + grouped.active.length + grouped.done.length;
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
          {visibleCount} shown
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
          <span className={home.searchHint}>{visibleCount} shown · {sortLabel}</span>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className={home.emptyState}>
          <h3>No projects yet</h3>
          <p>
            Start your first project with a Melbourne site address above.
          </p>
        </div>
      ) : visibleCount === 0 ? (
        <div className={home.noResults}>
          <h3>No matching projects</h3>
          <p>Adjust your search to bring projects back into view.</p>
        </div>
      ) : (
        <div aria-busy={isPending}>
          {GROUPS.map(({ key, heading }) => {
            const rows = grouped[key];
            if (rows.length === 0) return null;
            return (
              <section key={key} className={home.ledgerGroup} aria-label={heading}>
                <h3 className={home.groupHead}>
                  <span
                    className={`${home.groupGlyph} ${key === "attention" ? home.groupGlyphConflict : ""}`}
                    aria-hidden
                  >
                    {key === "attention" ? "▲" : key === "active" ? "●" : "✓"}
                  </span>
                  {heading}
                  <span className={home.groupCount}>{rows.length}</span>
                </h3>
                <ul className={home.ledgerList}>
                  {rows.map((project) => (
                    <li key={project.id} className={home.rowItem}>
                      <Link
                        href={`/projects/${project.id}`}
                        className={`${home.row} ${key === "attention" ? home.rowAttention : ""}`}
                      >
                        <span className={home.rowGlyph} aria-hidden>
                          {glyphFor(project)}
                        </span>
                        <span className={home.rowMain}>
                          <span className={home.rowName}>{project.projectName}</span>
                          <span className={home.rowAddress}>{project.address}</span>
                        </span>
                        <span className={home.rowStage}>{project.stageLabel}</span>
                        {project.costTotal != null ? (
                          <span className={home.rowCost}>
                            {formatMoney(project.costTotal)}
                          </span>
                        ) : (
                          <span className={`${home.rowCost} ${home.rowCostPending}`}>
                            not costed
                          </span>
                        )}
                        <span className={home.rowDate}>
                          {formatDate(project.createdAt)}
                        </span>
                      </Link>
                      {/* Quiet secondary actions — the row is the open affordance. */}
                      <div className={home.rowActions}>
                        <Link
                          href={`/projects/${project.id}/outputs`}
                          className={home.rowRecordsLink}
                          aria-label={`Records for ${project.projectName}`}
                        >
                          Records
                        </Link>
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
              </section>
            );
          })}
        </div>
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
