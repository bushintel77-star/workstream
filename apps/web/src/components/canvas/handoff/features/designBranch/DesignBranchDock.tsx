"use client";

import { useCallback, useEffect, useState } from "react";
import type { DesignBranch, DesignCanvas } from "@workstream/contracts";
import { CameraChrome } from "../../CameraChrome";
import {
  displayBranchName,
  readDesignBranchId,
  writeDesignBranchId,
} from "./designBranchPrefs";
import css from "./designBranch.module.css";

type DiffChange = {
  kind: string;
  id: string;
  op: string;
  label: string;
};

type Conflict = { kind: string; id: string; label: string };

type Props = {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onCheckout: (branchId: string, canvas: DesignCanvas | null) => void;
  activeBranchId: string | null;
};

export function DesignBranchDock({
  projectId,
  open,
  onClose,
  onCheckout,
  activeBranchId,
}: Props) {
  const [branches, setBranches] = useState<DesignBranch[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [diff, setDiff] = useState<{
    branchId: string;
    changes: DiffChange[];
  } | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [mergeBranchId, setMergeBranchId] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<
    Record<string, "ours" | "theirs" | "both">
  >({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/design-branches`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Could not load branches");
    const json = (await res.json()) as { branches: DesignBranch[] };
    setBranches(json.branches);
    return json.branches;
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : "Load failed"),
    );
  }, [open, load]);

  if (!open) return null;

  async function checkout(branchId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/design-branches/${branchId}/checkout`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Checkout failed");
      const json = (await res.json()) as {
        branch: DesignBranch;
        canvas: DesignCanvas | null;
      };
      writeDesignBranchId(projectId, branchId);
      onCheckout(branchId, json.canvas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  async function createBranch() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/design-branches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Create failed");
      }
      const json = (await res.json()) as { branch: DesignBranch };
      setNewName("");
      await load();
      await checkout(json.branch.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadDiff(branchId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/design-branches/${branchId}/diff`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Diff failed");
      const json = (await res.json()) as {
        diff: { changes: DiffChange[] };
      };
      setDiff({ branchId, changes: json.diff.changes });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diff failed");
    } finally {
      setBusy(false);
    }
  }

  async function merge(branchId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/design-branches/${branchId}/merge`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ resolutions }),
        },
      );
      if (res.status === 409) {
        const j = (await res.json()) as { conflicts: Conflict[] };
        setConflicts(j.conflicts);
        setMergeBranchId(branchId);
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Merge failed");
      }
      const json = (await res.json()) as {
        canvas: DesignCanvas;
        branch: DesignBranch;
      };
      setConflicts(null);
      setResolutions({});
      setMergeBranchId(null);
      await load();
      const main = (await load()).find((b) => b.name === "main");
      if (main) {
        writeDesignBranchId(projectId, main.id);
        onCheckout(main.id, json.canvas);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setBusy(false);
    }
  }

  async function abandon(branchId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/design-branches/${branchId}/abandon`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Abandon failed");
      if (readDesignBranchId(projectId) === branchId) {
        writeDesignBranchId(projectId, null);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Abandon failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CameraChrome>
      <aside
        className={css.dock}
        data-testid="design-branch-dock"
        data-camera-chrome
      >
        <header className={css.head}>
          <h2 className={css.title}>Design branches</h2>
          <button type="button" className={css.close} onClick={onClose}>
            Close
          </button>
        </header>
        {error ? <p className={css.error}>{error}</p> : null}
        <div className={css.createRow}>
          <input
            className={css.input}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Option — heavy planting"
            aria-label="New branch name"
            data-testid="design-branch-name"
          />
          <button
            type="button"
            className={css.btn}
            disabled={busy || !newName.trim()}
            onClick={() => void createBranch()}
            data-testid="design-branch-create"
          >
            Create
          </button>
        </div>
        <ul className={css.list}>
          {branches.map((b) => (
            <li key={b.id} className={css.row} data-status={b.status}>
              <div>
                <strong>{displayBranchName(b.name)}</strong>
                <span className={css.meta}>
                  {b.status}
                  {activeBranchId === b.id ? " · checked out" : ""}
                </span>
              </div>
              <div className={css.actions}>
                {b.status === "open" ? (
                  <>
                    <button
                      type="button"
                      className={css.btnGhost}
                      disabled={busy}
                      onClick={() => void checkout(b.id)}
                      data-testid={`design-branch-checkout-${b.name}`}
                    >
                      Checkout
                    </button>
                    {b.name !== "main" ? (
                      <>
                        <button
                          type="button"
                          className={css.btnGhost}
                          disabled={busy}
                          onClick={() => void loadDiff(b.id)}
                          data-testid={`design-branch-diff-${b.name}`}
                        >
                          Diff
                        </button>
                        <button
                          type="button"
                          className={css.btn}
                          disabled={busy}
                          onClick={() => void merge(b.id)}
                          data-testid={`design-branch-merge-${b.name}`}
                        >
                          Merge
                        </button>
                        <button
                          type="button"
                          className={css.btnGhost}
                          disabled={busy}
                          onClick={() => void abandon(b.id)}
                        >
                          Abandon
                        </button>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {diff ? (
          <section className={css.diff} data-testid="design-branch-diff">
            <h3>Diff vs main</h3>
            {diff.changes.length === 0 ? (
              <p className={css.meta}>No structural changes</p>
            ) : (
              <ul>
                {diff.changes.map((c) => (
                  <li key={`${c.kind}-${c.id}-${c.op}`}>
                    {c.op} {c.kind}: {c.label}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
        {conflicts && mergeBranchId ? (
          <section
            className={css.conflicts}
            data-testid="design-branch-conflicts"
          >
            <h3>Merge conflicts</h3>
            <p className={css.meta}>
              Accept ours (main), theirs (branch), or keep both.
            </p>
            {conflicts.map((c) => (
              <div key={c.id} className={css.conflictRow}>
                <span>
                  {c.kind}: {c.label}
                </span>
                <select
                  value={resolutions[c.id] ?? ""}
                  onChange={(e) =>
                    setResolutions((prev) => ({
                      ...prev,
                      [c.id]: e.target.value as "ours" | "theirs" | "both",
                    }))
                  }
                  aria-label={`Resolve ${c.label}`}
                >
                  <option value="" disabled>
                    Resolve…
                  </option>
                  <option value="ours">Accept ours</option>
                  <option value="theirs">Accept theirs</option>
                  <option value="both">Keep both</option>
                </select>
              </div>
            ))}
            <button
              type="button"
              className={css.btn}
              disabled={
                busy ||
                conflicts.some((c) => !resolutions[c.id])
              }
              onClick={() => void merge(mergeBranchId)}
              data-testid="design-branch-merge-resolve"
            >
              Merge with resolutions
            </button>
          </section>
        ) : null}
      </aside>
    </CameraChrome>
  );
}
